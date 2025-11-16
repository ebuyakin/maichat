// Phase 1: Prepare input data for sending

/**
 * Prepare and validate input data
 * 
 * @param {Object} params
 * @param {string} params.topicId - Topic ID
 * @param {string[]} params.visiblePairIds - Visible pair IDs
 * @param {string} params.model - Model ID
 * @param {Object} params.store - Message store
 * @param {Object} params.settings - App settings
 * @param {Object} params.modelMeta - Model metadata
 * @returns {Object} Prepared data
 */
export function prepareInputData({ topicId, visiblePairIds, model, store, settings, modelMeta }) {
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
  
  return {
    systemMessage,
    visiblePairs,
    settings,
    provider,
  }
}
