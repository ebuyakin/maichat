// Phase 4: Send with retry logic

/**
 * Send request to provider with retry on overflow
 * 
 * @param {Object} params
 * @param {Object} params.request - Universal request object (with encoded images)
 * @param {string} params.provider - Provider ID
 * @param {string} params.model - Model ID
 * @param {string} params.apiKey - API key for provider
 * @param {Object} params.options - Request options (temperature, webSearch, etc.)
 * @param {number} params.maxRetries - Max retry attempts
 * @param {Object} params.providers - Provider adapters map
 * @param {AbortSignal} params.signal - Abort signal for cancellation
 * @returns {Promise<Object>} Provider response
 */
export async function sendWithRetry({
  request,
  provider,
  model,
  apiKey,
  options,
  maxRetries,
  providers,
  signal,
}) {
  // Get provider adapter
  const adapter = providers[provider]
  if (!adapter) {
    throw new Error(`Unknown provider: ${provider}`)
  }
  
  // Clone request for mutation during retries
  let currentRequest = { ...request, messages: [...request.messages] }
  let attempt = 0
  
  while (attempt <= maxRetries) {
    try {
      // Send to provider
      const response = await adapter.sendChat({
        model,
        messages: currentRequest.messages,
        system: currentRequest.system,
        apiKey,
        signal,
        options,
      })
      
      // Success!
      return response
      
    } catch (err) {
      // Check if error is context overflow
      const isOverflow = err.message === 'context_overflow' || 
                        err.message === 'context_length_exceeded' ||
                        /context.*too.*large/i.test(err.message)
      
      if (!isOverflow) {
        // Non-overflow error - throw immediately
        throw err
      }
      
      // Context overflow - try removing oldest message pair
      if (currentRequest.messages.length < 3) {
        // Need at least 1 pair (user + assistant) + new user message
        throw new Error('Cannot trim further - minimum context exceeded')
      }
      
      // Remove oldest pair (first user + first assistant)
      currentRequest.messages.splice(0, 2)
      attempt++
      
      console.log(`[sendWithRetry] Context overflow, removed oldest pair. Retry ${attempt}/${maxRetries}`)
    }
  }
  
  // Exhausted all retries
  throw new Error('Max retries exceeded - context still too large')
}
