// Phase 1: Prepare input data for sending

/**
 * Prepare and validate input data
 * 
 * @param {Object} params
 * @param {string} params.topicId - Topic ID
 * @param {string[]} params.visiblePairIds - Visible pair IDs
 * @param {string} params.model - Model ID
 * @param {Object} params.store - Message store
 * @param {Function} params.getSettings - Get app settings function
 * @param {Function} params.getModelMeta - Get model metadata function
 * @param {Function} params.getApiKey - Get API key function
 * @returns {Object} Prepared data
 */
export function prepareInputData({ 
  topicId, 
  visiblePairIds, 
  model, 
  store,
  getSettings,
  getModelMeta,
  getApiKey,
}) {
  // Get dependencies
  const settings = getSettings()
  const modelMeta = getModelMeta(model)
  
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
  const provider = modelMeta?.provider || 'openai'
  
  // Get API key for provider
  const apiKey = getApiKey(provider)
  
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
    provider,
    apiKey,
    options,
  }
}
