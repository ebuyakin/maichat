// Phase 0: Initialize pair (new message or re-ask)

import { 
  getStore, 
  getHistoryRuntime, 
  getLifecycle, 
  getActiveParts, 
  getScrollController 
} from '../../runtime/runtimeServices.js'
import { estimateTextTokens } from '../../infrastructure/provider/tokenEstimation/budgetEstimator.js'
import { getSettings } from '../../core/settings/index.js'
import { getModelMeta } from '../../core/models/modelCatalog.js'
import { getManyMetadata as getImageMetadata } from '../images/imageStore.js'

/**
 * Create new pair for true new message
 * 
 * @param {Object} params
 * @param {string} params.userText - User message text
 * @param {string[]} params.pendingImageIds - Attached image IDs
 * @param {string} params.topicId - Topic ID
 * @param {string} params.modelId - Model ID
 * @returns {Promise<Object>} Initialization result
 */
async function handleNewMessage({ userText, pendingImageIds, topicId, modelId }) {
  const store = getStore()
  
  // Create pair in store
  const pairId = store.addMessagePair({
    topicId,
    model: modelId,
    userText,
    // NOTE: Do NOT set assistantText here!
    // Setting it (even to '') will cause UI to render empty assistant part immediately.
    // assistantText should only be set in Phase 5 when response arrives.
  })
  
  // Get provider and settings for token estimation
  const modelMeta = getModelMeta(modelId)
  const providerId = modelMeta?.provider || 'openai'
  const settings = getSettings()
  
  // Calculate user text metrics
  const userChars = userText.length
  const userTextTokens = estimateTextTokens(userText, providerId, settings)
  
  // Calculate image budgets and tokens
  let attachmentTokens = 0
  const imageBudgets = []
  
  if (pendingImageIds && pendingImageIds.length > 0) {
    const images = await getImageMetadata(pendingImageIds)
    for (const img of images) {
      if (img && typeof img.w === 'number' && typeof img.h === 'number') {
        // Legacy: use precomputed tokenCost for current provider
        attachmentTokens += (img.tokenCost && img.tokenCost[providerId]) || 0
        
        // New: store denormalized budget metadata (already precomputed)
        imageBudgets.push({
          id: img.id,
          w: img.w,
          h: img.h,
          tokenCost: img.tokenCost || {}, // Object: { openai: 765, anthropic: 800, ... }
        })
      }
    }
  }
  
  // Legacy textTokens (for old pipeline compatibility). only user text counted.
  const textTokens = userTextTokens
  
  // Add metadata
  store.updatePair(pairId, {
    attachments: pendingImageIds,
    lifecycleState: 'sending',
    userChars,
    userTextTokens,
    textTokens,  // Legacy (for old pipeline)
    attachmentTokens,  // Legacy (for old pipeline)
    imageBudgets,  // New (for fast estimation)
  })
  
  // Get updated pair from store
  const pair = store.pairs.get(pairId)
  
  return {
    pair,
    previousResponse: null,
  }
}

/**
 * Prepare existing pair for re-ask with new model
 * 
 * @param {Object} params
 * @param {string} params.editingPairId - Pair ID to re-ask
 * @returns {Object} Initialization result
 */
function handleReask({ editingPairId }) {
  const store = getStore()
  const pair = store.pairs.get(editingPairId)
  
  if (!pair) {
    throw new Error(`Pair not found: ${editingPairId}`)
  }
  
  // Save previous response data (will be stored in Phase 6 after new response)
  const previousResponse = {
    // 3. Current assistant data (essential - can't be recalculated)
    assistantText: pair.assistantText,
    citations: pair.citations,
    citationsMeta: pair.citationsMeta,
    responseMs: pair.responseMs,
    
    // 5. Budget (assistant and user - provider-specific estimates)
    userTextTokens: pair.userTextTokens,
    assistantTextTokens: pair.assistantTextTokens,
    assistantProviderTokens: pair.assistantProviderTokens,
    assistantChars: pair.assistantChars || pair.assistantText.length,
    
    // Model info
    model: pair.model,
  }
  
  // Update pair state for re-ask (minimal update)
  store.updatePair(editingPairId, {
    lifecycleState: 'sending',
  })
  
  return {
    pair,
    previousResponse,
  }
}

/**
 * Initialize pair for new message or re-ask
 * Creates/updates pair in store and shows immediate UI feedback
 * 
 * @param {Object} params
 * @param {string} params.userText - User message text (for new message)
 * @param {string[]} params.pendingImageIds - Attached image IDs (for new message)
 * @param {string} params.topicId - Topic ID (for new message)
 * @param {string} params.modelId - Model ID
 * @param {string|null} params.editingPairId - Pair ID if re-asking
 * @returns {Promise<Object>} { pair, previousResponse }
 */
export async function initializePair({
  userText,
  pendingImageIds,
  topicId,
  modelId,
  editingPairId,
}) {
  // Determine path and create/update pair
  const result = editingPairId
    ? handleReask({ editingPairId })
    : await handleNewMessage({ userText, pendingImageIds, topicId, modelId })
  
  const isReask = Boolean(editingPairId)
  
  // Update UI (same for both paths)
  const historyRuntime = getHistoryRuntime()
  const lifecycle = getLifecycle()
  const activeParts = getActiveParts()
  const scrollController = getScrollController()
  
  // Render with appropriate preserve mode
  historyRuntime.renderCurrentView({ preserveActive: isReask })
  
  // Begin send (shows "AI thinking" badge)
  lifecycle.beginSend()
  
  // Activate message
  if (!isReask) {
    // New message: activate last (newly created user message)
    activeParts.last()
  }
  // Re-ask: keep current active (already correct)
  
  historyRuntime.applyActiveMessage()
  
  // Scroll to show active message
  const act = activeParts.active()
  if (act && act.id && scrollController.alignTo) {
    requestAnimationFrame(() => {
      scrollController.alignTo(act.id, 'bottom', false)
    })
  }
  
  return result
}