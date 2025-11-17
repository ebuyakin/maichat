// Main orchestrator for sending new messages

// dependendices (external to newMessageRoutine):
// user and model settings
import { getSettings } from '../../core/settings/index.js'
import { getModelMeta } from '../../core/models/modelCatalog.js'

// image utilities
import { getModelBudget } from '../../core/context/tokenEstimator.js'
import { getManyMetadata as getImageMetadata } from '../images/imageStore.js'
import { getBase64Many } from '../images/imageStore.js'

// api adapters and keys
import { PROVIDERS } from '../../infrastructure/provider/adapterV2.js'
import { getApiKey } from '../../infrastructure/api/keys.js'

// Token estimation (new)
import { estimateTextTokens, estimateImageTokens } from '../../infrastructure/provider/tokenEstimation/budgetEstimator.js'

// sub routines (internal to newMessageRoutine):
import { prepareInputData } from './prepareInputData.js'
import { selectContextPairs } from './selectContextPairs.js'
import { buildRequest } from './buildRequest.js'
import { sendWithRetry } from './sendWithRetry.js'
import { parseResponse } from './parseResponse.js'


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
  
  // Phase 1: Prepare input data (gets all dependencies internally)
  const prepared = prepareInputData({
    topicId,
    visiblePairIds,
    model,
    store,
    getSettings,
    getModelMeta,
    getApiKey,
  })
  console.log('[sendNewMessage] Prepared:', prepared)
  console.log('[sendNewMessage] Phase 2: Select context pairs')
  
  // Phase 2: Select which history pairs fit in context
  const context = await selectContextPairs({
    visiblePairs: prepared.visiblePairs,
    systemMessage: prepared.systemMessage,
    userText,
    imageIds,
    model,
    provider: prepared.provider,
    settings: prepared.settings,
    // Inject functions
    estimateTextTokens,
    estimateImageTokens,
    getModelBudget,
    getImageMetadata,  // Only loads metadata, not blobs
  })
  console.log('[sendNewMessage] Context:', context)
  console.log('[sendNewMessage] Phase 3: Build API request (with batch image encoding)')
  
  // Phase 3: Build API request (batch encodes all images in one transaction)
  const request = await buildRequest({
    selectedPairs: context.selectedHistoryPairs,
    systemMessage: prepared.systemMessage,
    userText,
    imageIds,
    model,
    getBase64Many,  // Batch encoding function
  })
  console.log('[sendNewMessage] Request:', request)
  console.log('[sendNewMessage] Phase 4: Send to provider with retry')
  
  // Phase 4: Send to provider with retry
  const response = await sendWithRetry({
    request,
    provider: prepared.provider,
    model,
    apiKey: prepared.apiKey,
    options: prepared.options,
    maxRetries: 3,
    providers: PROVIDERS,
    signal: null,  // Add abort controller
  })
  console.log('[sendNewMessage] Response:', response)
  console.log('[sendNewMessage] Phase 5: Parse response')
  
  // Phase 5: Parse provider response (extract code, equations, metadata)
  const parsed = parseResponse({ response })
  console.log('[sendNewMessage] Parsed:', parsed)
  
  // Phase 6: Store pair
  
  // Implement phase 6
  
  // Phase 7: Update UI
  
  // Implement phase 7
}
