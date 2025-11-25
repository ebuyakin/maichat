// Phase 3: Send with retry logic

import { AdapterError, ADAPTERS } from '../../infrastructure/provider/adapterV2.js'
import { getApiKey } from '../../infrastructure/api/keys.js'
import { getStore } from '../../runtime/runtimeServices.js'
import { getModelMeta } from '../../core/models/modelCatalog.js'

/**
 * Load request configuration from topic and model
 * @param {string} topicId - Topic ID
 * @param {string} modelId - Model ID
 * @returns {Object} { providerId, systemMessage, options }
 */
function loadRequestConfig(topicId, modelId) {
  const store = getStore()
  const modelMeta = getModelMeta(modelId)
  const topic = store.topics.get(topicId)
  
  const providerId = modelMeta?.provider || 'openai'
  const systemMessage = topic?.systemMessage?.trim() || ''
  
  // Build request options
  const options = {}
  const requestParams = topic?.requestParams || {}
  
  if (typeof requestParams.temperature === 'number') {
    options.temperature = requestParams.temperature
  }
  
  if (typeof requestParams.maxOutputTokens === 'number') {
    options.maxOutputTokens = requestParams.maxOutputTokens
  }
  
  // Web search: topic override takes precedence over model default
  let webSearch = modelMeta?.webSearch
  if (typeof topic?.webSearchOverride === 'boolean') {
    webSearch = topic.webSearchOverride
  }
  if (typeof webSearch === 'boolean') {
    options.webSearch = webSearch
  }
  
  return { providerId, systemMessage, options }
}

/**
 * Send request to provider with retry on overflow
 * Loads configuration internally (systemMessage, options, providerId)
 * 
 * @param {Object} params
 * @param {Object} params.requestParts - Provider-agnostic request parts (text + images)
 * @param {number[]} params.selectedPairsTokens - Token costs for each history pair
 * @param {string} params.topicId - Topic ID (for loading systemMessage and options)
 * @param {string} params.modelId - Model ID
 * @param {number} params.maxRetries - Max retry attempts
 * @param {AbortSignal} params.signal - Abort signal for cancellation
 * @returns {Promise<Object>} { response, historyTokens }
 */
export async function sendWithRetry({
  requestParts,
  selectedPairsTokens,
  topicId,
  modelId,
  maxRetries,
  signal,
}) {
  // Load configuration
  const { providerId, systemMessage, options } = loadRequestConfig(topicId, modelId)
  
  // Get provider adapter
  const adapter = ADAPTERS[providerId]
  if (!adapter) {
    throw new Error(`Unknown provider: ${providerId}`)
  }
  
  // Resolve API key for provider
  const apiKey = getApiKey(providerId)

  // Clone request parts for mutation during retries
  let currentRequest = { parts: [...requestParts] }
  let currentPairTokens = [...selectedPairsTokens]  // Clone for mutation
  let attempt = 0
  
  while (attempt <= maxRetries) {
    try {
      // Send to provider
      const response = await adapter.sendChat({
        model: modelId,
        messages: currentRequest.parts,
        system: systemMessage,
        apiKey,
        signal,
        options,
      })
      
      // Success!
      const historyTokens = currentPairTokens.reduce((sum, tokens) => sum + tokens, 0)
      return { response, historyTokens }
      
    } catch (err) {
      // Check if error is usage limit exceeded (rate limit or context overflow)
      const isUsageLimitError = err instanceof AdapterError && err.code === 'exceededUsageLimit'
      
      if (!isUsageLimitError) {
        // Non-overflow error - throw immediately
        throw err
      }
      
      // Usage limit exceeded - try removing oldest message pair
      if (currentRequest.parts.length <= 1) {
        // Only the new user message left - can't trim further
        throw new Error('Cannot trim further - single message exceeds context limit')
      }

      // Remove oldest pair (first user + first assistant)
      currentRequest.parts.splice(0, 2)
      
      // Also remove corresponding token cost
      currentPairTokens.shift()
      
      attempt++

      console.log(
        `[sendWithRetry] Usage limit exceeded, removed oldest pair. Retry ${attempt}/${maxRetries}`,
      )
    }
  }
  
  // Exhausted all retries
  throw new Error('Max retries exceeded - context still too large')
}