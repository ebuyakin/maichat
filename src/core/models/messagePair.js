// Moved from src/models/messagePair.js (Phase 5 core move)
// MessagePair model definition (JSDoc typedef + helper factory)
/**
 * @typedef {Object} MessagePair
 * @property {string} id
 * @property {number} createdAt - ms epoch
 * @property {string} topicId
 * @property {string} model
 * @property {number} star - 0..3 integer
 * @property {'b'|'g'} colorFlag - simple user flag (b=blue flagged, g=grey unflagged)
 * @property {string} userText
 * @property {string} assistantText
 * @property {('idle'|'sending'|'error'|'complete')} lifecycleState
 * @property {string|undefined} errorMessage
 * @property {number|undefined} tokenLength
 */
export function createMessagePair({ id, topicId, model, userText, assistantText, createdAt = Date.now() }) {
  return { id, createdAt, topicId, model, star:0, colorFlag:'b', userText, assistantText, lifecycleState:'idle', errorMessage:undefined, tokenLength:undefined }
}
