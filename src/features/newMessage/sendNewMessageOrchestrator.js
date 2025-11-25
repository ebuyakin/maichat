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
 * @param {string|null} editingPairId - Pair ID if re-asking
 * @returns {Promise<string>} Created/updated pair ID
 */
export async function sendNewMessage({
  userText,
  pendingImageIds,
  topicId,
  modelId,
  visiblePairIds,
  editingPairId,
}) {
  // Phase 0: Initialize pair and show user message
  const { pair } = await initializePair({
    userText,
    pendingImageIds,
    topicId,
    modelId,
    editingPairId,
  })
  
  let responseData = null
  let errorToReport = null
  let systemTokens = undefined
  let historyTokens = undefined
  
  try {
    // Filter context: exclude the pair being re-asked
    const contextPairIds = editingPairId
      ? visiblePairIds.filter(id => id !== editingPairId)
      : visiblePairIds
    
    // Phase 1: Select context pairs that fit in budget
    const {
      selectedPairs,
      selectedPairsTokens,
      systemTokens: sysTokens,
    } = await selectContextPairs({
      topicId,
      visiblePairIds: contextPairIds,
      newMessagePair: pair,
      modelId,
    })
    systemTokens = sysTokens
    
    // Phase 2: Build provider-agnostic request parts (batch encodes all images)
    const requestParts = await buildRequestParts({
      selectedPairs,
      newMessagePair: pair,
    })
    
    // Phase 3: Send to provider with retry
    const { response: rawResponse, historyTokens: histTokens } = await sendWithRetry({
      requestParts,
      selectedPairsTokens,
      topicId,
      modelId,
      maxRetries: 5,
      signal: null,  // TODO: Add abort controller from lifecycle
    })
    historyTokens = histTokens
    
    // Phase 4: Parse response (extract content, citations, etc.)
    responseData = parseResponse(rawResponse)
    
  } catch (error) {
    errorToReport = error
  }
  
  // Phase 5: Update pair and UI (unified for success/error)
  await updatePairAndUI({
    pair,
    modelId,
    responseData,
    errorToReport,
    isReask: Boolean(editingPairId),
    systemTokens,
    historyTokens,
  })
  
  return pair.id
}
