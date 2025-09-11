// pipeline.js moved from send/pipeline.js (Phase 6.5 Compose)
// Adjusted import paths to new relative locations.
import { getProvider, ProviderError } from '../../infrastructure/provider/adapter.js'
import { estimateTokens, getModelBudget, estimatePairTokens } from '../../core/context/tokenEstimator.js'
import { getSettings } from '../../core/settings/index.js'
import { getApiKey } from '../../infrastructure/api/keys.js'

// System instruction enforcing strict plain-text output (hardened wording).
// Minimal inline constant (release-freeze). Adjust wording only—logic unchanged.
const SYSTEM_INSTRUCTION = 'STRICT FORMAT POLICY: Output ONLY plain text. NEVER use Markdown or any formatting characters (#, *, -, +, `, ``` , >, |, _, ~), no code fences, no inline backticks, no bulleted or numbered lists, no tables, no block quotes, no HTML, no JSON unless explicitly requested, no attachments, no images, no links unless explicitly requested. If code is required, indent each code line with four spaces; do NOT wrap code or add language labels. Replace any list you would normally produce with plain sentences separated by a single blank line. Ignore formatting in earlier assistant messages—always normalize to this plain style. Provide only the answer content: no preamble, no closing summary, no disclaimers.'

export function buildMessages({ includedPairs, newUserText }){
  const msgs = []
  for (const p of includedPairs) {
    if (p.userText) msgs.push({ role: 'user', content: p.userText })
    if (p.assistantText) msgs.push({ role: 'assistant', content: p.assistantText })
  }
  if (newUserText) { msgs.push({ role: 'user', content: newUserText }) }
  return msgs
}

