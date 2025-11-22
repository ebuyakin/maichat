// Phase 1: Select context pairs that fit in budget

import { getStore } from '../../runtime/runtimeServices.js'
import { getSettings } from '../../core/settings/index.js'
import { getModelMeta } from '../../core/models/modelCatalog.js'
import { getModelBudget } from '../../core/context/tokenEstimator.js'
import { estimateTextTokens } from '../../infrastructure/provider/tokenEstimation/budgetEstimator.js'

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
  const userTextTokens = newMessagePair.userTextTokens || 0
  const userImageTokens = newMessagePair.attachmentTokens || 0
  
  return maxContext - userTextTokens - userImageTokens - systemTokens - ARA
}

/**
 * Estimate tokens for a single pair
 * Priority: stored > calculated
 * 
 * For user: stored userTextTokens > calculate
 * For assistant: provider-reported > stored estimated > calculate
 * For images: use imageBudgets for provider-specific cost
 */
function estimatePairTokens(pair, providerId, settings, estimateTextTokens) {
  // User tokens (stored > calculate)
  const userTokens =
    pair.userTextTokens ||
    estimateTextTokens(pair.userText || '', providerId, settings)
  
  // Assistant tokens (provider-reported > stored estimated > calculate)
  const assistantTokens =
    pair.assistantProviderTokens ||
    pair.assistantTextTokens ||
    estimateTextTokens(pair.assistantText || '', providerId, settings)
  
  // Image tokens (from imageBudgets with provider-specific costs)
  let imageTokens = 0
  if (pair.imageBudgets && pair.imageBudgets.length > 0) {
    for (const imgBudget of pair.imageBudgets) {
      imageTokens += (imgBudget.tokenCost && imgBudget.tokenCost[providerId]) || 0
    }
  }
  
  return userTokens + assistantTokens + imageTokens
}

/**
 * Select context pairs that fit in model's context window
 * Loads config data from store and selects pairs that fit in budget
 * 
 * @param {Object} params
 * @param {string} params.topicId - Topic ID
 * @param {string[]} params.visiblePairIds - Visible pair IDs from UI
 * @param {MessagePair} params.newMessagePair - The new message pair (from Phase 0)
 * @param {string} params.modelId - Model ID
 * @returns {Promise<Object>} { selectedPairs, systemMessage, providerId, options }
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
  
  // Build request options with proper precedence
  const options = {}
  
  // Temperature: from topic requestParams if set
  const requestParams = topic?.requestParams || {}
  if (typeof requestParams.temperature === 'number') {
    options.temperature = requestParams.temperature
  }
  
  // Max output tokens: from topic requestParams if set
  if (typeof requestParams.maxOutputTokens === 'number') {
    options.maxOutputTokens = requestParams.maxOutputTokens
  }
  
  // Web search: topic override takes precedence over model default
  let webSearch = modelMeta?.webSearch  // Model default
  if (typeof topic?.webSearchOverride === 'boolean') {
    webSearch = topic.webSearchOverride  // Topic override wins
  }
  if (typeof webSearch === 'boolean') {
    options.webSearch = webSearch
  }
  
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
    const pairTokens = estimatePairTokens(
      pair,
      providerId,
      settings,
      estimateTextTokens,
    )
    
    if (historyTokens + pairTokens <= historyAllowance) {
      selectedPairs.unshift(pair)  // Maintain chronological order
      selectedPairsTokens.unshift(pairTokens)  // Parallel array
      historyTokens += pairTokens
    } else {
      break  // Stop on first overflow
    }
  }
  
  // Calculate full prompt estimated tokens (system + user + history)
  const systemTokens = estimateTextTokens(systemMessage || '', providerId, settings)
  const userTextTokens = newMessagePair.userTextTokens || 0
  const userImageTokens = newMessagePair.attachmentTokens || 0
  const fullPromptEstimatedTokens = systemTokens + userTextTokens + userImageTokens + historyTokens
  
  return {
    selectedPairs,
    selectedPairsTokens,
    fullPromptEstimatedTokens,
    systemMessage,
    providerId,
    options,
  }
}