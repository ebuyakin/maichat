// Phase 2: Select context pairs that fit in budget

/**
 * Calculate how much budget is available for history
 * Deducts system + new user + ARA from model's max context
 */
async function calculateHistoryAllowance({
  model,
  systemMessage,
  userText,
  imageIds,
  provider,
  settings,
  getModelBudget,
  getImageMetadata,
  estimateTextTokens,
  estimateImageTokens,
}) {
  const maxContext = getModelBudget(model)
  const ARA = settings.assistantResponseAllowance || 0
  
  // System tokens
  const systemTokens = estimateTextTokens(systemMessage || '', provider, settings)
  
  // User text tokens
  const userTextTokens = estimateTextTokens(userText || '', provider, settings)
  
  // User image tokens
  let userImageTokens = 0
  if (imageIds?.length > 0) {
    const images = await getImageMetadata(imageIds)
    for (const img of images) {
      userImageTokens += estimateImageTokens({
        width: img.w,
        height: img.h,
        provider
      })
    }
  }
  
  const newUserTokens = userTextTokens + userImageTokens
  const reserved = systemTokens + newUserTokens + ARA
  
  return maxContext - reserved
}

/**
 * Estimate tokens for a single pair
 * Priority: stored > estimated > calculate
 * 
 * For user: stored estimated > calculate
 * For assistant: stored reported > stored estimated > calculate
 */
function estimatePairTokens(pair, provider, settings, estimateTextTokens) {
  // User tokens (stored estimated > calculate)
  const userTokens = 
    pair.tokenMetrics?.userEstimatedTokens ||
    estimateTextTokens(pair.userText || '', provider, settings)
  
  // Assistant tokens (stored reported > stored estimated > calculate)
  const assistantTokens = 
    pair.tokenMetrics?.assistantReportedTokens ||
    pair.tokenMetrics?.assistantEstimatedTokens ||
    estimateTextTokens(pair.assistantText || '', provider, settings)
  
  // Image tokens (from tokenMetrics)
  const imageTokens = pair.tokenMetrics?.imageTokensByProvider?.[provider] || 0
  
  return userTokens + assistantTokens + imageTokens
}

/**
 * Select which history pairs fit in context window
 * 
 * @param {Object} params
 * @param {MessagePair[]} params.visiblePairs - Visible history pairs
 * @param {string} params.systemMessage - Topic system message
 * @param {string} params.userText - New user text
 * @param {string[]} params.imageIds - New user images
 * @param {string} params.model - Model ID
 * @param {string} params.provider - Provider ID
 * @param {Object} params.settings - App settings (URA, ARA, charsPerToken)
 * @param {Function} params.estimateTextTokens - Token estimation function
 * @param {Function} params.estimateImageTokens - Image token estimation function
 * @param {Function} params.getModelBudget - Get model budget function
 * @param {Function} params.getImageMetadata - Get image metadata (w, h, tokenCost) without blobs
 * @returns {Promise<Object>} Selection result with selectedHistoryPairs
 */
export async function selectContextPairs({
  visiblePairs,
  systemMessage,
  userText,
  imageIds,
  model,
  provider,
  settings,
  estimateTextTokens,
  estimateImageTokens,
  getModelBudget,
  getImageMetadata,
}) {
  // 1. Calculate available budget for history
  const historyAllowance = await calculateHistoryAllowance({
    model,
    systemMessage,
    userText,
    imageIds,
    provider,
    settings,
    getModelBudget,
    getImageMetadata,
    estimateTextTokens,
    estimateImageTokens,
  })
  
  // 2. Select pairs that fit (newest first, stop on overflow)
  const selectedHistoryPairs = []
  let historyTokens = 0
  
  for (let i = visiblePairs.length - 1; i >= 0; i--) {
    const pair = visiblePairs[i]
    const pairTokens = estimatePairTokens(pair, provider, settings, estimateTextTokens)
    
    if (historyTokens + pairTokens <= historyAllowance) {
      selectedHistoryPairs.unshift(pair)  // Maintain chronological order
      historyTokens += pairTokens
    } else {
      break  // Stop on first overflow
    }
  }
  
  return { selectedHistoryPairs }
}
