// Phase 1: Select context pairs that fit in budget

import { getStore } from '../../runtime/runtimeServices.js'
import { getSettings } from '../../core/settings/index.js'
import { getModelMeta } from '../../core/models/modelCatalog.js'
import { getModelBudget } from '../../core/context/tokenEstimator.js'
import { 
  estimateTextTokens,
  calculateEstimatedTokenUsageBatch 
} from '../../infrastructure/provider/tokenEstimation/budgetEstimator.js'

/**
 * Calculate how much budget is available for history
 * Deducts system + new user + ARA from model's max context
 */
async function calculateHistoryAllowance({
  modelId,
  systemMessage,
  newMessagePair,
  providerId,
  settings,
}) {
  const budget = getModelBudget(modelId)
  const maxContext = budget.maxContext

  const ARA = settings.assistantResponseAllowance || 0
  const systemTokens = estimateTextTokens(systemMessage || '', providerId, settings)
  
  // Get user tokens from new pair's estimatedTokenUsage (user + images, no assistant yet)
  const userTokens = newMessagePair.estimatedTokenUsage?.[providerId] || 0
  
  return maxContext - userTokens - systemTokens - ARA
}

/**
 * Recalculate and update token estimates for pairs with stale cache
 * @param {MessagePair[]} pairs - All visible pairs
 * @param {string} currentVersion - Current token estimation version
 */
async function refreshStaleTokenEstimates(pairs, currentVersion) {
  const store = getStore()
  
  const stalePairs = pairs.filter(
    p => p.estimatedTokenUsage?._version !== currentVersion
  )
  
  if (stalePairs.length === 0) return
  
  const batchResults = await calculateEstimatedTokenUsageBatch(stalePairs)
  
  for (const pair of stalePairs) {
    const estimatedTokenUsage = batchResults[pair.id]
    store.updatePair(pair.id, { estimatedTokenUsage })
    // Update in-memory object
    pair.estimatedTokenUsage = estimatedTokenUsage
  }
}

/**
 * Select context pairs that fit in model's context window
 * Pure selection based on token budget - returns pairs, costs, and system tokens
 * 
 * @param {Object} params
 * @param {string} params.topicId - Topic ID
 * @param {string[]} params.visiblePairIds - Visible pair IDs from UI
 * @param {MessagePair} params.newMessagePair - The new message pair (from Phase 0)
 * @param {string} params.modelId - Model ID
 * @returns {Promise<Object>} { selectedPairs, selectedPairsTokens, systemTokens }
 */
export async function selectContextPairs({
  topicId,
  visiblePairIds,
  newMessagePair,
  modelId,
}) {
  // Load data from store
  const store = getStore()
  const settings = getSettings()
  const modelMeta = getModelMeta(modelId)
  const currentVersion = settings.tokenEstimationVersion || 'v1'
  
  // Get topic and system message
  const topic = store.topics.get(topicId)
  const systemMessage = topic?.systemMessage?.trim() || ''
  
  // Convert pair IDs to MessagePair objects
  const uniquePairIds = [...new Set(visiblePairIds)]
  const visiblePairs = uniquePairIds
    .map(id => store.pairs.get(id))
    .filter(Boolean)
    .sort((a, b) => a.createdAt - b.createdAt)
  
  // Get provider from model metadata
  const providerId = modelMeta?.provider || 'openai'
  
  // Refresh stale token estimates (batch recalculation)
  await refreshStaleTokenEstimates(visiblePairs, currentVersion)
  
  // Calculate system message tokens (for telemetry)
  const systemTokens = estimateTextTokens(systemMessage, providerId, settings)
  
  // Calculate available budget for history
  const historyAllowance = await calculateHistoryAllowance({
    modelId,
    systemMessage,
    newMessagePair,
    providerId,
    settings,
  })
  
  // Select pairs that fit (newest first, stop on overflow)
  const selectedPairs = []
  const selectedPairsTokens = []  // Parallel array of token costs
  let historyTokens = 0
  
  for (let i = visiblePairs.length - 1; i >= 0; i--) {
    const pair = visiblePairs[i]
    const pairTokens = pair.estimatedTokenUsage?.[providerId] || 0
    
    if (historyTokens + pairTokens <= historyAllowance) {
      selectedPairs.unshift(pair)  // Maintain chronological order
      selectedPairsTokens.unshift(pairTokens)  // Parallel array
      historyTokens += pairTokens
    } else {
      break  // Stop on first overflow
    }
  }
  
  return {
    selectedPairs,
    selectedPairsTokens,
    systemTokens,
  }
}