// Moved from src/context/tokenEstimator.js (Phase 5 core move)
export function estimateTokens(text, charsPerToken = 4) {
  if (!text) return 0
  const len = text.length
  return Math.max(1, Math.ceil(len / charsPerToken))
}
export function estimatePairTokens(pair, charsPerToken = 4) {
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
