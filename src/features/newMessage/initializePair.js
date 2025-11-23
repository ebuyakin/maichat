// Phase 0: Initialize pair (new message or re-ask)

import { 
  getStore, 
  getHistoryRuntime, 
  getLifecycle, 
  getActiveParts, 
  getScrollController,
  getInteraction
} from '../../runtime/runtimeServices.js'
import { calculateEstimatedTokenUsage } from '../../infrastructure/provider/tokenEstimation/budgetEstimator.js'

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
  
  // Add attachments if present
  if (pendingImageIds && pendingImageIds.length > 0) {
    store.updatePair(pairId, {
      attachments: pendingImageIds,
    })
  }
  
  // Get pair and calculate estimated token usage for all providers
  const pair = store.pairs.get(pairId)
  const estimatedTokenUsage = await calculateEstimatedTokenUsage(pair)
  
  // Update pair with token usage and lifecycle state
  store.updatePair(pairId, {
    estimatedTokenUsage,
    lifecycleState: 'sending',
  })
  
  // Get updated pair from store
  const updatedPair = store.pairs.get(pairId)
  
  return { pair: updatedPair }
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
  
  // Update pair state for re-ask (minimal update)
  store.updatePair(editingPairId, {
    lifecycleState: 'sending',
  })
  
  // Get updated pair from store
  const updatedPair = store.pairs.get(editingPairId)

  return { pair: updatedPair }
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
  const interaction = getInteraction()
  
  // Render with appropriate preserve mode
  historyRuntime.renderCurrentView({ preserveActive: isReask })
  
  // Begin send (shows "AI thinking" badge)
  lifecycle.beginSend()
  interaction.updateSendDisabled()  // Trigger send button UI update
  
  // Activate message
  if (!isReask) {
    // New message: activate last (newly created user message)
    activeParts.last()
  }
  // Re-ask: keep current active (already correct)
  
  historyRuntime.applyActiveMessage()
  
  // Scroll to show active message (only for new messages, not re-ask)
  if (!isReask) {
    const act = activeParts.active()
    if (act && act.id && scrollController.alignTo) {
      requestAnimationFrame(() => {
        scrollController.alignTo(act.id, 'bottom', false)
      })
    }
  }
  // Re-ask: keep current scroll position (will be aligned when response arrives)
  
  return result
}