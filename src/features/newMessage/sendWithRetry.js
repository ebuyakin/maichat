// Phase 4: Send with retry logic

import { AdapterError, ADAPTERS } from '../../infrastructure/provider/adapterV2.js'
import { getApiKey } from '../../infrastructure/api/keys.js'

/**
 * Send request to provider with retry on overflow
 * 
 * @param {Object} params
 * @param {Object} params.requestParts - Provider-agnostic request parts (text + images)
 * @param {string} params.providerId - Provider ID
 * @param {string} params.modelId - Model ID
 * @param {string} params.systemMessage - Topic system message
 * @param {Object} params.options - Request options (temperature, webSearch, etc.)
 * @param {number} params.maxRetries - Max retry attempts
 * @param {AbortSignal} params.signal - Abort signal for cancellation
 * @param {number[]} params.selectedPairsTokens - Token costs for each history pair (parallel to parts)
 * @param {number} params.fullPromptEstimatedTokens - Initial estimated prompt tokens
 * @returns {Promise<Object>} { response, fullPromptEstimatedTokens }
 */
export async function sendWithRetry({
  requestParts,
  selectedPairsTokens,
  fullPromptEstimatedTokens,
  providerId,
  modelId,
  systemMessage,
  options,
  maxRetries,
  signal,
}) {
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
  let currentPromptTokens = fullPromptEstimatedTokens
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
      return {
        rawResponse: response,
        finalPromptEstimatedTokens: currentPromptTokens,
      }
      
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
      
      // Also remove corresponding token cost from estimate
      const trimmedPairTokens = currentPairTokens.shift()
      if (trimmedPairTokens) {
        currentPromptTokens -= trimmedPairTokens
      }
      
      attempt++

      console.log(
        `[sendWithRetry] Usage limit exceeded, removed oldest pair. Retry ${attempt}/${maxRetries}`,
      )
    }
  }
  
  // Exhausted all retries
  throw new Error('Max retries exceeded - context still too large')
}