// Main orchestrator for sending new messages

import { initializePair } from './initializePair.js'
import { selectContextPairs } from './selectContextPairs.js'
import { buildRequestParts } from './buildRequestParts.js'
import { sendWithRetry } from './sendWithRetry.js'
import { parseResponse } from './parseResponse.js'
import { updatePairAndUI } from './updatePairAndUI.js'


/**
 * Send a new message to LLM provider
 * 
 * @param {string} userText - New user message text
 * @param {string[]} pendingImageIds - Attached image IDs for the new message
 * @param {string} topicId - Topic ID
 * @param {string} modelId - Model ID
 * @param {string[]} visiblePairIds - WYSIWYG history pair IDs
 * @param {string|null} activePartId - Currently focused part ID
 * @param {string|null} editingPairId - Pair ID if re-asking
 * @returns {Promise<string>} Created/updated pair ID
 */
export async function sendNewMessage({
  userText,
  pendingImageIds,
  topicId,
  modelId,
  visiblePairIds,
  activePartId,
  editingPairId,
}) {
  
  //userText = 'can you describe the image? How many images do you see?' // debugging only
  //editingPairId = 'dd0abd57-c91b-4232-bb0c-d0498793bb24' // debugging only
  //userText = userText + ' (00)' // for debugging. to distinguish new/old pipelines.

  // Phase 0: Initialize pair and show user message
  const { pair, previousResponse } = await initializePair({
    userText,
    pendingImageIds,
    topicId,
    modelId,
    editingPairId,
  })
  console.log('[sendNewMessage] Phase 0 completed.', { pairId: pair.id, isReask: Boolean(editingPairId) })
  
  let responseData = null
  let errorToReport = null
  let finalPromptEstimatedTokens = null
  
  try {
    // Phase 1: Select context pairs and load configuration
    const {
      selectedPairs,
      selectedPairsTokens,
      fullPromptEstimatedTokens,
      systemMessage,
      providerId,
      options,
    } = await selectContextPairs({
      topicId,
      visiblePairIds,
      newMessagePair: pair,
      modelId,
    })
    console.log('[sendNewMessage] Phase 1 completed.', {
      selectedPairsCount: selectedPairs.length,
      systemMessage,
      providerId,
      options,
      fullPromptEstimatedTokens,
    })
    
    // Phase 2: Build provider-agnostic request parts (batch encodes all images)
    const requestParts = await buildRequestParts({
      selectedPairs,
      newMessagePair: pair,
    })
    console.log('[sendNewMessage] Phase 2 completed. Request parts:', requestParts)
    
    // Phase 3: Send to provider with retry
    const result = await sendWithRetry({
      requestParts,
      selectedPairsTokens,
      fullPromptEstimatedTokens,
      providerId,
      modelId,
      systemMessage,
      options,
      maxRetries: 5,
      signal: null,  // : Add abort controller from lifecycle
    })
    const rawResponse = result.rawResponse
    finalPromptEstimatedTokens = result.finalPromptEstimatedTokens  // Assign to outer variable
    console.log('[sendNewMessage] Phase 3 completed.', rawResponse)
    
    // Phase 4: Parse response (extract content, citations, etc.)
    responseData = parseResponse(rawResponse)
    console.log('[sendNewMessage] Phase 4 completed.', responseData)
    
  } catch (error) {
    errorToReport = error
    console.log('[sendNewMessage] Error caught:', error)
  }
  
  // Phase 5: Update pair and UI (unified for success/error)
  updatePairAndUI({
    pair,
    modelId,
    response: responseData,
    error: errorToReport,
    previousResponse,
    finalPromptEstimatedTokens,
    isReask: Boolean(editingPairId),
  })
  console.log('[sendNewMessage] Phase 5 completed: pair and UI updated')
  
  return pair.id
}