export async function executeSend({ store, model, userText, signal, visiblePairs, boundarySnapshot, onDebugPayload }) {
  const settings = getSettings()
  const { userRequestAllowance = 100, maxTrimAttempts = 10, charsPerToken = 3.5 } = settings
  const baseline = visiblePairs ? visiblePairs.slice() : store.getAllPairs().sort((a, b) => a.createdAt - b.createdAt)
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now())
  // Token cost of fixed system message (reserved from context window)
  const systemTokens = estimateTokens(SYSTEM_INSTRUCTION, charsPerToken)
  let predicted = []
  let allowance = userRequestAllowance
  let maxContext
  const timing = { t0, tAfterPrediction: null, attempts: [] }
  if (boundarySnapshot) {
    predicted = boundarySnapshot.included ? boundarySnapshot.included.slice() : []
    allowance = boundarySnapshot.stats ? (boundarySnapshot.stats.URA ?? userRequestAllowance) : userRequestAllowance
    maxContext = boundarySnapshot.stats ? boundarySnapshot.stats.maxContext : getModelBudget(model).maxContext
  } else {
    const budget = getModelBudget(model)
    maxContext = budget.maxContext
    allowance = userRequestAllowance
    const predictedRev = []
    let historyEstimate = 0
    // Effective window after reserving space for system instruction
    const effectiveMaxContext = Math.max(0, maxContext - systemTokens)
    for (let i = baseline.length - 1; i >= 0; i--) {
      const p = baseline[i]
      const tok = estimatePairTokens(p, charsPerToken)
      // Use effectiveMaxContext so we never over-pack beyond what remains after system message
      if (historyEstimate + tok + allowance > effectiveMaxContext) break
      predictedRev.push(p)
      historyEstimate += tok
    }
    predicted = predictedRev.reverse()
  }
  const userTokens = estimateTokens(userText, charsPerToken)
  timing.tAfterPrediction = (typeof performance !== 'undefined' ? performance.now() : Date.now())
  // Early guard: if user prompt + system message alone exceed model window, fail fast.
  if (userTokens + systemTokens > maxContext) {
    const err = new Error('message too large for model window')
    err.code = 'user_prompt_too_large'
    throw err
  }
  let trimmedCount = 0
  let attemptsUsed = 0
  let currentIncluded = predicted.slice()
  function emitDebug(extra = {}) {
    if (typeof onDebugPayload !== 'function') return
    const attemptHistoryTokens = currentIncluded.reduce((acc, p) => acc + estimatePairTokens(p, charsPerToken), 0)
    const attemptTotalTokens = attemptHistoryTokens + userTokens
    const predictedHistoryTokens = predicted.reduce((acc, p) => acc + estimatePairTokens(p, charsPerToken), 0)
    const predictedTotalTokens = predictedHistoryTokens + allowance
    onDebugPayload({
      model,
      budget: { maxContext, maxUsableRaw: maxContext },
      selection: currentIncluded.map(p => ({ id: p.id, model: p.model, tokens: estimatePairTokens(p, charsPerToken) })),
      predictedMessageCount: predicted.length,
      trimmedCount,
      attemptsUsed,
      AUT: userTokens,
      charsPerToken,
      predictedHistoryTokens,
      predictedTotalTokens,
      attemptHistoryTokens,
      attemptTotalTokens,
      remainingReserve: maxContext - attemptHistoryTokens - userTokens,
  systemTokens,
  effectiveMaxContext: Math.max(0, maxContext - systemTokens),
      messages: buildMessages({ includedPairs: currentIncluded, newUserText: userText }),
      timing: { ...timing },
      ...extra
    })
  }
  async function attemptSend() {
    const idx = attemptsUsed
    const aStart = (typeof performance !== 'undefined' ? performance.now() : Date.now())
    timing.attempts.push({ attempt: idx + 1, start: aStart, end: null, duration: null, trimmedCount })
    emitDebug()
    const provider = getProvider('openai')
    if (!provider) throw new Error('provider_not_registered')
    const apiKey = getApiKey('openai')
    if (!apiKey) throw new Error('missing_api_key')
  const baseMessages = buildMessages({ includedPairs: currentIncluded, newUserText: userText })
  const messages = [ { role: 'system', content: SYSTEM_INSTRUCTION }, ...baseMessages ]
  const result = await provider.sendChat({ model, messages, apiKey, signal })
    const aEnd = (typeof performance !== 'undefined' ? performance.now() : Date.now())
    const rec = timing.attempts[timing.attempts.length - 1]
    if (rec) {
      rec.end = aEnd; rec.duration = aEnd - rec.start
      if (result && result.__timing) {
        rec.provider = {
          serialize_ms: result.__timing.tSerializeEnd - result.__timing.tSerializeStart,
          fetch_ms: result.__timing.tFetchEnd - result.__timing.tFetchStart,
          parse_ms: result.__timing.tParseEnd - result.__timing.tParseStart
        }
      }
    }
    emitDebug({ stage: 'attempt_success' })
    return result
  }
  function isOverflowError(e) {
    if (!e) return false
    if (e.providerCode && e.providerCode === 'context_length_exceeded') return true
    const msg = (e.message || '').toLowerCase()
    const patterns = [
      'context_length',
      'maximum context length',
      'too many tokens',
      'context too long',
      'exceeds context window',
      'request too large',
      'too large for'
    ]
    return patterns.some(s => msg.includes(s))
  }
  try {
    return await attemptSend()
  } catch (ex) {
    if (isOverflowError(ex)) {
      emitDebug({ lastErrorMessage: ex.message, overflowMatched: true, stage: 'overflow_initial' })
      while (trimmedCount < maxTrimAttempts && currentIncluded.length) {
        currentIncluded.shift()
        trimmedCount++
        attemptsUsed = trimmedCount
        try { return await attemptSend() } catch (inner) {
          if (isOverflowError(inner)) {
            emitDebug({ lastErrorMessage: inner.message, overflowMatched: true, stage: 'overflow_retry' })
            continue
          } else {
            emitDebug({ lastErrorMessage: inner.message, overflowMatched: false, stage: 'retry_non_overflow' })
            if (inner instanceof ProviderError && inner.kind === 'auth') {
              const err = new Error('api_key_auth_failed'); err.__original = inner; throw err
            }
            throw inner
          }
        }
      }
      const err = new Error('context_overflow_after_trimming')
      err.code = 'context_overflow_after_trimming'
      err.trimmedCount = trimmedCount
      err.predictedMessageCount = predicted.length
      emitDebug({ lastErrorMessage: err.message, overflowMatched: true, stage: 'overflow_exhausted' })
      throw err
    }
    if (ex instanceof ProviderError && ex.kind === 'auth') {
      const err = new Error('api_key_auth_failed'); err.__original = ex; emitDebug({ lastErrorMessage: err.message, overflowMatched: false, stage: 'auth_error' }); throw err
    }
    emitDebug({ lastErrorMessage: ex.message, overflowMatched: false, stage: 'other_error' })
    throw ex
  }
}
