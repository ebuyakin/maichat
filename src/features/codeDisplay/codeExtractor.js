// Code snippet detection and extraction module
import { applyEquationsToPair } from './equationExtractor.js'
// Phase 0: Infrastructure - no UI changes yet

/**
 * Detects and extracts code blocks from message content
 * Supports triple-backtick markdown format: ```language\ncode\n```
 */

// Regex to match code blocks with optional language specifier
/*const CODE_BLOCK_REGEX = /```(\w*)\n([\s\S]*?)```/g;*/
const CODE_BLOCK_REGEX = /\s*```(\w*)\s*([\s\S]*?)```\s*/g;

/**
 * Checks if content contains any code blocks
 * @param {string} content - Message content to check
 * @returns {boolean} True if code blocks found
 */
export function containsCodeBlocks(content) {
  if (!content || typeof content !== 'string') return false;
  return CODE_BLOCK_REGEX.test(content);
}

/**
 * Extracts code blocks from content and generates processed version
 * @param {string} content - Original message content
 * @returns {object} Extraction result
 */
export function extractCodeBlocks(content) {
  if (!content || typeof content !== 'string') {
    return {
      hasCode: false,
      displayText: content,
      codeBlocks: []
    };
  }

  const codeBlocks = [];
  let blockIndex = 0;
  
  // Reset regex state
  CODE_BLOCK_REGEX.lastIndex = 0;
  
  // Replace code blocks with placeholders and collect block data
  const displayText = content.replace(CODE_BLOCK_REGEX, (match, language, code, offset) => {
    blockIndex++;
    
    // Clean up the extracted code (remove trailing/leading whitespace)
    const cleanCode = code.trim();
    
    // Store block information
    codeBlocks.push({
      index: blockIndex,
      language: language || 'text', // Default to 'text' if no language specified
      code: cleanCode,
      lineCount: cleanCode.split('\n').length,
      startPos: offset,
      endPos: offset + match.length
    });
    
    // Generate placeholder
    // Contract: placeholders rendered inline as `[language-N]` (or `[code-N]` fallback)
    // Surrounded by single spaces to keep separation from adjacent words.
    const langToken = (language && language.trim()) ? language.trim() : 'code'
    return ` [${langToken}-${blockIndex}] `;
  });

  return {
    hasCode: codeBlocks.length > 0,
    displayText: displayText,
    codeBlocks: codeBlocks
  };
}

/**
 * Processes a message pair's assistant text for code blocks
 * This is the main entry point for message processing
 * @param {object} messagePair - The message pair to process
 * @returns {object} The processed message pair (modified in place)
 */
export function processMessagePair(messagePair) {
  if (!messagePair || !messagePair.assistantText) {
    return messagePair;
  }

  const extraction = extractCodeBlocks(messagePair.assistantText);
  
  if (extraction.hasCode) {
    messagePair.processedContent = extraction.displayText;
    messagePair.codeBlocks = extraction.codeBlocks;
    console.log(`[CodeExtractor] Processed message ${messagePair.id}: found ${extraction.codeBlocks.length} code blocks`);
  }
  // Equation extraction (hybrid simple/complex) builds on processedContent if present
  applyEquationsToPair(messagePair);
  return messagePair;
}

/**
 * Gets display content for rendering (with placeholders)
 * Provides backward compatibility fallback
 * @param {object} messagePair - The message pair
 * @returns {string} Content to display (with placeholders if processed)
 */
export function getDisplayContent(messagePair) {
  if (!messagePair) return '';
  
  // Use processed content if available, otherwise fall back to original
  return messagePair.processedContent || messagePair.assistantText || '';
}

/**
 * Gets original content for context assembly
 * Always returns original content with code blocks intact
 * @param {object} messagePair - The message pair  
 * @returns {string} Original content for API context
 */
export function getContextContent(messagePair) {
  if (!messagePair) return '';
  
  // Always use original content for API requests
  return messagePair.assistantText || '';
}