//@ts-check
//@ts-nocheck
/**
 * Send Workflow - High-level orchestration for sending a new message
 * 
 * Extracted from inputKeys.js Enter handler to enable reuse and improve maintainability.
 * This function coordinates:
 * - Creating message pair in store
 * - Computing image budgets
 * - Calling executeSend (pipeline.js)
 * - Processing response (code/equations/sanitization)
 * - Updating store with results
 * - Managing lifecycle state
 * - Triggering UI updates
 * 
 * CRITICAL: Preserves exact sequence of operations from original implementation
 * to maintain timing/state dependencies.
 */

import { executeSend } from './pipeline.js'
import { sanitizeAssistantText } from '../interaction/sanitizeAssistant.js'
import { extractCodeBlocks } from '../codeDisplay/codeExtractor.js'
import { extractEquations } from '../codeDisplay/equationExtractor.js'
import { getMany as getImagesByIds } from '../images/imageStore.js'
import { estimateImageTokens } from '../../core/context/tokenEstimator.js'

/**
 * @typedef {import('../../shared/types.js').MemoryStore} MemoryStore
 * @typedef {import('../../shared/types.js').AppSettings} AppSettings
 * @typedef {import('../../shared/types.js').MessagePair} MessagePair
 * @typedef {import('../../shared/types.js').Lifecycle} Lifecycle
 * @typedef {import('../../shared/types.js').BoundaryManager} BoundaryManager
 * @typedef {import('../../shared/types.js').HistoryRuntime} HistoryRuntime
 * @typedef {import('../../shared/types.js').ActiveParts} ActiveParts
 * @typedef {import('../../shared/types.js').ScrollController} ScrollController
 * @typedef {import('../../shared/types.js').RequestDebug} RequestDebug
 */

/**
 * Execute the complete send workflow
 * 
 * @param {Object} params - Workflow parameters
 * @param {string} params.text - User message text
 * @param {string} params.topicId - Topic ID for the message
 * @param {string} params.model - Model ID to use
 * @param {string[]} params.attachments - Array of image IDs
 * @param {string|null} params.editingId - Pair ID if editing/re-asking
 * @param {boolean|undefined} params.webSearchOverride - Topic-level web search override
 * @param {Set<string>} params.beforeIncludedIds - Pre-send boundary included pair IDs
 * 
 * @param {MemoryStore} params.store - Message store
 * @param {Lifecycle} params.lifecycle - Lifecycle manager
 * @param {BoundaryManager} params.boundaryMgr - Boundary manager
 * @param {HistoryRuntime} params.historyRuntime - History runtime
 * @param {ActiveParts} params.activeParts - Active parts manager
 * @param {ScrollController} params.scrollController - Scroll controller
 * @param {RequestDebug} params.requestDebug - Request debug manager
 * @param {Function} params.updateSendDisabled - Update send button state
 * @param {() => AppSettings} params.getSettings - Get current settings
 * @param {Function} params.sanitizeDisplayPreservingTokens - Sanitize with token preservation
 * @param {Function} params.escapeHtmlAttr - Escape HTML attributes
 * @param {Function} params.escapeHtml - Escape HTML
 * 
 * @returns {Promise<string>} Created pair ID
 */
