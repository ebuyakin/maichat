// Main orchestrator for sending new messages

//import { initialzeNewRequest } from './initialzeNewRequest.js'
import { loadPairsAndConfig } from './loadPairsAndConfig.js'
import { selectContextPairs } from './selectContextPairs.js'
import { buildRequestParts } from './buildRequestParts.js'
import { sendWithRetry } from './sendWithRetry.js'
import { parseResponse } from './parseResponse.js'
import { updatePairSuccess } from './updatePairSuccess.js'
import { updatePairError } from './updatePairError.js'
import { updateUI } from './updateUI.js'


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
  
  // Phase 0: Initialize new message.

  
  try {
    // Phase 1: Load visible pairs and send configuration
    const {
      systemMessage,
      visiblePairs,
      settings,
      providerId,
      options,
    } = loadPairsAndConfig({
      topicId,
      visiblePairIds,
      modelId,
    })
    console.log('[sendNewMessage] Phase 1 completed.', {
      systemMessage,
      providerId,
      modelId,
      options,
    })
    
    // Phase 2: Select which history pairs fit in context
    const selectedHistoryPairs = await selectContextPairs({
      visiblePairs,
      systemMessage,
      userText,
      pendingImageIds,
      modelId,
      providerId,
      settings,
    })
    console.log('[sendNewMessage] Phase 2 completed. Selected pairs:', selectedHistoryPairs)
    
    // Phase 3: Build provider-agnostic request parts (batch encodes all images)
    const requestParts = await buildRequestParts({
      selectedPairs: selectedHistoryPairs,
      userText,
      pendingImageIds,
    })
    console.log('[sendNewMessage] Phase 3 completed. Request parts:', requestParts)
    
    // Phase 4: Send to provider with retry
    const rawResponse = await sendWithRetry({
      requestParts,
      providerId,
      modelId,
      systemMessage,
      options,
      maxRetries: 3,
      signal: null,  // Add abort controller from lifecycle
    })
    console.log('[sendNewMessage] Phase 4 completed.', rawResponse)
    
    // Parse response (extract content, citations, etc.)
    const parsedResponse = parseResponse(rawResponse)
    console.log('[sendNewMessage] Parsed response.', parsedResponse)
    
    // Phase 5a: Update success
    /*
    updatePairSuccess({
      pairId,
      response: parsedResponse,
      previousResponse,
      store,
    })
    console.log('[sendNewMessage] Phase 5a completed: success')
    */
    
  } catch (error) {
    console.log(error)
    /*
    // Phase 5b: Update error
    updatePairError({
      pairId,
      error,
      store,
    })
    console.log('[sendNewMessage] Phase 5b completed: error', error)
  */
  }
  
  // Phase 6: Update UI (same for success/error)
  /*
  updateUI({
    pairId,
    isReask,
    historyRuntime,
    activeParts,
    scrollController,
    lifecycle,
  })
  console.log('[sendNewMessage] Phase 6 completed: UI updated')
  
  return pairId
  */
}
