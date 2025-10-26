// Moved from src/context/tokenEstimator.js (Phase 5 core move)
export function estimateTokens(text, charsPerToken = 4) {
  if (!text) return 0
  const len = text.length
  return Math.max(1, Math.ceil(len / charsPerToken))
}

/**
 * Estimate tokens for an image using tile-based formula.
 * Uses OpenAI detail:high formula as conservative baseline for all providers.
 * Future (Phase 2): will delegate to provider-specific counters via registry.
 * @param {{ w: number, h: number }} dimensions - image width and height in pixels
 * @param {string} providerId - e.g., 'openai', 'anthropic' (reserved for future use)
 * @param {string} model - e.g., 'gpt-4o' (reserved for future use)
 * @returns {number} estimated tokens
 */
export function estimateImageTokens({ w, h }, providerId = 'openai', model = '') {
  // OpenAI detail:high tile formula (85 base + 170 per 512×512 tile)
  // Most conservative among providers; safe baseline for budget checks
  const tiles = Math.ceil(w / 512) * Math.ceil(h / 512)
  return 85 + tiles * 170

  // Phase 2 (future): delegate to provider-specific counter
  // const counter = getProviderTokenCounter(providerId);
  // if (counter?.estimateImage) return counter.estimateImage({ w, h }, model);
  // return fallback above;
}

export function estimatePairTokens(pair, charsPerToken = 4) {
  // Fast path: if cached totals exist on the pair, use them.
  const cachedText = typeof pair.textTokens === 'number' ? pair.textTokens : null
  const cachedAttach = typeof pair.attachmentTokens === 'number' ? pair.attachmentTokens : null
  if (cachedText != null || cachedAttach != null) {
    return (cachedText || 0) + (cachedAttach || 0)
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
