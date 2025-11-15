//@ts-check
//@ts-nocheck
import { getProvider, ProviderError } from '../../infrastructure/provider/adapter.js'
import {
  estimateTokens,
  estimatePairTokens,
  estimateImageTokens,
} from '../../core/context/tokenEstimator.js'
import { getSettings } from '../../core/settings/index.js'
import { predictHistory, finalizeHistory } from '../../core/context/budgetMath.js'
import { getApiKey } from '../../infrastructure/api/keys.js'
import { getModelMeta } from '../../core/models/modelCatalog.js'
import { get as getImage, encodeToBase64 } from '../images/imageStore.js'

// Note: No global system policy. We rely solely on per-topic system messages.

/**
 * @typedef {import('../../shared/types.js').MessagePair} MessagePair
 * @typedef {import('../../shared/types.js').Message} Message
 * @typedef {import('../../shared/types.js').AppSettings} AppSettings
 * @typedef {import('../../shared/types.js').MemoryStore} MemoryStore
 */

/**
 * Build message array from pairs, embedding image IDs from pair data.
 * 
 * Extracts images from pair.imageBudgets (preferred) or pair.attachments (legacy),
 * and embeds them in the corresponding user message object for provider adapters
 * to attach to the correct historical messages.
 * 
 * @param {Object} params - Build parameters
 * @param {Array<MessagePair>} params.includedPairs - Pairs to include in history (chronological)
 * @param {string} [params.newUserText] - Text for new user message
 * @param {Array<string>} [params.newUserAttachments] - Image IDs for new user message
 * @returns {Array<Message>} Message array with embedded image references
 */
export function buildMessages({ includedPairs, newUserText, newUserAttachments = [] }) {
  const msgs = []
  for (const p of includedPairs) {
    if (p.userText) {
      // Extract image IDs from this pair (prefer imageBudgets, fallback to attachments)
      const imageIds = []
      if (Array.isArray(p.imageBudgets)) {
        for (const imgBudget of p.imageBudgets) {
          if (imgBudget.id) imageIds.push(imgBudget.id)
        }
      } else if (Array.isArray(p.attachments)) {
        imageIds.push(...p.attachments)
      }
      
      msgs.push({
        role: 'user',
        content: p.userText,
        ...(imageIds.length > 0 && { attachments: imageIds })
      })
    }
    if (p.assistantText) {
      msgs.push({ role: 'assistant', content: p.assistantText })
    }
  }
  if (newUserText) {
    msgs.push({
      role: 'user',
      content: newUserText,
      ...(newUserAttachments.length > 0 && { attachments: newUserAttachments })
    })
  }
  return /** @type {Message[]} */ (msgs)
}

/**
 * Execute send request to provider with token estimation and overflow handling.
 * 
 * Orchestrates the complete send pipeline:
 * - Builds message array from visible pairs
 * - Estimates token usage (text + images)
 * - Checks context window limits
 * - Trims oldest pairs iteratively if overflow
 * - Calls provider adapter with final payload
 * - Returns assistant response
 * 
 * @param {Object} params - Send parameters
 * @param {MemoryStore} params.store - Message pair store
 * @param {string} params.model - Model identifier (e.g., 'gpt-4', 'gemini-2.0-flash-exp')
 * @param {string} params.topicId - Topic ID for retrieving system message
 * @param {string} params.userText - New user message text
 * @param {AbortSignal} params.signal - Abort signal for cancellation (Ctrl+C)
 * @param {Array<MessagePair>} params.visiblePairs - All pairs in current filtered view (chronological)
 * @param {Array<string>} [params.attachments] - Image IDs for new user message only
 * @param {boolean} [params.topicWebSearchOverride] - Override topic web search setting
 * @param {Function} [params.onDebugPayload] - Debug callback(payload) for telemetry
 * @returns {Promise<{content: string}>} Assistant response object
 * @throws {Error} Throws if user prompt too large or context overflow after trimming
 */
