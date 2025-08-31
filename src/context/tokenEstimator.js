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

/** Estimate tokens for a message pair (user + assistant parts) */
export function estimatePairTokens(pair, charsPerToken=4){
  // Simple cache: recompute if missing or lengths changed vs stored tokenLength heuristic (cannot reverse accurately, so recompute when undefined)
  if(pair.tokenLength != null){
    return pair.tokenLength
  }
  const userT = estimateTokens(pair.userText||'', charsPerToken)
  const asstT = estimateTokens(pair.assistantText||'', charsPerToken)
  const total = userT + asstT
  pair.tokenLength = total
  return total
}

import { getContextWindow } from '../models/modelCatalog.js'
/** Build a model budget descriptor using catalog metadata */
export function getModelBudget(model){
  const cw = getContextWindow(model)
  return {
    maxContext: cw,
    responseReserve: 800,
    softBuffer: 300,
    safetyMargin: 40
  }
}

/** Compute inclusion boundary.
 * @param {import('../models/messagePair.js').MessagePair[]} orderedPairs chronological filtered list
 * @param {object} opts
 * @param {number} opts.charsPerToken
 * @returns {{included: import('../models/messagePair.js').MessagePair[], excluded: import('../models/messagePair.js').MessagePair[], stats: object}}
 */
export function computeContextBoundary(orderedPairs, { charsPerToken=4, assumedUserTokens=0 }={}){
  if(!Array.isArray(orderedPairs)) orderedPairs = []
  const model = orderedPairs.length? orderedPairs[orderedPairs.length-1].model : 'gpt'
  const budget = getModelBudget(model)
  const { maxContext, responseReserve, softBuffer, safetyMargin } = budget
  const maxUsableRaw = maxContext - responseReserve - safetyMargin
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
    if(total > maxUsable - softBuffer){
      // we are within soft buffer; still ok, just note in stats
    }
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
      responseReserve,
      softBuffer,
      safetyMargin,
  maxUsable,
  maxUsableRaw,
  assumedUserTokens,
      charsPerToken
    }
  }
}
