// Phase 2: Calculate context budget

/**
 * Calculate which history pairs fit in context window
 * 
 * @param {Object} params
 * @param {MessagePair[]} params.visiblePairs - Visible history pairs
 * @param {string} params.systemMessage - Topic system message
 * @param {string} params.userText - New user text
 * @param {string[]} params.imageIds - New user images
 * @param {string} params.model - Model ID
 * @param {string} params.provider - Provider ID
 * @param {Object} params.settings - App settings (URA, ARA, charsPerToken)
 * @param {Function} params.estimateTokens - Token estimation function
 * @param {Function} params.estimatePairTokens - Pair token estimation function
 * @param {Function} params.estimateImageTokens - Image token estimation function
 * @param {Function} params.getModelBudget - Get model budget function
 * @param {Function} params.getImageMetadata - Get image metadata (w, h, tokenCost) without blobs
 * @returns {Promise<Object>} Budget result with selected pairs and token breakdown
 */
export async function calculateBudget({
  visiblePairs,
  systemMessage,
  userText,
  imageIds,
  model,
  provider,
  settings,
  estimateTokens,
  estimatePairTokens,
  estimateImageTokens,
  getModelBudget,
  getImageMetadata,
}) {
  const charsPerToken = settings.charsPerToken || 4
  const URA = settings.userRequestAllowance || 0
  const ARA = settings.assistantResponseAllowance || 0
  
  // 1. Estimate system message tokens
  const systemTokens = systemMessage ? estimateTokens(systemMessage, charsPerToken) : 0
  
  // 2. Estimate new user text tokens
  const userTextTokens = estimateTokens(userText || '', charsPerToken)
  
  // 3. Estimate new user image tokens
  let userImageTokens = 0
  if (imageIds && imageIds.length > 0) {
    const images = await getImageMetadata(imageIds)
    for (const img of images) {
      if (img && img.w && img.h) {
        userImageTokens += estimateImageTokens({ w: img.w, h: img.h }, provider, model)
      }
    }
  }
  
  const newUserTokens = userTextTokens + userImageTokens
  
  // 4. Get model context limit
  const { maxContext } = getModelBudget(model)
  
  // 5. Calculate reserves
  // PARA: Provider-specific Assistant Response Allowance (OpenAI needs this, others don't)
  const PARA = provider === 'openai' ? ARA : 0
  
  const totalReserves = systemTokens + newUserTokens + PARA
  
  // 6. Check if new content alone overflows
  if (totalReserves > maxContext) {
    throw new Error('new_content_too_large')
  }
  
  // 7. Calculate available space for history
  const historyLimit = maxContext - totalReserves
  
  // 8. Select history pairs (newest first) and cache tokens
  const pairTokens = new Map()
  let historyTokens = 0
  const selectedPairs = []
  
  // Work backwards (newest to oldest)
  for (let i = visiblePairs.length - 1; i >= 0; i--) {
    const pair = visiblePairs[i]
    const tokens = estimatePairTokens(pair, charsPerToken, provider)
    
    // Cache token count
    pairTokens.set(pair.id, tokens)
    
    // Check if it fits
    if (historyTokens + tokens <= historyLimit) {
      selectedPairs.unshift(pair)  // Add to front (maintain chronological order)
      historyTokens += tokens
    } else {
      // Stop when we overflow
      break
    }
  }
  
  // 9. Calculate totals
  const totalInputTokens = systemTokens + newUserTokens + historyTokens
  const remainingForResponse = maxContext - totalInputTokens
  
  // 10. Return budget object
  return {
    maxContext,
    selectedPairs,
    pairTokens,  // Map<pairId, tokenCount> for later use
    breakdown: {
      systemTokens,
      userTextTokens,
      userImageTokens,
      newUserTokens,
      historyTokens,
      totalInputTokens,
      remainingForResponse,
      PARA,
      historyLimit,
    }
  }
}
