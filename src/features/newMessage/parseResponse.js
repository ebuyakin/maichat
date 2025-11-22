// Phase 5: Parse provider response
// Extract all data from response (provider-agnostic)

import { extractCodeBlocks } from '../codeDisplay/codeExtractor.js'
import { extractEquations } from '../codeDisplay/equationExtractor.js'
import { sanitizeAssistantText } from '../interaction/sanitizeAssistant.js'
import { escapeHtmlAttr, escapeHtml } from '../../shared/htmlEscape.js'

/**
 * Helper: Sanitize while preserving code/equation placeholders and markers
 * Splits on tokens, sanitizes non-token parts
 */
function sanitizeDisplayPreservingTokens(text) {
  if (!text) return text || ''
  
  const TOKEN_REGEX = /(\[[a-zA-Z0-9_]+-\d+\]|\[eq-\d+\]|__EQINL_\d+__)/g
  const parts = text.split(TOKEN_REGEX).filter((p) => p !== '' && p != null)
  
  let out = ''
  for (const part of parts) {
    if (TOKEN_REGEX.test(part)) {
      out += part  // Token untouched
    } else {
      out += sanitizeAssistantText(part)
    }
    TOKEN_REGEX.lastIndex = 0
  }
  
  return out
}

/**
 * Parse provider response and extract all metadata
 * Provider-agnostic - expects normalized response from adapters
 * 
 * Processing pipeline (order matters):
 * 1. Extract code blocks → placeholders [lang-N]
 * 2. Extract equations → placeholders [eq-N] and markers __EQINL_X__
 * 3. Sanitize text (preserving placeholders)
 * 4. Expand inline equation markers to spans
 * 
 * @param {Object} params
 * @param {Object} params.response - Normalized provider response
 * @returns {Object} Parsed response data
 */
export function parseResponse(response) {
  // response.content += ' NP!' // DEBUGGING NEW PIPELINE

  const rawText = response.content || ''
  
  // 1. Extract code blocks first (must happen before sanitization)
  const codeExtraction = extractCodeBlocks(rawText)
  const afterCode = codeExtraction.hasCode ? codeExtraction.displayText : rawText
  
  // 2. Extract equations (display math and inline math)
  const eqResult = extractEquations(afterCode, { inlineMode: 'markers' })
  const afterEq = eqResult.displayText  // Has [eq-N] placeholders + __EQINL_X__ markers
  
  // 3. Sanitize (preserving placeholders and markers)
  const sanitized = sanitizeDisplayPreservingTokens(afterEq)
  
  // 4. Expand inline equation markers to HTML spans
  let finalDisplay = sanitized
  if (eqResult.inlineSimple && eqResult.inlineSimple.length) {
    for (const item of eqResult.inlineSimple) {
      const span = `<span class="eq-inline" data-tex="${escapeHtmlAttr(item.raw)}">${escapeHtml(item.unicode)}</span>`
      finalDisplay = finalDisplay.replaceAll(item.marker, span)
    }
  }
  
  // 5. Normalize spaces around placeholders
  finalDisplay = finalDisplay.replace(/\s*\[([a-z0-9_]+-\d+|eq-\d+)\]\s*/gi, ' [$1] ')
  finalDisplay = finalDisplay.replace(/ {2,}/g, ' ')
  
  // 6. Derive final fields for return object
  const hasCodeOrEquations = codeExtraction.hasCode || eqResult.hasEquations

  const processedContent = hasCodeOrEquations
    ? finalDisplay
    : sanitizeAssistantText(rawText)

  const codeBlocks = codeExtraction.hasCode
    ? codeExtraction.codeBlocks
    : undefined

  const equationBlocks =
    eqResult.equationBlocks?.length > 0 ? eqResult.equationBlocks : undefined

  const citations =
    response.citations?.length > 0 ? response.citations : undefined

  const citationsMeta =
    response.citationsMeta && Object.keys(response.citationsMeta).length > 0
      ? response.citationsMeta
      : undefined

  return {
    content: rawText, // Original content (never modified - for context)
    processedContent, // Processed content (for display)
    codeBlocks, 
    equationBlocks, 
    rawTokenUsage: response.rawTokenUsage, // Raw provider token usage (for analytics)
    responseMs: response.responseMs, // Response time from adapter
    citations, // sources used by the model (URLS)
    citationsMeta, // titles of the sources
  }
}
