// Phase 5: Update pair with result and refresh UI

import { 
  getStore,
  getHistoryRuntime, 
  getLifecycle, 
  getActiveParts, 
  getScrollController,
  getInteraction
} from '../../runtime/runtimeServices.js'
import { getSettings } from '../../core/settings/index.js'
import { getModelMeta } from '../../core/models/modelCatalog.js'
import { estimateTextTokens } from '../../infrastructure/provider/tokenEstimation/budgetEstimator.js'
import { showToast } from '../../shared/toast.js'

/**
 * Handle successful response
 * Updates pair with response data and previous response (if re-ask)
 */
function handleSuccess({ pair, response, previousResponse, newModelId }) {
  const store = getStore()
  
  // Get provider and settings for token estimation (use new model for re-ask)
  const modelMeta = getModelMeta(newModelId)
  const providerId = modelMeta?.provider || 'openai'
  const settings = getSettings()
  
  // Calculate assistant text tokens (estimated for current provider)
  const assistantTextTokens = estimateTextTokens(response.content, providerId, settings)
  
  // Legacy textTokens: sum of user + assistant
  const userTextTokens = pair.userTextTokens || 0
  const textTokens = userTextTokens + assistantTextTokens
  
  // Build update object
  const updates = {
    // 3. Assistant response (current)
    assistantText: response.content,
    assistantChars: response.content.length,
    assistantTextTokens,
    assistantProviderTokens: response.reportedTokens,
    responseMs: response.responseMs,
    
    // Processed content and extractions
    processedContent: response.processedContent,
    codeBlocks: response.codeBlocks,
    equationBlocks: response.equationBlocks,
    
    // Citations (if present)
    citations: response.citations,
    citationsMeta: response.citationsMeta,
    
    // 4. Status
    lifecycleState: 'complete',
    errorMessage: undefined,
    
    // Legacy
    textTokens,
  }
  
  // If re-ask: store previous response data and update model
  if (previousResponse) {
    // Update model to new model (was old model before re-ask)
    updates.model = newModelId
    
    // Store previous response data
    updates.previousAssistantText = previousResponse.assistantText
    updates.previousAssistantChars = previousResponse.assistantChars
    updates.previousModel = previousResponse.model
    updates.previousAssistantProviderTokens = previousResponse.assistantProviderTokens
    updates.previousUserTextTokens = previousResponse.userTextTokens
    updates.previousAssistantTextTokens = previousResponse.assistantTextTokens
    updates.previousCitations = previousResponse.citations
    updates.previousCitationsMeta = previousResponse.citationsMeta
    updates.previousResponseMs = previousResponse.responseMs
    updates.replacedAt = Date.now()
    updates.replacedBy = newModelId  // New model that replaced it
  }
  
  store.updatePair(pair.id, updates)
}

/**
 * Handle error
 * Updates pair with error state
 * For re-ask: reverts to previous good state (no error shown)
 */
function handleError({ pair, error, previousResponse }) {
  const store = getStore()
  
  // Extract error message
  let errorMessage = 'Unknown error'
  if (error && error.message) {
    errorMessage = error.message
  } else if (typeof error === 'string') {
    errorMessage = error
  }
  
  if (previousResponse) {
    // Re-ask error: revert to 'complete' state (keep existing response intact)
    store.updatePair(pair.id, {
      lifecycleState: 'complete',
    })
    
    // Show transient notification to user
    showToast('Re-ask failed: ' + errorMessage, true)
    
  } else {
    // New message error: set error state
    store.updatePair(pair.id, {
      assistantText: '',
      lifecycleState: 'error',
      errorMessage,
    })
  }
}

/**
 * Update UI after pair is updated
 * Renders history, ends send state, activates message, scrolls
 */
function updateUI({ pair, isReask }) {
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
 * @param {Object|null} params.response - Parsed response (if success)
 * @param {Error|null} params.error - Error object (if error)
 * @param {Object|null} params.previousResponse - Previous response data (for re-ask)
 * @param {boolean} params.isReask - Whether this was a re-ask
 * @returns {void}
 */
export function updatePairAndUI({
  pair,
  modelId,
  response,
  error,
  previousResponse,
  isReask,
}) {
  // Update store
  if (error) {
    handleError({ pair, error, previousResponse })
  } else {
    handleSuccess({ pair, response, previousResponse, newModelId: modelId })
  }
  
  // Update UI (same for both success/error)
  updateUI({ pair, isReask })
}
