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

/**
 * Compute context boundary using new estimatedTokenUsage field
 * Optimized for performance with pre-computed token estimates
 * 
 * @param {MessagePair[]} orderedPairs - Pairs sorted chronologically (oldest to newest)
 * @param {Object} options
 * @param {number} [options.reservedTokens=0] - Reserved tokens (URA + ARA + system message)
 * @param {string} options.model - Model ID for budget calculation
 * @param {string} [options.providerId] - Provider ID (auto-detected from model if not provided)
 * @returns {Object} { included, excluded, stats }
 */
export function computeContextBoundaryNew(
  orderedPairs,
  { reservedTokens = 0, model, providerId } = {}
) {
  // Fast path: empty input
  if (!Array.isArray(orderedPairs) || orderedPairs.length === 0) {
    const budget = getModelBudget(model || 'gpt')
    return {
      included: [],
      excluded: [],
      stats: {
        totalIncludedTokens: 0,
        includedCount: 0,
        excludedCount: 0,
        model: model || 'gpt',
        maxContext: budget.maxContext,
        maxUsable: Math.max(0, budget.maxContext - reservedTokens),
        reservedTokens,
      },
    }
  }
  
  // Auto-detect providerId from model if not provided
  if (!providerId) {
    const modelMeta = getModelMeta(model)
    providerId = modelMeta?.provider || 'openai'
  }
  
  // Get budget and calculate available space
  const budget = getModelBudget(model)
  const maxContext = budget.maxContext
  const maxUsable = Math.max(0, maxContext - reservedTokens)
  
  // Fast backwards selection (newest first, stop on overflow)
  let totalTokens = 0
  const included = []
  
  for (let i = orderedPairs.length - 1; i >= 0; i--) {
    const pair = orderedPairs[i]
    
    // Read from new estimatedTokenUsage field
    // Fallback to 0 if missing (pair will be excluded)
    const pairTokens = pair.estimatedTokenUsage?.[providerId] || 0

    // Stop if adding this pair would overflow
    if (totalTokens + pairTokens > maxUsable) {
      break
    }
    
    // Include this pair
    included.push(pair)
    totalTokens += pairTokens
  }
  
  // Reverse to restore chronological order
  included.reverse()
  
  // Build excluded list (everything not included)
  // Use Set for O(1) lookup instead of includes()
  const includedSet = new Set(included)
  const excluded = orderedPairs.filter(p => !includedSet.has(p))
  
  console.log('tokenEstimator: total tokens in context: ',totalTokens) // debug
  
  return {
    included,
    excluded,
    stats: {
      totalIncludedTokens: totalTokens,
      includedCount: included.length,
      excludedCount: excluded.length,
      model,
      maxContext,
      maxUsable,
      reservedTokens,
      providerId,
    },
  }
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
