// Phase 5a: Update pair with successful response

/**
 * Update pair with successful response
 * 
 * @param {Object} params
 * @param {string} params.pairId - Pair ID to update
 * @param {Object} params.response - Provider response
 * @param {string} params.response.content - Response text
 * @param {Object} params.response.tokenUsage - Token usage stats
 * @param {number} params.response.responseMs - Response time
 * @param {string[]} [params.response.citations] - Citation URLs
 * @param {Object} [params.response.citationsMeta] - Citation metadata
 * @param {Object} [params.previousResponse] - Previous response (for re-ask)
 * @param {Object} params.store - Message store
 */
export function updatePairSuccess({ pairId, response, previousResponse, store }) {
  // Update with response content
  store.updatePair(pairId, {
    assistantText: response.content,
    assistantChars: response.content.length,
    assistantProviderTokens: response.tokenUsage?.completionTokens,
    responseMs: response.responseMs,
    lifecycleState: 'complete',
    errorMessage: undefined,
  })
  
  // Store citations if present
  if (response.citations && response.citations.length > 0) {
    // TODO: Implement citation storage
    // Need to design how citations are stored in pair
  }
  
  // If re-ask: store previous response
  if (previousResponse) {
    store.updatePair(pairId, {
      previousAssistantText: previousResponse.assistantText,
      previousModel: previousResponse.model,
      previousAssistantProviderTokens: previousResponse.assistantProviderTokens,
      previousResponseMs: previousResponse.responseMs,
      replacedAt: Date.now(),
    })
  }
}
