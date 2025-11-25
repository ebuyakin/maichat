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
 * 4. Budget (token counts, - tc) - cached estimations, stored reported data
 * @property {Object} estimatedTokenUsage - token count (user+attachments+assistant)
 * @property {number} estimatedTokenUsage.[provider] - token count for a given provider
 * @property {string} estimatedTokenCount.relevanceFlag - to control the version of the token count
 * @property {Object} providerTokenUsage - collected from provider response
 * @property {number} providerTokenUsage.[provider] - actual token count for a given provider
 * @property {number|undefined} fullPromptEstimatedTokens - estimated total tokens in full prompt (history+system+user)
 * 
 * 5. Assistant response (previous) data. Second opinion. Optional (appears in case of re-ask)
 * @property {Object} previousResponse - one object to store all fields with previous response
 * @property {string|undefined} previousResponse.AssistantText - assistant answer after in-place re-ask 
 * @property {string[]|undefined} previousResponse.Citations - citations from previous response 
 * @property {{[url:string]: string}|undefined} previousResponse.CitationsMeta - prev. citations met 
 * @property {number|undefined} previousResponse.ResponseMs - response time for previous answer 
 * @property {string|undefined} previousResponse.Model - model used to produce the previous answer 
 * @property {number|undefined} previouseResponse.replacedAt - timestamp (ms) of the replacement 
 * @property {string|undefined} previousResponse.replacedBy - actor/model that initiated replacement
 * @property {Object} previouseResponse.estimatedTokenCount -  total token count 
 * @property {number} previousResponse.estimatedTokenCount.[provider] - token count for a given provider
 * @property {string} previousResponse.estimatedTokenCount.relevanceFlag - the version of the token count
 * @property {Object} previousResponse.providerTokenUsage - collected from provider response
 * @property {number} previousResponse.providerTokenUsage.[provider] - token count for a given provider
 * @property {number|undefined} previousResponse.fullPromptEstimatedTokens - estimated total tokens from previous attempt
 * 
 * 6. Status/state data
 * @property {('idle'|'sending'|'error'|'complete')} lifecycleState
 * @property {string|undefined} errorMessage
 * 
 * 7. Legacy. Don't create in new message and don't populate in the new pipeline
 * @property {number|undefined} userTextTokens - calculated tokens in user text (NEW)
 * @property {number|undefined} assistantTextTokens - calculated tokens in assistant response (NEW)
 * @property {number|undefined} assistantProviderTokens - provider-reported tc for assistant resp.
 * @property {number|undefined} previousUserTextTokens - calculated user tokens (for previous model)
 * @property {number|undefined} previousAssistantTextTokens - calculated assistant tokens (prev.model)
 * @property {number|undefined} previousAssistantProviderTokens - provider-reported tc for previous resp
 * @property {Array<{id:string, w:number, h:number, tokenCost:Object}>|undefined} imageBudgets 
 * @property {number|undefined} rawProviderTokenUsage - reported total token count
 * @property {number|undefined} previousRawProviderTokenUsage - prev. reported total token count
 * @property {number|undefined} tokenLength - legacy (seems unused)
 * @property {number|undefined} textTokens - precomputed total text tokens (userText + assistantText)
 * @property {number|undefined} attachmentTokens - precomputed total image tokens for all attachments
 * @property {number|undefined} userChars - length of userText in characters 
 * @property {number|undefined} assistantChars - length of assistantText in characters 
 * @property {number|undefined} previousAssistantChars - length of previousAssistantText in characters 
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
