// Main orchestrator for sending new messages

// sub routines (internal to newMessageRoutine):
import { loadPairsAndConfig } from './loadPairsAndConfig.js'
import { selectContextPairs } from './selectContextPairs.js'
import { buildRequestParts } from './buildRequestParts.js'
import { sendWithRetry } from './sendWithRetry.js'
import { parseResponse } from './parseResponse.js'


/**
 * Send a new message to LLM provider
 * 
 * @param {Object} params
 * @param {string} params.userText - New user message text
 * @param {string[]} params.pendingImageIds - Attached image IDs for the new message
 * @param {string} params.topicId - Topic ID
 * @param {string} params.modelId - Model ID
 * @param {string[]} params.visiblePairIds - WYSIWYG history pair IDs
 * @param {string|null} params.activePartId - Currently focused part ID
 * @param {Object} params.store - Message store
 * @param {string|null} params.editingPairId - Pair ID if re-asking
 * @returns {Promise<string>} Created pair ID
 */
export async function sendNewMessage({
  userText,
  pendingImageIds,
  topicId,
  modelId,
  visiblePairIds,
  activePartId,
  store,
  editingPairId,
}) {
  
  // Phase 1: Load visible pairs and send configuration (gets all dependencies internally)
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
    store,
  })
  console.log('[sendNewMessage] Phase 1 completed.', {
    systemMessage,
    visiblePairsCount: visiblePairs.length,
    providerId,
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
  console.log('[sendNewMessage] Phase 2 completed. Selected pairs:', context)
  
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
    maxRetries: 5,
    signal: null,  // Add abort controller
  })
  console.log('[sendNewMessage] Phase 4 completed. RawResponse:', rawResponse)
  
  // Phase 5: Parse provider response (extract code, equations, metadata)
  const parsedResponse = parseResponse(rawResponse)
  console.log('[sendNewMessage] Phase 5 completed. ParsedResponse:', parsedResponse)
  
  // Phase 6: Store pair
  
  // Implement phase 6
  
  // Phase 7: Update UI
  
  // Implement phase 7
}
