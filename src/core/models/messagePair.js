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
 * @property {string} assistantText - original content (always preserved for context)
 * @property {('idle'|'sending'|'error'|'complete')} lifecycleState
 * @property {string|undefined} errorMessage
 * @property {number|undefined} tokenLength
 * @property {string|undefined} processedContent - content with code block placeholders (optional, only if code detected)
 * @property {Array<CodeBlock>|undefined} codeBlocks - extracted code blocks (optional, only if code detected)
 */

/**
 * @typedef {Object} CodeBlock
 * @property {number} index - 1-based index within the message
 * @property {string} language - detected or specified language (e.g., 'python', 'javascript', 'text')
 * @property {string} code - extracted code content (trimmed)
 * @property {number} lineCount - number of lines in code block
 * @property {number} startPos - start position in original content
 * @property {number} endPos - end position in original content
 */
export function createMessagePair({
  id,
  topicId,
  model,
  userText,
  assistantText,
  createdAt = Date.now(),
}) {
  return {
    id,
    createdAt,
    topicId,
    model,
    star: 0,
    colorFlag: 'b',
    userText,
    assistantText,
    lifecycleState: 'idle',
    errorMessage: undefined,
    tokenLength: undefined,
  }
}
