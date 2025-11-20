/*
* This is new experimental architecture. It's design to work independently and can be used
* in parallel with the current (production) architecture. It is intended to replace the current
* architecture after thorough in-practice testing. The purpose of this refactoring is to improve
* modularity of the new message routine, transparency and code quality to facilitate maintainability,
* debugging, and future development.
*/
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
  
  userText = 'What is the weather forecast today in Lisbon?'
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
      signal: null,  // : Add abort controller from lifecycle
    })
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
    isReask: Boolean(editingPairId),
  })
  console.log('[sendNewMessage] Phase 5 completed: pair and UI updated')
  
  return pair.id
}
