// Moved from src/models/messagePair.js (Phase 5 core move)
// MessagePair model definition (JSDoc typedef + helper factory)
/**
 * @typedef {Object} MessagePair
 * @property {string} id
 * 
 * 1. Core parameters. Meta line.
 * @property {number} createdAt - ms epoch. timestamp. messages ordered in history by createdAt
 * @property {string} topicId - from topic tree
 * @property {string} model - model Id. from model catalog
 * @property {number} star - 0..3 integer
 * @property {'b'|'g'} colorFlag - simple user flag (b=blue flagged, g=grey unflagged)
 * 
 * 2. User text (user request) data.
 * @property {string} userText
 * @property {string[]|undefined} attachments - image ids attached to the user message (attach order)
 * 
 * 3. Assistant response (current) data. NB: current and previous can be swapped by user
 * @property {string} assistantText - original (raw) content (always preserved for context)
 * @property {string[]|undefined} citations - list of source URLs from the assistant response (optional)
 * @property {{[url:string]: string}|undefined} citationsMeta - map of URL -> display title
 * @property {number|undefined} responseMs - provider-reported request processing time in milliseconds
 * 
 * 3.1. Assistant response extractions (stored, but can be calculated on-the-fly)
 * @property {string|undefined} processedContent - content with code block placeholders (optional)
 * @property {Array<CodeBlock>|undefined} codeBlocks - extracted code blocks (optional)
 * @property {Array<EquationBlock>|undefined} equationBlocks - extracted equation blocks (optional)
 * 
 * 3.2. Assistant response (previous) data. Second opinion. Optional (appears in case of re-ask)
 * @property {string|undefined} previousAssistantText - assistant answer after in-place re-ask (opt)
 * @property {string[]|undefined} previousCitations - citations from previous response (optional)
 * @property {{[url:string]: string}|undefined} previousCitationsMeta - prev. citations met (opt)
 * @property {number|undefined} previousResponseMs - response time for previous answer (optional)
 * 
 * 3.3. Replacement (re-Ask, second opintion) data paremeters
 * @property {string|undefined} previousModel - model used to produce the previous answer (optional)
 * @property {number|undefined} replacedAt - timestamp (ms) when in-place replacement occurred (optional)
 * @property {string|undefined} replacedBy - actor/model that initiated replacement (optional)
 * 
 * 4. Status/state data
 * @property {('idle'|'sending'|'error'|'complete')} lifecycleState
 * @property {string|undefined} errorMessage
 * 
 * 5. Budget (token counts, - tc)
 * @property {number|undefined} userTextTokens - calculated tokens in user text (NEW)
 * @property {number|undefined} assistantTextTokens - calculated tokens in assistant response (NEW)
 * @property {number|undefined} assistantProviderTokens - provider-reported tc for assistant resp.
 * @property {number|undefined} previousUserTextTokens - calculated user tokens (for previous model)
 * @property {number|undefined} previousAssistantTextTokens - calculated assistant tokens (prev.model)
 * @property {number|undefined} previousAssistantProviderTokens - provider-reported tc for previous resp
 * 
 * 5.1. token counts for images attached to pair calculated for each provider (tokenCost).
 * @property {Array<{id:string, w:number, h:number, tokenCost:Object}>|undefined} imageBudgets 
 * 
 * 5.2. total prompt (user+system+context) token count
 * @property {number|undefined} fullPromptEstimatedTokens - estimated prompt token count
 * @property {number|undefined} fullPromptReportedTokens - reported prompt token count
 * @property {number|undefined} previousFullPromptEstimatedTokens - estimated prompt token count
 * @property {number|undefined} previousFullPromptReportedTokens - reported prompt token count
 * 
 * 5.3. total interaction token count (prompt+response+tools+thoughts) as reported by provider
 * @property {number|undefined} rawProviderTokenUsage - reported total token count
 * @property {number|undefined} previousRawProviderTokenUsage - prev. reported total token count
 * 
 * 5.4. legacy, but still in use in older versions:
 * @property {number|undefined} tokenLength - legacy (seems unused)
 * @property {number|undefined} textTokens - precomputed total text tokens (userText + assistantText)
 * @property {number|undefined} attachmentTokens - precomputed total image tokens for all attachments
 * 
 * 5.5 chacarters count (legacy, still in use)
 * @property {number|undefined} userChars - length of userText in characters 
 * @property {number|undefined} assistantChars - length of assistantText in characters 
 * @property {number|undefined} previousAssistantChars - length of previousAssistantText in characters 
 * 
 * 6. Future (not currently used)
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
    // Provider-reported assistant token usage (single number, highest priority for estimation)
    assistantProviderTokens: undefined,
    // Backup response metrics (for second opinion / response variants)
    previousAssistantChars: undefined,
    previousAssistantProviderTokens: undefined,
    // Denormalized image budgeting metadata (avoids async lookups during estimation)
    imageBudgets: undefined,
  }
}
