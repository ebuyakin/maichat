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
 * @property {string[]|undefined} attachments - image ids attached to the user message (attach order)
 * @property {('idle'|'sending'|'error'|'complete')} lifecycleState
 * @property {string|undefined} errorMessage
 * @property {number|undefined} tokenLength
 * @property {number|undefined} textTokens - precomputed total text tokens (userText + assistantText)
 * @property {number|undefined} attachmentTokens - precomputed total image tokens for all attachments
 * @property {number|undefined} responseMs - provider-reported request processing time in milliseconds
 * @property {string|undefined} previousAssistantText - previous assistant answer preserved after in-place re-ask (optional)
 * @property {string|undefined} previousModel - model used to produce the previous answer (optional)
 * @property {number|undefined} replacedAt - timestamp (ms) when in-place replacement occurred (optional)
 * @property {string|undefined} replacedBy - actor/model that initiated replacement (optional)
 * @property {number|undefined} userChars - length of userText in characters (ground truth; preferred for heuristics)
 * @property {number|undefined} assistantChars - length of assistantText in characters (ground truth; preferred for heuristics)
 * @property {{[providerModelKey:string]: number}|undefined} assistantProviderTokens - provider-reported token usage for assistant response (highest priority)
 * @property {number|undefined} previousAssistantChars - length of previousAssistantText in characters (when second opinion exists)
 * @property {{[providerModelKey:string]: number}|undefined} previousAssistantProviderTokens - provider-reported token usage for previous assistant response
 * @property {string|undefined} processedContent - content with code block placeholders (optional, only if code detected)
 * @property {Array<CodeBlock>|undefined} codeBlocks - extracted code blocks (optional, only if code detected)
 * @property {Array<EquationBlock>|undefined} equationBlocks - extracted equation blocks (optional, only if equations detected)
 * @property {string[]|undefined} citations - list of source URLs used to generate the assistant response (optional)
 * @property {{[url:string]: string}|undefined} citationsMeta - optional map of URL -> display title/label (e.g., domain) provided by the model
 * @property {Object|undefined} providerMeta - provider-specific metadata (optional; reserved for future use)
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

/**
 * @typedef {Object} EquationBlock
 * @property {number} index - 1-based index within the message
 * @property {string} raw - raw LaTeX expression
 * @property {string} unicode - Unicode fallback rendering
 * @property {'display'|'inline'} mode - display or inline equation
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
    attachments: [],
    lifecycleState: 'idle',
    errorMessage: undefined,
    tokenLength: undefined,
    // New ground-truth char fields (populated post-construction by callers)
    userChars: undefined,
    assistantChars: undefined,
    // Provider-reported assistant token usage map (highest priority for estimation)
    assistantProviderTokens: undefined,
    // Backup response metrics (for second opinion / response variants)
    previousAssistantChars: undefined,
    previousAssistantProviderTokens: undefined,
  }
}
