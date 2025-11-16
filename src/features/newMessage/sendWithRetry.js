// Phase 4: Send with retry logic

/**
 * Send request to provider with retry on overflow
 * 
 * @param {Object} params
 * @param {Object} params.request - Universal request object
 * @param {string} params.provider - Provider ID
 * @param {string} params.model - Model ID
 * @param {number} params.maxRetries - Max retry attempts
 * @returns {Promise<Object>} Provider response
 */
export async function sendWithRetry({
  request,
  provider,
  model,
  maxRetries,
}) {
  // Get provider adapter
  
  // Retry loop:
  //   - Translate to provider format
  //   - Send HTTP request
  //   - If context overflow: remove oldest pair, retry
  //   - If other error: throw
  //   - If success: return response
  
  // TODO: Implement
  throw new Error('Not implemented')
}
