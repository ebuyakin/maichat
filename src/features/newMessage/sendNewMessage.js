// Main orchestrator for sending new messages

// dependendices (external to newMessageRoutine):
import { getSettings } from '../../core/settings/index.js'
import { getModelMeta } from '../../core/models/modelCatalog.js'

import { estimateTokens, estimatePairTokens, estimateImageTokens } from '../../core/context/tokenEstimator.js'
import { getModelBudget } from '../../core/context/tokenEstimator.js'

import { getManyMetadata as getImageMetadata } from '../images/imageStore.js'
import { getBase64Many } from '../images/imageStore.js'

import { PROVIDERS } from '../../infrastructure/provider/adapterV2.js'
import { getApiKey } from '../../infrastructure/api/keys.js'

// sub routines (internal to newMessageRoutine):
import { prepareInputData } from './prepareInputData.js'
import { calculateBudget } from './calculateBudget.js'
import { buildRequest } from './buildRequest.js'
import { sendWithRetry } from './sendWithRetry.js'

/**
 * Send a new message to LLM provider
 * 
 * @param {Object} params
 * @param {string} params.userText - New user message text
 * @param {string[]} params.imageIds - Attached image IDs
 * @param {string} params.topicId - Topic ID
 * @param {string} params.model - Model ID
 * @param {string[]} params.visiblePairIds - WYSIWYG history pair IDs
 * @param {string|null} params.activePartId - Currently focused part ID
 * @param {Object} params.store - Message store
 * @param {string|null} params.editingPairId - Pair ID if re-asking
 * @returns {Promise<string>} Created pair ID
 */
export async function sendNewMessage({
  userText,
  imageIds,
  topicId,
  model,
  visiblePairIds,
  activePartId,
  store,
  editingPairId,
}) {
  console.log('[sendNewMessage] Phase 1: Prepare input data')
  
  // Get dependencies
  const settings = getSettings()
  const modelMeta = getModelMeta(model)
  
  // Phase 1: Prepare input data
  const prepared = prepareInputData({
    topicId,
    visiblePairIds,
    model,
    store,
    settings,
    modelMeta,
  })
  console.log('[sendNewMessage] Prepared:', prepared)
  console.log('[sendNewMessage] Phase 2: Calculate budget')
  
  // Phase 2: Calculate context budget
  const budget = await calculateBudget({
    visiblePairs: prepared.visiblePairs,
    systemMessage: prepared.systemMessage,
    userText,
    imageIds,
    model,
    provider: prepared.provider,
    settings: prepared.settings,
    // Inject functions
    estimateTokens,
    estimatePairTokens,
    estimateImageTokens,
    getModelBudget,
    getImageMetadata,  // Only loads metadata, not blobs
  })
  console.log('[sendNewMessage] Budget:', budget)
  console.log('[sendNewMessage] Phase 3: Build API request (with batch image encoding)')
  
  // Phase 3: Build API request (batch encodes all images in one transaction)
  const request = await buildRequest({
    selectedPairs: budget.selectedPairs,
    systemMessage: prepared.systemMessage,
    userText,
    imageIds,
    model,
    getBase64Many,  // Batch encoding function
  })
  console.log('[sendNewMessage] Request:', request)
  
  console.log('[sendNewMessage] Phase 4: Send to provider with retry')
  
  // Get API key for provider
  const apiKey = getApiKey(prepared.provider)
  
  // Build options
  const options = {
    // TODO: Get from settings/topic
    temperature: undefined,
    maxOutputTokens: undefined,
    webSearch: false,
  }
  
  // Phase 4: Send to provider with retry
  const response = await sendWithRetry({
    request,
    provider: prepared.provider,
    model,
    apiKey,
    options,
    maxRetries: 3,
    providers: PROVIDERS,  // Direct provider map
    signal: null,  // TODO: Add abort controller
  })
  console.log('[sendNewMessage] Response:', response)
  
  // Phase 5: Store result
  
  // TODO: Implement phase 5
}
