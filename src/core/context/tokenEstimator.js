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

export function estimatePairTokens(pair, charsPerToken = 4) {
  // S4: Estimation precedence order (most accurate → fallback)
  // 1. Cached totals (textTokens + attachmentTokens) — legacy or precomputed
  // 2. Ground-truth char counts (userChars + assistantChars) — preferred when available
  // 3. Heuristic from raw text lengths — legacy fallback with in-memory cache

  const cachedText = typeof pair.textTokens === 'number' ? pair.textTokens : null
  const cachedAttach = typeof pair.attachmentTokens === 'number' ? pair.attachmentTokens : null
  if (cachedText != null || cachedAttach != null) {
    return (cachedText || 0) + (cachedAttach || 0)
  }

  // Prefer ground-truth char counts when available
  const hasChars = typeof pair.userChars === 'number' && typeof pair.assistantChars === 'number'
  if (hasChars) {
    const totalChars = (pair.userChars || 0) + (pair.assistantChars || 0)
    return Math.max(1, Math.ceil(totalChars / charsPerToken))
  }

  // Fallback: heuristic based on current texts; cache per-charsPerToken in-memory only
  const uLen = (pair.userText || '').length
  const aLen = (pair.assistantText || '').length
  const cache = pair._tokenCache
  if (cache && cache.cpt === charsPerToken && cache.uLen === uLen && cache.aLen === aLen)
    return cache.tok
  const total =
    estimateTokens(pair.userText || '', charsPerToken) +
    estimateTokens(pair.assistantText || '', charsPerToken)
  pair._tokenCache = { cpt: charsPerToken, uLen, aLen, tok: total }
  return total
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
  let total = 0
  const included = []
  for (let i = orderedPairs.length - 1; i >= 0; i--) {
    const p = orderedPairs[i]
    const pairTokens = estimatePairTokens(p, charsPerToken)
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
