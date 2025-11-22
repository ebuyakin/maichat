// Phase 5: Update pair with result and refresh UI

import { 
  getStore,
  getHistoryRuntime, 
  getLifecycle, 
  getActiveParts, 
  getScrollController,
  getInteraction
} from '../../runtime/runtimeServices.js'
import { calculateEstimatedTokenUsage } from '../../infrastructure/provider/tokenEstimation/budgetEstimator.js'
import { showToast } from '../../shared/toast.js'

/**
 * Handle new message response (success or error)
 */
async function handleNewMessageResponse({ pair, responseData, errorToReport }) {
  const store = getStore()
  
  if (errorToReport) {
    // Extract error message
    let errorMessage = 'Unknown error'
    if (errorToReport.message) {
      errorMessage = errorToReport.message
    } else if (typeof errorToReport === 'string') {
      errorMessage = errorToReport
    }
    
    // Set error state
    store.updatePair(pair.id, {
      assistantText: '',
      lifecycleState: 'error',
      errorMessage,
    })
    return
  }
  
  // Success: update with response
  const updates = {
    // Assistant response
    assistantText: responseData.content,
    
    // Processed content and extractions
    processedContent: responseData.processedContent,
    codeBlocks: responseData.codeBlocks,
    equationBlocks: responseData.equationBlocks,
    
    // Citations
    citations: responseData.citations,
    citationsMeta: responseData.citationsMeta,
    
    // Raw provider data
    rawProviderTokenUsage: responseData.rawTokenUsage,
    responseMs: responseData.responseMs,
    
    // Status
    lifecycleState: 'complete',
    errorMessage: undefined,
  }
  
  store.updatePair(pair.id, updates)
  
  // Recalculate token usage (now includes assistant text)
  const updatedPair = store.pairs.get(pair.id)
  const estimatedTokenUsage = await calculateEstimatedTokenUsage(updatedPair)
  store.updatePair(pair.id, { estimatedTokenUsage })
}

/**
 * Handle re-ask response (success or error)
 */
async function handleReaskResponse({ pair, responseData, errorToReport, newModelId }) {
  const store = getStore()
  
  if (errorToReport) {
    // Extract error message
    let errorMessage = 'Unknown error'
    if (errorToReport.message) {
      errorMessage = errorToReport.message
    } else if (typeof errorToReport === 'string') {
      errorMessage = errorToReport
    }
    
    // Revert to complete state (keep existing response)
    store.updatePair(pair.id, {
      lifecycleState: 'complete',
    })
    
    // Show notification
    showToast('Re-ask failed: ' + errorMessage, true)
    return
  }
  
  // Success: capture previous response and update
  const previousResponse = {
    assistantText: pair.assistantText,
    citations: pair.citations,
    citationsMeta: pair.citationsMeta,
    responseMs: pair.responseMs,
    model: pair.model,
    replacedAt: Date.now(),
    estimatedTokenUsage: pair.estimatedTokenUsage,
    rawProviderTokenUsage: pair.rawProviderTokenUsage,
  }
  
  const updates = {
    // Update model
    model: newModelId,
    
    // Assistant response
    assistantText: responseData.content,
    
    // Processed content and extractions
    processedContent: responseData.processedContent,
    codeBlocks: responseData.codeBlocks,
    equationBlocks: responseData.equationBlocks,
    
    // Citations
    citations: responseData.citations,
    citationsMeta: responseData.citationsMeta,
    
    // Raw provider data
    rawProviderTokenUsage: responseData.rawTokenUsage,
    responseMs: responseData.responseMs,
    
    // Previous response
    previousResponse,
    
    // Status
    lifecycleState: 'complete',
    errorMessage: undefined,
  }
  
  store.updatePair(pair.id, updates)
  
  // Recalculate token usage (now includes new assistant text)
  const updatedPair = store.pairs.get(pair.id)
  const estimatedTokenUsage = await calculateEstimatedTokenUsage(updatedPair)
  store.updatePair(pair.id, { estimatedTokenUsage })
}

/**
 * Update UI after pair is updated
 * Renders history, ends send state, activates message, scrolls
 */
function updateUI({ isReask }) {
  const historyRuntime = getHistoryRuntime()
  const lifecycle = getLifecycle()
  const activeParts = getActiveParts()
  const scrollController = getScrollController()
  const interaction = getInteraction()
  
  // Render updated history
  historyRuntime.renderCurrentView({ preserveActive: isReask })
  
  // End send state (removes "AI thinking" badge)
  lifecycle.completeSend()
  interaction.updateSendDisabled()  // Trigger send button UI update
  
  // Activate appropriate message
  if (!isReask) {
    // New message: activate last (assistant response)
    activeParts.last()
  }
  // Re-ask: keep current active
  
  historyRuntime.applyActiveMessage()
  
  // Scroll to show response
  const act = activeParts.active()
  if (act && act.id && scrollController.alignTo) {
    requestAnimationFrame(() => {
      scrollController.alignTo(act.id, 'bottom', false)
    })
  }
}

/**
 * Update pair with response result and refresh UI
 * Handles both successful responses and errors
 * 
 * @param {Object} params
 * @param {MessagePair} params.pair - The message pair to update
 * @param {string} params.modelId - Model ID used for this request
 * @param {Object|null} params.responseData - Parsed response (if success)
 * @param {Error|null} params.errorToReport - Error object (if error)
 * @param {boolean} params.isReask - Whether this was a re-ask
 * @returns {Promise<void>}
 */
export async function updatePairAndUI({
  pair,
  modelId,
  responseData,
  errorToReport,
  isReask,
}) {
  // Update store based on workflow type
  if (isReask) {
    await handleReaskResponse({ pair, responseData, errorToReport, newModelId: modelId })
  } else {
    await handleNewMessageResponse({ pair, responseData, errorToReport })
  }
  
  // Update UI (same for both workflows)
  updateUI({ isReask })
}