export async function executeSend({
  store,
  model,
  topicId,
  userText,
  signal,
  visiblePairs,
  attachments = [], // NEW: array of imageIds for the new user message
  topicWebSearchOverride, // NEW: optional boolean to override model's webSearch setting
  onDebugPayload,
}) {
  // step e1.
  const settings = /** @type {AppSettings} */ (getSettings())
  const { charsPerToken = 4 } = settings
  const baseline = visiblePairs
    ? visiblePairs.slice()
    : store.getAllPairs().sort((/** @type {MessagePair} */ a, /** @type {MessagePair} */ b) => a.createdAt - b.createdAt)
  const topic = topicId ? store.topics.get(topicId) : null
  const topicSystem =
    topic && typeof topic.systemMessage === 'string' ? topic.systemMessage.trim() : ''
  const providerMeta = getModelMeta(model) || { provider: 'openai' }
  const providerId = providerMeta.provider || 'openai'
  
  // step e2.
  // NEW: Estimate image tokens for the new user message
  let imageTokens = 0
  if (attachments.length > 0) {
    for (const id of attachments) {
      try {
        const img = await getImage(id)
        if (img && img.w && img.h) {
          imageTokens += estimateImageTokens({ w: img.w, h: img.h }, providerId, model)
        }
      } catch (e) {
        console.warn('[pipeline] failed to load image for token estimation', id, e)
        // Continue without this image's tokens (graceful degradation)
      }
    }
  }
  
  // Phase 1: prediction (newest->oldest) reserving URA and provider PARA semantics
  const URA = settings.userRequestAllowance
  const ARA = settings.assistantResponseAllowance
  const pred = predictHistory({
    pairs: baseline,
    model,
    systemText: topicSystem,
    provider: providerId,
    charsPerToken: charsPerToken,
    URA,
    ARA,
  })
  // Phase 2: iterative overflow attempts using original predicted set (do not recompute prediction)
  const systemTokens = pred.systemTokens
  const userTokens = estimateTokens(userText || '', charsPerToken) + imageTokens // Include image tokens
  if (userTokens + systemTokens > pred.C) {
    const err = new Error('user_prompt_too_large')
    err.code = 'user_prompt_too_large'
    throw err
  }
  // Stage 2.1: internal one-by-one trim (do not rely on batch trimming inside finalizeHistory)
  let working = pred.predicted.slice() // chronological
  const HLA = Math.max(0, pred.C - userTokens - systemTokens - pred.PARA)
  let T_internal = 0
  // Compute H0 token sum via heuristic
  const tokenOf = (/** @type {MessagePair} */ p) => estimatePairTokens(p, charsPerToken)
  let currentTokens = working.reduce((a, p) => a + tokenOf(p), 0)
  if (currentTokens > HLA) {
    while (working.length && currentTokens > HLA) {
      const first = working[0]
      currentTokens -= tokenOf(first)
      working.shift()
      T_internal++
    }
    if (currentTokens > HLA) {
      const err = new Error('context_overflow_after_trimming')
      err.code = 'context_overflow_after_trimming'
      throw err
    }
  }
  // Now finalize to build budget numbers (finalizeHistory will see already-trimmed set and should not remove more)
  const finalResult = finalizeHistory({
    predicted: working,
    userText,
    systemTokens,
    C: pred.C,
    PARA: pred.PARA,
    URA,
    charsPerToken,
  })
  if (finalResult.error) {
    const err = new Error(finalResult.error)
    err.code = finalResult.error
    throw err
  }
  const includedPairs = finalResult.included
  const budget = {
    maxContext: finalResult.C,
    inputTokens: finalResult.inputTokens,
    remainingContext: finalResult.remainingContext,
  }
  const baseMessages = buildMessages({ 
    includedPairs, 
    newUserText: userText,
    newUserAttachments: attachments 
  })
  const provider = getProvider(providerId)
  const apiKey = getApiKey(providerId)

  const emitDebug = (/** @type {any} */ payload) => {
    if (typeof onDebugPayload === 'function') onDebugPayload(payload)
  }
  const baseDebugCore = () => ({
    model,
    budget: { maxContext: budget.maxContext },
    predictedMessageCount: pred.predicted.length,
    T_internal,
    systemTokens,
    charsPerToken,
    predictedHistoryTokens: pred.predictedTokenSum,
    predictedTotalTokens: pred.predictedTokenSum + (settings.userRequestAllowance || 0),
    remainingReserve: budget.remainingContext,
    effectiveMaxContext: pred.C - systemTokens,
    topicId,
  })

  // Preflight HUD emission (before provider verification success)
  emitDebug({
    ...baseDebugCore(),
    status: 'preflight',
    attemptsUsed: 0,
    T_provider: 0,
    trimmedCount: T_internal,
    selection: includedPairs.map((/** @type {MessagePair} */ p) => ({
      id: p.id,
      model: p.model,
      tokens: estimatePairTokens(p, charsPerToken),
    })),
    messages: topicSystem
      ? [{ role: 'system', content: topicSystem }, ...baseMessages]
      : baseMessages,
  })

  if (!provider) {
    emitDebug({
      ...baseDebugCore(),
      status: 'error',
      errorCode: 'provider_not_registered',
      attemptsUsed: 0,
      T_provider: 0,
      trimmedCount: T_internal,
      selection: [],
      messages: [],
    })
    const err = new Error('provider_not_registered')
    err.code = 'provider_not_registered'
    throw err
  }
  if (!apiKey) {
    emitDebug({
      ...baseDebugCore(),
      status: 'error',
      errorCode: 'missing_api_key',
      attemptsUsed: 0,
      T_provider: 0,
      trimmedCount: T_internal,
      selection: [],
      messages: [],
    })
    const err = new Error('missing_api_key')
    err.code = 'missing_api_key'
    throw err
  }
  const options = {}
  const rp = (topic && topic.requestParams) || {}
  if (typeof rp.temperature === 'number') options.temperature = rp.temperature
  if (typeof rp.maxOutputTokens === 'number') options.maxOutputTokens = rp.maxOutputTokens
  
  // Web search: topic override takes precedence over model default
  let webSearch = providerMeta.webSearch  // Start with model default
  if (typeof topicWebSearchOverride === 'boolean') {
    webSearch = topicWebSearchOverride  // Topic override wins
  }
  if (typeof webSearch === 'boolean') {
    options.webSearch = webSearch
  }
  
  // Stage 3: provider retry loop (context overflow at provider tokenizer)
  let attemptsUsed = 0
  let T_provider = 0
  let workingProviderPairs = includedPairs.slice()
  const attemptsTelemetry = []
  const maxAttempts = settings.maxTrimAttempts || 10
  const t0 = Date.now()
  while (true) {
    const msgs = buildMessages({ 
      includedPairs: workingProviderPairs, 
      newUserText: userText,
      newUserAttachments: attachments 
    })
    attemptsUsed++
    emitDebug({
      ...baseDebugCore(),
      status: 'attempt',
      attemptNumber: attemptsUsed,
      attemptsUsed,
      T_provider,
      trimmedCount: T_internal + T_provider,
      selection: workingProviderPairs.map((/** @type {MessagePair} */ p) => ({
        id: p.id,
        model: p.model,
        tokens: estimatePairTokens(p, charsPerToken),
      })),
      messages: topicSystem ? [{ role: 'system', content: topicSystem }, ...msgs] : msgs,
    })
    let result,
      overflow = false
    try {
      const meta = { otpm: (getModelMeta(model) || {}).otpm }

      // DEBUG. Persist a pre-send debug snapshot to localStorage (provider-agnostic)
      try {
        // Count images per message for telemetry
        let totalImages = 0
        const messagesWithImages = []
        for (let i = 0; i < msgs.length; i++) {
          const m = msgs[i]
          const imageCount = Array.isArray(m.attachments) ? m.attachments.length : 0
          if (imageCount > 0) {
            totalImages += imageCount
            messagesWithImages.push({
              index: i,
              role: m.role,
              imageCount,
              imageIds: m.attachments
            })
          }
        }
        
        const dbg = {
          at: Date.now(),
          provider: providerId,
          model,
          systemLen: (topicSystem || '').length,
          messages: (msgs || []).map((m) => ({
            role: m.role,
            contentPreview: typeof m.content === 'string' ? m.content.slice(0, 400) : String(m.content).slice(0, 200),
            contentLength: typeof m.content === 'string' ? m.content.length : undefined,
            imageCount: Array.isArray(m.attachments) ? m.attachments.length : 0,
          })),
          totalImages,
          messagesWithImages,
        }
        localStorage.setItem('maichat_dbg_pipeline_presend', JSON.stringify(dbg))
      } catch {}

      // API call:
      result = await provider.sendChat({
        model,
        messages: msgs,  // Now contains attachments per message
        system: topicSystem || undefined,
        apiKey,
        signal,
        options,
        budget,
        meta,
        helpers: {
          encodeImage: encodeToBase64,
        },
      })
    } catch (ex) {
      const msg = ((ex && ex.message) || '').toLowerCase()
      const providerCode = ex && ex.providerCode
      if (
        providerCode === 'context_length_exceeded' ||
        /context length|too many tokens|too large|exceeds context window|maximum context/i.test(msg)
      ) {
        overflow = true
      } else {
        // Persist last error details for inspection
        try {
          const errDbg = {
            at: Date.now(),
            provider: providerId,
            model,
            message: ex && ex.message,
            kind: ex && ex.kind,
            status: ex && ex.status,
            providerCode: ex && ex.providerCode,
            timing: ex && ex.__timing ? ex.__timing : undefined,
          }
          // DEBUG. API call error:
          localStorage.setItem('maichat_dbg_pipeline_error', JSON.stringify(errDbg))
        } catch {}
        emitDebug({
          ...baseDebugCore(),
          status: 'error',
          errorCode: ex.code || ex.kind || 'provider_error',
          attemptsUsed,
          T_provider,
          trimmedCount: T_internal + T_provider,
          selection: workingProviderPairs.map((/** @type {MessagePair} */ p) => ({ id: p.id })),
          messages: [],
        })
        throw ex
      }
    }
    attemptsTelemetry.push({
      attempt: attemptsUsed,
      trimmedInternal: T_internal,
      trimmedProvider: T_provider,
      sentPairs: workingProviderPairs.map((/** @type {MessagePair} */ p) => p.id),
    })
    if (!overflow) {
      emitDebug({
        ...baseDebugCore(),
        status: 'success',
        attemptsUsed,
        T_provider,
        trimmedCount: T_internal + T_provider,
        selection: workingProviderPairs.map((/** @type {MessagePair} */ p) => ({
          id: p.id,
          model: p.model,
          tokens: estimatePairTokens(p, charsPerToken),
        })),
        messages: topicSystem ? [{ role: 'system', content: topicSystem }, ...msgs] : msgs,
        timing: { t0, attempts: attemptsTelemetry },
      })
      return result
    }
    if (workingProviderPairs.length === 0 || attemptsUsed >= maxAttempts) {
      emitDebug({
        ...baseDebugCore(),
        status: 'error',
        errorCode: 'context_overflow_after_trimming',
        attemptsUsed,
        T_provider,
        trimmedCount: T_internal + T_provider,
        selection: [],
        messages: [],
      })
      const err = new Error('context_overflow_after_trimming')
      err.code = 'context_overflow_after_trimming'
      throw err
    }
    workingProviderPairs = workingProviderPairs.slice(1)
    T_provider++
  }
}
