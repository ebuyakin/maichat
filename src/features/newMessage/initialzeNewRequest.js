// Phase 0a: Create new message pair

/**
 * Create new pair for true new message
 * 
 * @param {Object} params
 * @param {string} params.userText - User message text
 * @param {string[]} params.imageIds - Attached image IDs
 * @param {string} params.topicId - Topic ID
 * @param {string} params.model - Model ID
 * @param {Object} params.store - Message store
 * @returns {string} Created pair ID
 */
export function initializeNewRequest({ userText, imageIds, topicId, model, store }) {
  // Create pair with empty assistant text
  const pairId = store.addMessagePair({
    topicId,
    model,
    userText,
    assistantText: '',
  })
  
  // Add metadata
  store.updatePair(pairId, {
    attachments: imageIds,
    lifecycleState: 'sending',
  })
  
  return pairId
}
