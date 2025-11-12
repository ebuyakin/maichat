// Moved from src/context/tokenEstimator.js (Phase 5 core move)

// S17: Import provider-specific estimators
import { openaiEstimator } from '../../infrastructure/provider/tokenEstimation/openaiEstimator.js'
import { anthropicEstimator } from '../../infrastructure/provider/tokenEstimation/anthropicEstimator.js'
import { geminiEstimator } from '../../infrastructure/provider/tokenEstimation/geminiEstimator.js'
import { grokEstimator } from '../../infrastructure/provider/tokenEstimation/grokEstimator.js'
import { fallbackEstimator } from '../../infrastructure/provider/tokenEstimation/fallbackEstimator.js'

// S17: Provider estimator registry
const PROVIDER_ESTIMATORS = {
  openai: openaiEstimator,
  anthropic: anthropicEstimator,
  google: geminiEstimator,
  xai: grokEstimator,
}

function getProviderEstimator(providerId) {
  const pid = (providerId || 'openai').toLowerCase()
  return PROVIDER_ESTIMATORS[pid] || fallbackEstimator
}

export function estimateTokens(text, charsPerToken = 4) {
  if (!text) return 0
  const len = text.length
  return Math.max(1, Math.ceil(len / charsPerToken))
}

/**
 * Estimate tokens for an image using provider-specific formula.
 * S17: Delegates to provider estimators instead of hardcoded OpenAI formula.
 * 
 * @param {{ w: number, h: number }} dimensions - image width and height in pixels
 * @param {string} providerId - e.g., 'openai', 'anthropic', 'google', 'xai'
 * @param {string} model - model identifier (reserved for future model-specific costs)
 * @returns {number} estimated tokens
 */
export function estimateImageTokens({ w, h }, providerId = 'openai', model = '') {
  const estimator = getProviderEstimator(providerId)
  return estimator.estimateImageTokens({ w, h }, model)
}

/**
 * Estimate total tokens for a message pair (user + assistant + images)
 * 
 * Precedence for text estimation:
 * 1. assistantProviderTokens (if present) — provider-reported, highest priority
 * 2. Ground-truth char counts (userChars, assistantChars) — preferred
 * 3. Legacy textTokens cache — backward compat
 * 4. Heuristic from current text lengths — last resort
 * 
 * Image tokens: uses denormalized imageBudgets for fast, synchronous lookup
 * 
 * @param {Object} pair - MessagePair object
 * @param {number} charsPerToken - characters per token ratio (user setting)
 * @param {string} providerId - provider ID for image token lookup (e.g., 'openai')
 * @returns {number} estimated total tokens
 */
export function estimatePairTokens(pair, charsPerToken = 4, providerId = 'openai') {
  let textTokens = 0
  
  // === ASSISTANT TOKENS ===
  // Priority 1: Provider-reported tokens (highest accuracy)
  if (typeof pair.assistantProviderTokens === 'number') {
    textTokens += pair.assistantProviderTokens
  }
  // Priority 2: Ground-truth char count
  else if (typeof pair.assistantChars === 'number') {
    textTokens += Math.ceil(pair.assistantChars / charsPerToken)
  }
  // Priority 3: Legacy cache or heuristic
  else {
    textTokens += estimateTokens(pair.assistantText || '', charsPerToken)
  }
  
  // === USER TOKENS ===
  // Provider doesn't report user tokens, so use char-based estimation
  if (typeof pair.userChars === 'number') {
    textTokens += Math.ceil(pair.userChars / charsPerToken)
  } else {
    textTokens += estimateTokens(pair.userText || '', charsPerToken)
  }
  
  // === IMAGE TOKENS ===
  // Use denormalized imageBudgets for fast synchronous lookup
  let imageTokens = 0
  if (pair.imageBudgets && Array.isArray(pair.imageBudgets)) {
    const providerKey = (providerId || 'openai').toLowerCase()
    for (const imgBudget of pair.imageBudgets) {
      imageTokens += imgBudget.tokenCost?.[providerKey] || 0
    }
  }
  // Fallback: legacy attachmentTokens (single number, uses default provider formula)
  else if (typeof pair.attachmentTokens === 'number') {
    imageTokens = pair.attachmentTokens
  }
  
  return textTokens + imageTokens
}

import { getContextWindow, getModelMeta } from '../models/modelCatalog.js'
export function getModelBudget(model) {
  const cw = getContextWindow(model)
  const meta = getModelMeta(model)
  const tpm = meta.tpm || cw
  const effective = Math.min(cw, tpm)
  return { maxContext: effective, rawContextWindow: cw, tpm }
}
export function computeContextBoundary(
  orderedPairs,
  { charsPerToken = 4, assumedUserTokens = 0, model } = {}
) {
  if (!Array.isArray(orderedPairs)) orderedPairs = []
  if (!model) {
    model = orderedPairs.length ? orderedPairs[orderedPairs.length - 1].model || 'gpt' : 'gpt'
  }
  const budget = getModelBudget(model)
  const { maxContext } = budget
  const maxUsableRaw = maxContext
  const maxUsable = Math.max(0, maxUsableRaw - (assumedUserTokens || 0))
  
  // Get provider ID from model for image token estimation
  const modelMeta = getModelMeta(model)
  const providerId = modelMeta?.provider || 'openai'
  
  let total = 0
  const included = []
  for (let i = orderedPairs.length - 1; i >= 0; i--) {
    const p = orderedPairs[i]
    const pairTokens = estimatePairTokens(p, charsPerToken, providerId)
    if (total + pairTokens > maxUsable) {
      break
    }
    included.push(p)
    total += pairTokens
  }
  included.reverse()
  const excluded = orderedPairs.filter((p) => !included.includes(p))
  return {
    included,
    excluded,
    stats: {
      totalIncludedTokens: total,
      includedCount: included.length,
      excludedCount: excluded.length,
      model,
      maxContext,
      responseReserve: 0,
      softBuffer: 0,
      safetyMargin: 0,
      maxUsable,
      maxUsableRaw,
      assumedUserTokens,
      charsPerToken,
    },
  }
}
