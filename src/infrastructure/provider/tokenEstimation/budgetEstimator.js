// Budget Estimator V2 - Clean, provider-focused token estimation
// No store access, pure functions only

import { estimateImageTokens as estimateOpenAIImageTokens } from './openaiEstimator.js'
import { estimateImageTokens as estimateAnthropicImageTokens } from './anthropicEstimator.js'
import { estimateImageTokens as estimateGeminiImageTokens } from './geminiEstimator.js'
import { estimateImageTokens as estimateGrokImageTokens } from './grokEstimator.js'

import { getSettings } from '../../../core/settings/index.js'
import { getManyMetadata } from '../../../features/images/imageStore.js'
import { SUPPORTED_PROVIDERS } from '../../../core/models/modelCatalog.js'

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

/**
 * Calculate estimated token usage for multiple message pairs (batch operation)
 * Optimized: loads all images in one transaction, calculates for all providers
 * 
 * @param {MessagePair[]} pairs - Array of message pairs to calculate tokens for
 * @returns {Promise<Object>} Map of pairId -> { openai: X, anthropic: Y, _version: 'v1' }
 */
export async function calculateEstimatedTokenUsageBatch(pairs) {
  const settings = getSettings()
  const currentVersion = settings.tokenEstimationVersion || 'v1'
  
  // Step 1: Collect ALL unique image IDs from ALL pairs
  const allImageIds = new Set()
  for (const pair of pairs) {
    if (pair.attachments?.length) {
      pair.attachments.forEach(id => allImageIds.add(id))
    }
  }
  
  // Step 2: Load ALL images in ONE transaction
  const imageMap = new Map()
  if (allImageIds.size > 0) {
    const images = await getManyMetadata([...allImageIds])
    images.forEach(img => {
      if (img) imageMap.set(img.id, img)
    })
  }
  
  // Step 3: Calculate token usage for each pair across all providers
  const results = {}
  
  for (const pair of pairs) {
    const pairResult = { _version: currentVersion }
    
    for (const provider of SUPPORTED_PROVIDERS) {
      // Text tokens (user + assistant)
      const userTokens = estimateTextTokens(pair.userText || '', provider, settings)
      const assistantTokens = estimateTextTokens(pair.assistantText || '', provider, settings)
      
      // Image tokens (from pre-loaded map)
      let imageTokens = 0
      if (pair.attachments?.length) {
        for (const imgId of pair.attachments) {
          const img = imageMap.get(imgId)
          if (img?.tokenCost?.[provider]) {
            imageTokens += img.tokenCost[provider]
          }
        }
      }
      
      pairResult[provider] = userTokens + assistantTokens + imageTokens
    }
    
    results[pair.id] = pairResult
  }
  
  return results
}

/**
 * Calculate estimated token usage for a single message pair
 * Convenience wrapper around batch function
 * 
 * @param {MessagePair} pair - Message pair to calculate tokens for
 * @returns {Promise<Object>} { openai: X, anthropic: Y, _version: 'v1' }
 */
export async function calculateEstimatedTokenUsage(pair) {
  const batch = await calculateEstimatedTokenUsageBatch([pair])
  return batch[pair.id]
}
