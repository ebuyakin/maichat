// Phase 0: Initialize pair (new message or re-ask)

import { 
  getStore, 
  getHistoryRuntime, 
  getLifecycle, 
  getActiveParts, 
  getScrollController 
} from '../../runtime/runtimeServices.js'

/**
 * Create new pair for true new message
 * 
 * @param {Object} params
 * @param {string} params.userText - User message text
 * @param {string[]} params.pendingImageIds - Attached image IDs
 * @param {string} params.topicId - Topic ID
 * @param {string} params.modelId - Model ID
 * @returns {Object} Initialization result
 */
function handleNewMessage({ userText, pendingImageIds, topicId, modelId }) {
  const store = getStore()
  
  // Create pair in store
  const pairId = store.addMessagePair({
    topicId,
    model: modelId,
    userText,
    assistantText: '',  // Empty until response arrives
  })
  
  // Add metadata
  store.updatePair(pairId, {
    attachments: pendingImageIds,
    lifecycleState: 'sending',
  })
  
  return {
    pairId,
    userText,
    pendingImageIds,
    isReask: false,
    previousResponse: null,
  }
}

/**
 * Prepare existing pair for re-ask with new model
 * 
 * @param {Object} params
 * @param {string} params.editingPairId - Pair ID to re-ask
 * @param {string} params.modelId - New model ID
 * @returns {Object} Initialization result
 */
function handleReask({ editingPairId, modelId }) {
  const store = getStore()
  const pair = store.pairs.get(editingPairId)
  
  if (!pair) {
    throw new Error(`Pair not found: ${editingPairId}`)
  }
  
  // Save previous response for later storage
  const previousResponse = {
    assistantText: pair.assistantText,
    model: pair.model,
    assistantProviderTokens: pair.assistantProviderTokens,
    responseMs: pair.responseMs,
  }
  
  // Update pair state for re-ask
  store.updatePair(editingPairId, {
    model: modelId,  // New model
    lifecycleState: 'sending',
    errorMessage: undefined,  // Clear previous errors
  })
  
  return {
    pairId: editingPairId,
    userText: pair.userText,
    pendingImageIds: pair.attachments || [],
    isReask: true,
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
 * @returns {Object} { pairId, userText, pendingImageIds, isReask, previousResponse }
 */
export function initializePair({
  userText,
  pendingImageIds,
  topicId,
  modelId,
  editingPairId,
}) {
  // Determine path and create/update pair
  const result = editingPairId
    ? handleReask({ editingPairId, modelId })
    : handleNewMessage({ userText, pendingImageIds, topicId, modelId })
  
  // Update UI (same for both paths)
  const historyRuntime = getHistoryRuntime()
  const lifecycle = getLifecycle()
  const activeParts = getActiveParts()
  const scrollController = getScrollController()
  
  // Render with appropriate preserve mode
  historyRuntime.renderCurrentView({ preserveActive: result.isReask })
  
  // Begin send (shows "AI thinking" badge)
  lifecycle.beginSend()
  
  // Activate message
  if (!result.isReask) {
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
