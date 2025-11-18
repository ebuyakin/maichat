// Phase 2: Select context pairs that fit in budget

import { getModelBudget } from '../../core/context/tokenEstimator.js'
import {
  estimateTextTokens,
  estimateImageTokens,
} from '../../infrastructure/provider/tokenEstimation/budgetEstimator.js'
import { getManyMetadata as getImageMetadata } from '../images/imageStore.js'

/**
 * Calculate how much budget is available for history
 * Deducts system + new user + ARA from model's max context
 */
async function calculateHistoryAllowance({
  modelId,
  systemMessage,
  userText,
  pendingImageIds,
  providerId,
  settings,
}) {
  const budget = getModelBudget(modelId)
  const maxContext = budget.maxContext
  const ARA = settings.assistantResponseAllowance || 0
  
  // System tokens
  const systemTokens = estimateTextTokens(systemMessage || '', providerId, settings)
  
  // User text tokens
  const userTextTokens = estimateTextTokens(userText || '', providerId, settings)
  
  // User image tokens (new message only)
  let userImageTokens = 0
  if (pendingImageIds?.length > 0) {
    const images = await getImageMetadata(pendingImageIds)
    for (const img of images) {
      userImageTokens += estimateImageTokens({
        width: img.w,
        height: img.h,
        provider: providerId,
      })
    }
  }
  return maxContext - userTextTokens - userImageTokens - systemTokens - ARA
}

/**
 * Estimate tokens for a single pair
 * Priority: stored > estimated > calculate
 * 
 * For user: stored estimated > calculate
 * For assistant: stored reported > stored estimated > calculate
 */
function estimatePairTokens(pair, providerId, settings, estimateTextTokens) {
  // User tokens (stored estimated > calculate)
  const userTokens =
    pair.tokenMetrics?.userEstimatedTokens ||
    estimateTextTokens(pair.userText || '', providerId, settings)
  
  // Assistant tokens (stored reported > stored estimated > calculate)
  const assistantTokens =
    pair.tokenMetrics?.assistantReportedTokens ||
    pair.tokenMetrics?.assistantEstimatedTokens ||
    estimateTextTokens(pair.assistantText || '', providerId, settings)
  
  // Image tokens (from tokenMetrics)
  const imageTokens = pair.tokenMetrics?.imageTokensByProvider?.[providerId] || 0
  
  return userTokens + assistantTokens + imageTokens
}

/**
 * Select which history pairs fit in context window
 * 
 * @param {Object} params
 * @param {MessagePair[]} params.visiblePairs - Visible history pairs
 * @param {string} params.systemMessage - Topic system message
 * @param {string} params.userText - New user text
 * @param {string[]} params.pendingImageIds - New user images (pending for this send)
 * @param {string} params.modelId - Model ID
 * @param {string} params.providerId - Provider ID
 * @param {Object} params.settings - App settings (URA, ARA, charsPerToken)
 * @returns {Promise<Object>} Selection result with selectedHistoryPairs
 */
export async function selectContextPairs({
  visiblePairs,
  systemMessage,
  userText,
  pendingImageIds,
  modelId,
  providerId,
  settings,
}) {
  // 1. Calculate available budget for history
  const historyAllowance = await calculateHistoryAllowance({
    modelId,
    systemMessage,
    userText,
    pendingImageIds,
    providerId,
    settings,
  })
  
  // 2. Select pairs that fit (newest first, stop on overflow)
  const selectedHistoryPairs = []
  let historyTokens = 0
  
  for (let i = visiblePairs.length - 1; i >= 0; i--) {
    const pair = visiblePairs[i]
    const pairTokens = estimatePairTokens(
      pair,
      providerId,
      settings,
      estimateTextTokens,
    )
    
    if (historyTokens + pairTokens <= historyAllowance) {
      selectedHistoryPairs.unshift(pair)  // Maintain chronological order
      historyTokens += pairTokens
    } else {
      break  // Stop on first overflow
    }
  }
  
  return selectedHistoryPairs
}