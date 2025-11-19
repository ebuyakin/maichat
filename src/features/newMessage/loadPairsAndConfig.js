// Phase 1: Load visible pairs and send configuration

import { getStore } from '../../runtime/runtimeServices.js'
import { getSettings } from '../../core/settings/index.js'
import { getModelMeta } from '../../core/models/modelCatalog.js'

/**
 * Load visible pairs from store and resolve model/topic configuration
 * 
 * @param {Object} params
 * @param {string} params.topicId - Topic ID
 * @param {string[]} params.visiblePairIds - Visible pair IDs
 * @param {string} params.modelId - Model ID
 * @returns {Object} Prepared data
 */
export function loadPairsAndConfig({ 
  topicId, 
  visiblePairIds, 
  modelId, 
}) {
  // Get dependencies
  const store = getStore()
  const settings = getSettings()
  const modelMeta = getModelMeta(modelId)
  
  // Get topic and system message
  const topic = store.topics.get(topicId)
  const systemMessage = topic?.systemMessage?.trim() || ''
  
  // Convert pair IDs to MessagePair objects and deduplicate
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
  
  return {
    systemMessage,
    visiblePairs,
    settings,
    providerId,
    options,
  }
}