export async function executeSendWorkflow({
  // Input data
  text,
  topicId,
  model,
  attachments,
  editingId,
  webSearchOverride,
  beforeIncludedIds,
  // Injected dependencies
  store,
  lifecycle,
  boundaryMgr,
  historyRuntime,
  activeParts,
  scrollController,
  requestDebug,
  updateSendDisabled,
  getSettings,
  sanitizeDisplayPreservingTokens,
  escapeHtmlAttr,
  escapeHtml,
}) {

  // step 1. === PAIR CREATION ===
  let id
  if (editingId) {
    const old = store.pairs.get(editingId)
    if (old) {
      // Old pair may still exist if not removed earlier; remove but keep images for transfer
      store.removePair(editingId, true)
    }
    id = store.addMessagePair({ topicId, model, userText: text, assistantText: '' })
    window.__editingPairId = null
  } else {
    id = store.addMessagePair({ topicId, model, userText: text, assistantText: '' })
  }

  // step 2. Persist attachments and userChars immediately; assistant tokens will be computed after reply
  try {
    store.updatePair(id, { 
      attachments: attachments,
      userChars: (text || '').length,
    })
  } catch {}

  // step 3. === ASYNC SEND ROUTINE ===
  ;(async () => {
    // Create AbortController with timeout
    const controller = new AbortController()
    const settings = getSettings()
    const timeoutSec = settings.requestTimeoutSec || 120
    const timeoutMs = timeoutSec * 1000
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, timeoutMs)

    // Store controller reference for manual abort (Ctrl+C handler)
    if (!window.__maichat) window.__maichat = {}
    window.__maichat.requestController = controller

    // step 4.
    try {
      const currentPairs = activeParts.parts
        .map((/** @type {any} */ pt) => store.pairs.get(pt.pairId))
        .filter(Boolean)
      const chrono = [...new Set(currentPairs)].sort((/** @type {MessagePair} */ a, /** @type {MessagePair} */ b) => a.createdAt - b.createdAt)

      boundaryMgr.updateVisiblePairs(chrono)
      boundaryMgr.setModel(model)
      boundaryMgr.applySettings(getSettings())
      const tStart = Date.now()

      // Compute image budgets and attachmentTokens before calling provider
      // Store both legacy attachmentTokens AND new imageBudgets for fast estimation
      try {
        let attachmentTokens = 0
        const imageBudgets = []
        
        if (attachments.length) {
          const imgs = await getImagesByIds(attachments)
          for (const img of imgs) {
            if (img && typeof img.w === 'number' && typeof img.h === 'number') {
              // Legacy: sum for attachmentTokens (using default provider formula)
              attachmentTokens += estimateImageTokens({ w: img.w, h: img.h })
              
              // New: store denormalized budget metadata
              imageBudgets.push({
                id: img.id,
                w: img.w,
                h: img.h,
                tokenCost: img.tokenCost || {}, // precomputed for all providers
              })
            }
          }
        }
        
        store.updatePair(id, { attachmentTokens, imageBudgets })
      } catch {}
      
      // step 5.
      const execResult = await executeSend({
        store,
        model,
        topicId,
        userText: text,
        signal: controller.signal,
        visiblePairs: chrono,
        attachments: attachments,
        topicWebSearchOverride: webSearchOverride,
        onDebugPayload: (/** @type {any} */ payload) => {
          historyRuntime.setSendDebug(payload.predictedMessageCount, payload.trimmedCount)
          requestDebug.setPayload(payload)
          historyRuntime.updateMessageCount(historyRuntime.getPredictedCount(), chrono.length)
        },
      })
      
      const responseMs = Math.max(0, Date.now() - tStart)
      const rawText = execResult.content // keep original for assistantText (context fidelity)
      
      // === RESPONSE PROCESSING ===
      // 1. Code extraction first
      const codeExtraction = /** @type {any} */ (extractCodeBlocks(rawText))
      const afterCode = codeExtraction.hasCode ? codeExtraction.displayText : rawText
      
      // 2. Equation extraction (markers for simple inline)
      const eqResult = /** @type {any} */ (extractEquations(afterCode, { inlineMode: 'markers' }))
      const afterEq = eqResult.displayText // contains [eq-n] placeholders + __EQINL_X__ markers
      
      // 3. Segmented sanitize (skip placeholders & markers)
      const sanitized = sanitizeDisplayPreservingTokens(afterEq)
      
      // 4. Expand inline markers to spans
      let finalDisplay = sanitized
      if (eqResult.inlineSimple && eqResult.inlineSimple.length) {
        for (const item of eqResult.inlineSimple) {
          const span = `<span class="eq-inline" data-tex="${escapeHtmlAttr(item.raw)}">${escapeHtml(item.unicode)}</span>`
          finalDisplay = finalDisplay.replaceAll(item.marker, span)
        }
      }
      
      // Normalize placeholder spacing
      finalDisplay = finalDisplay.replace(/\s*\[([a-z0-9_]+-\d+|eq-\d+)\]\s*/gi, ' [$1] ')
      finalDisplay = finalDisplay.replace(/ {2,}/g, ' ')

      const updateData = /** @type {any} */ ({
        assistantText: rawText,
        lifecycleState: 'complete',
        errorMessage: undefined,
        // S3: Populate assistantChars (ground truth char count)
        assistantChars: (rawText || '').length,
      })
      
      // Persist citations if provided by provider (e.g., Grok/Gemini with search enabled)
      const execResultAny = /** @type {any} */ (execResult)
      if (Array.isArray(execResultAny.citations) && execResultAny.citations.length) {
        updateData.citations = execResultAny.citations
      }
      
      // Persist citation titles map when available (url -> title)
      if (execResultAny.citationsMeta && typeof execResultAny.citationsMeta === 'object') {
        updateData.citationsMeta = execResultAny.citationsMeta
      }
      
      if (codeExtraction.hasCode) {
        updateData.codeBlocks = codeExtraction.codeBlocks
      }
      
      if (eqResult.equationBlocks && eqResult.equationBlocks.length) {
        updateData.equationBlocks = eqResult.equationBlocks
      }
      
      updateData.processedContent =
        codeExtraction.hasCode || eqResult.hasEquations
          ? finalDisplay
          : sanitizeAssistantText(rawText)

      // Update response timing only (textTokens no longer written)
      try {
        updateData.responseMs = responseMs
      } catch {}

      store.updatePair(id, updateData)
      clearTimeout(timeoutId)
      window.__maichat.requestController = null
      lifecycle.completeSend()
      updateSendDisabled()
      historyRuntime.renderCurrentView({ preserveActive: true })
      lifecycle.handleNewAssistantReply(id)
      
    } catch (ex) {
      clearTimeout(timeoutId)
      window.__maichat.requestController = null

      let errMsg
      if (ex.name === 'AbortError') {
        errMsg = 'Request aborted'
      } else {
        errMsg = ex && ex.message ? ex.message : 'error'
        if (errMsg === 'missing_api_key')
          errMsg = 'API key missing (Ctrl+. → API Keys or Ctrl+K)'
      }

      store.updatePair(id, {
        assistantText: '',
        lifecycleState: 'error',
        errorMessage: errMsg,
      })
      lifecycle.completeSend()
      updateSendDisabled()
      historyRuntime.renderCurrentView({ preserveActive: true })
      
      // Activate and anchor the error assistant message
      try {
        const pane = document.getElementById('historyPane')
        const assistantEls = pane
          ? pane.querySelectorAll(
              `.message[data-pair-id="${id}"][data-role="assistant"], .part[data-pair-id="${id}"][data-role="assistant"]`
            )
          : null
        const assistantEl = assistantEls && assistantEls.length ? assistantEls[0] : null
        if (assistantEl) {
          const assistantId = assistantEl.getAttribute('data-part-id')
          if (assistantId) {
            activeParts.setActiveById(assistantId)
            historyRuntime.applyActiveMessage()
            // Scroll to bottom to show error message
            if (scrollController && scrollController.scrollToBottom) {
              requestAnimationFrame(() => {
                scrollController.scrollToBottom(false)
              })
            }
          }
        }
      } catch {}
      
    } finally {
      // Boundary trim notification
      if (getSettings().showTrimNotice) {
        boundaryMgr.updateVisiblePairs(
          store.getAllPairs().sort((/** @type {MessagePair} */ a, /** @type {MessagePair} */ b) => a.createdAt - b.createdAt)
        )
        boundaryMgr.setModel(model)
        boundaryMgr.applySettings(getSettings())
        const postBoundary = boundaryMgr.getBoundary()
        const afterIncludedIds = new Set(postBoundary.included.map((/** @type {MessagePair} */ p) => p.id))
        let trimmed = 0
        beforeIncludedIds.forEach((pid) => {
          if (!afterIncludedIds.has(pid)) trimmed++
        })
        if (trimmed > 0) {
          console.log(`[context] large prompt trimmed ${trimmed} older pair(s)`)
        }
      }
    }
  })()

  return id
}
