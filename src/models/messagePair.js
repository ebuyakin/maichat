// MessagePair model definition (JSDoc typedef + helper factory)

/**
 * @typedef {Object} MessagePair
 * @property {string} id
 * @property {number} createdAt - ms epoch
 * @property {string} topicId
 * @property {string} model
 * @property {number} star - 0..3 integer
 * @property {boolean} includeInContext
 * @property {string} userText
 * @property {string} assistantText
 * @property {('idle'|'sending'|'error'|'complete')} lifecycleState
 * @property {string|undefined} errorMessage
 * @property {number|undefined} tokenLength  // cached estimated total tokens (user+assistant)
 */

/**
 * Create a new MessagePair.
 * @param {Object} params
 * @param {string} params.id
 * @param {string} params.topicId
 * @param {string} params.model
 * @param {string} params.userText
 * @param {string} params.assistantText
 * @param {number} [params.createdAt=Date.now()]
 * @returns {MessagePair}
 */
export function createMessagePair({ id, topicId, model, userText, assistantText, createdAt = Date.now() }) {
  return {
    id,
    createdAt,
    topicId,
    model,
    star: 0,
    includeInContext: true,
    userText,
    assistantText,
    lifecycleState: 'idle',
    errorMessage: undefined,
    tokenLength: undefined
  }
}
