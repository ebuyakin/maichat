// Token estimation & budgeting utilities
// Simple heuristic: charsPerToken (~4) adjustable via settings later.

/** Estimate tokens for a text using heuristic charsPerToken.
 * @param {string} text
 * @param {number} charsPerToken
 */
export function estimateTokens(text, charsPerToken=4){
  if(!text) return 0
  const len = text.length
  return Math.max(1, Math.ceil(len / charsPerToken))
}

/** Estimate tokens for a message pair (user + assistant parts).
 * Caches per charsPerToken & text lengths; invalidates automatically if either side changes.
 */
export function estimatePairTokens(pair, charsPerToken=4){
  const uLen = (pair.userText||'').length
  const aLen = (pair.assistantText||'').length
  const cache = pair._tokenCache
  if(cache && cache.cpt === charsPerToken && cache.uLen === uLen && cache.aLen === aLen){
    return cache.tok
  }
  const userT = estimateTokens(pair.userText||'', charsPerToken)
  const asstT = estimateTokens(pair.assistantText||'', charsPerToken)
  const total = userT + asstT
  pair._tokenCache = { cpt: charsPerToken, uLen, aLen, tok: total }
  return total
}

import { getContextWindow, getModelMeta } from '../models/modelCatalog.js'
/** Build a model budget descriptor using catalog metadata */
export function getModelBudget(model){
  const cw = getContextWindow(model)
  const meta = getModelMeta(model)
  const tpm = meta.tpm || cw
  const effective = Math.min(cw, tpm) // simplistic: minute throughput cap may be stricter than window
  return { maxContext: effective, rawContextWindow: cw, tpm }
}

/** Compute inclusion boundary.
 * @param {import('../models/messagePair.js').MessagePair[]} orderedPairs chronological filtered list
 * @param {object} opts
 * @param {number} opts.charsPerToken
 * @returns {{included: import('../models/messagePair.js').MessagePair[], excluded: import('../models/messagePair.js').MessagePair[], stats: object}}
 */
export function computeContextBoundary(orderedPairs, { charsPerToken=4, assumedUserTokens=0, model }={}){
  if(!Array.isArray(orderedPairs)) orderedPairs = []
  // Model inference: if caller supplies a model (current selection in input zone) use it; otherwise fall back to newest pair's model or default 'gpt'.
  if(!model){
    model = orderedPairs.length? (orderedPairs[orderedPairs.length-1].model || 'gpt') : 'gpt'
  }
  const budget = getModelBudget(model)
  const { maxContext } = budget
  // New semantics: assumedUserTokens (URA) is reserved for upcoming user request; no separate assistant reserve or safety margin.
  const maxUsableRaw = maxContext
  const maxUsable = Math.max(0, maxUsableRaw - (assumedUserTokens||0))
  let total=0
  const included=[]
  for(let i=orderedPairs.length-1; i>=0; i--){
    const p = orderedPairs[i]
    // estimate tokens for user+assistant (assistant may be pending; count user only if assistant placeholder?)
    const pairTokens = estimatePairTokens(p, charsPerToken)
    if(total + pairTokens > maxUsable){
      break
    }
    included.push(p)
    total += pairTokens
  }
  included.reverse()
  const excluded = orderedPairs.filter(p=> !included.includes(p))
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
      charsPerToken
    }
  }
}
