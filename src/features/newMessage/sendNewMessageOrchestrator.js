// Main orchestrator for sending new messages

import { initializePair } from './initializePair.js'
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
  
  // Phase 0: Initialize pair and show user message
  const { pair, previousResponse } = await initializePair({
    userText,
    pendingImageIds,
    topicId,
    modelId,
    editingPairId,
  })
  console.log('[sendNewMessage] Phase 0 completed.', { pairId: pair.id, isReask: Boolean(editingPairId) })
  
  try {
    // Phase 1: Select context pairs and load configuration
    const {
      selectedPairs,
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
    })
    
    // Phase 2: Build provider-agnostic request parts (batch encodes all images)
    const requestParts = await buildRequestParts({
      selectedPairs,
      newMessagePair: pair,
    })
    console.log('[sendNewMessage] Phase 2 completed. Request parts:', requestParts)
    
    // Phase 3: Send to provider with retry
    const rawResponse = await sendWithRetry({
      requestParts,
      providerId,
      modelId,
      systemMessage,
      options,
      maxRetries: 5,
      signal: null,  // Add abort controller from lifecycle
    })
    console.log('[sendNewMessage] Phase 3 completed.', rawResponse)
    
    // Parse response (extract content, citations, etc.)
    const parsedResponse = parseResponse(rawResponse)
    console.log('[sendNewMessage] Parsed response.', parsedResponse)
    
    // Phase 5a: Update success
    /*
    updatePairSuccess({
      pairId: pair.id,
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
      pairId: pair.id,
      error,
      store,
    })
    console.log('[sendNewMessage] Phase 5b completed: error', error)
  */
  }
  
  // Phase 6: Update UI (same for success/error)
  /*
  updateUI({
    pairId: pair.id,
    isReask: Boolean(editingPairId),
    historyRuntime,
    activeParts,
    scrollController,
    lifecycle,
  })
  console.log('[sendNewMessage] Phase 6 completed: UI updated')
  
  return pair.id
  */
}
