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
import { getModelMeta } from '../../core/models/modelCatalog.js'
import { showToast } from '../../shared/toast.js'
import { smartAlignActiveMessage } from '../history/smartAlignMessage.js'

/**
 * Handle new message response (success or error)
 */
async function handleNewMessageResponse({ pair, responseData, errorToReport, fullPromptEstimatedTokens }) {
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
    
    // Telemetry
    fullPromptEstimatedTokens,
    
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
async function handleReaskResponse({ pair, responseData, errorToReport, newModelId, fullPromptEstimatedTokens }) {
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
    fullPromptEstimatedTokens: pair.fullPromptEstimatedTokens,
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
    
    // Telemetry
    fullPromptEstimatedTokens,
    
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
 * Renders history, ends send state, scrolls to new message
 */
function updateUI() {
  const historyRuntime = getHistoryRuntime()
  const lifecycle = getLifecycle()
  const interaction = getInteraction()
  const activeParts = getActiveParts()
  
  // End send state first
  lifecycle.completeSend()
  interaction.updateSendDisabled()
  
  // Render updated history
  historyRuntime.renderCurrentView({ preserveActive: false })
  
  // Explicitly set active to last message (new assistant response)
  // This is needed because setParts() preserves old active by ID
  activeParts.last()
  historyRuntime.applyActiveMessage()
  
  // Smart align the last message
  smartAlignActiveMessage({
    position: 'onfit',  // Bottom if fits, top if doesn't
    mode: 'onfit',      // Switch to VIEW if doesn't fit
    animate: false,
  })
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
 * @param {number} [params.systemTokens] - System message tokens (for telemetry)
 * @param {number} [params.historyTokens] - History tokens sent (for telemetry)
 * @returns {Promise<void>}
 */
export async function updatePairAndUI({
  pair,
  modelId,
  responseData,
  errorToReport,
  isReask,
  systemTokens,
  historyTokens,
}) {
  // Calculate fullPromptEstimatedTokens once (our estimate of total prompt sent)
  let fullPromptEstimatedTokens = undefined
  if (systemTokens !== undefined && historyTokens !== undefined) {
    const modelMeta = getModelMeta(modelId)
    const providerId = modelMeta?.provider || 'openai'
    const userTokens = pair.estimatedTokenUsage?.[providerId] || 0
    fullPromptEstimatedTokens = historyTokens + systemTokens + userTokens
  }
  
  // Update store based on workflow type
  if (isReask) {
    await handleReaskResponse({ pair, responseData, errorToReport, newModelId: modelId, fullPromptEstimatedTokens })
  } else {
    await handleNewMessageResponse({ pair, responseData, errorToReport, fullPromptEstimatedTokens })
  }
  
  // Update UI (same for both workflows)
  updateUI()
}
