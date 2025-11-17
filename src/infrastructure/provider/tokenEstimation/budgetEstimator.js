// Budget Estimator V2 - Clean, provider-focused token estimation
// No store access, pure functions only

import { estimateImageTokens as estimateOpenAIImageTokens } from './openaiImageEstimator.js'
import { estimateImageTokens as estimateAnthropicImageTokens } from './anthropicImageEstimator.js'
import { estimateImageTokens as estimateGeminiImageTokens } from './geminiImageEstimator.js'
import { estimateImageTokens as estimateGrokImageTokens } from './grokImageEstimator.js'

/**
 * Estimate text tokens using chars/CPT formula
 * Generic estimation - works for all providers until we have provider-specific tokenizers
 * 
 * Future: Will be replaced with real tokenizers (tiktoken for OpenAI, etc.)
 * when available - interface stays the same: estimateTextTokens(text, provider, settings)
 * 
 * @param {string} text - Text to estimate
 * @param {string} provider - Provider ID (for future tokenizer selection)
 * @param {Object} settings - App settings (read once by caller, passed to all estimates)
 * @returns {number} Estimated token count
 */
export function estimateTextTokens(text, provider, settings) {
  if (!text || typeof text !== 'string') return 0
  
  const charsPerToken = settings?.charsPerToken || 4
  
  // Phase 1: Simple formula (current implementation)
  const chars = text.length
  return Math.ceil(chars / charsPerToken)
  
  // Phase 2: Real tokenizer (future implementation)
  // switch (provider) {
  //   case 'openai':
  //     return tiktoken.encode(text).length
  //   case 'anthropic':
  //     return anthropicTokenizer.encode(text).length
  //   case 'gemini':
  //     return geminiTokenizer.encode(text).length
  //   default:
  //     return Math.ceil(text.length / charsPerToken)
  // }
}

/**
 * Estimate image tokens using provider-specific formula
 * 
 * @param {Object} params
 * @param {number} params.width - Image width in pixels
 * @param {number} params.height - Image height in pixels
 * @param {string} params.provider - Provider ID ('openai', 'anthropic', 'gemini', 'grok')
 * @returns {number} Estimated token count for this image
 */
export function estimateImageTokens({ width, height, provider }) {
  if (!width || !height) return 0
  
  switch (provider) {
    case 'openai':
      return estimateOpenAIImageTokens({ w: width, h: height })
    case 'anthropic':
      return estimateAnthropicImageTokens({ w: width, h: height })
    case 'gemini':
      return estimateGeminiImageTokens({ w: width, h: height })
    case 'grok':
      return estimateGrokImageTokens({ w: width, h: height })
    default:
      // Fallback: use OpenAI formula as default
      return estimateOpenAIImageTokens({ w: width, h: height })
  }
}
