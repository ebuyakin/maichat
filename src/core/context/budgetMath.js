// budgetMath.js - Step 2 (M24) universal budgeting logic
// Implements symbols & phases defined in docs/m24_multiple_providers.md Section 21.
// Pure / side-effect free; relies only on passed estimators & inputs.

import { estimateTokens, estimatePairTokens } from './tokenEstimator.js'
import { getModelBudget } from './tokenEstimator.js'
import { getSettings } from '../settings/index.js'
import { getModelMeta } from '../models/modelCatalog.js'

// Predict which history pairs fit reserving URA (and PARA for provider specific reserve)
export function predictHistory({ pairs, model, systemText='', provider, charsPerToken, URA, ARA }){
  if(!Array.isArray(pairs)) pairs = []
  const settings = getSettings()
  const cpt = charsPerToken ?? settings.charsPerToken ?? 4
  const { maxContext: cwEff } = getModelBudget(model)
  const systemTokens = systemText? estimateTokens(systemText, cpt) : 0
  const PARA = provider==='openai' ? (ARA ?? settings.assistantResponseAllowance ?? 0) : 0
  const C = cwEff
  const HLP = Math.max(0, C - (URA||0) - systemTokens - PARA)
  const rev = []
  let acc = 0
  for(let i=pairs.length-1;i>=0;i--){
    const p = pairs[i]
    const tok = estimatePairTokens(p, cpt)
    if(acc + tok > HLP) break
    rev.push(p); acc += tok
  }
  const predicted = rev.reverse()
  return { C, HLP, systemTokens, PARA, predicted, predictedTokenSum: acc }
}

// Finalize after user message known; trim if necessary.
export function finalizeHistory({ predicted, userText, systemTokens, C, PARA, URA, charsPerToken }){
  const settings = getSettings()
  const cpt = charsPerToken ?? settings.charsPerToken ?? 4
  const userTokens = estimateTokens(userText||'', cpt)
  const H0 = predicted.reduce((a,p)=> a + estimatePairTokens(p, cpt), 0)
  const HLA = Math.max(0, C - userTokens - systemTokens - PARA)
  // Guard: user + system alone overflow
  if(userTokens + systemTokens > C){
    return { error:'user_prompt_too_large', C, H0, HLA, userTokens }
  }
  let included = predicted.slice()
  if(H0 > HLA){
    let total = H0
    while(included.length && total > HLA){
      const first = included[0]
      total -= estimatePairTokens(first, cpt)
      included.shift()
    }
    if(total > HLA){
      return { error:'context_overflow_after_trimming', C, H0, HLA, userTokens }
    }
  }
  const H = included.reduce((a,p)=> a + estimatePairTokens(p, cpt), 0)
  const inputTokens = systemTokens + userTokens + H
  const R = Math.max(0, C - inputTokens)
  return { C, H0, H, HLA, userTokens, inputTokens, remainingContext: R, included }
}

// Convenience end-to-end computation.
export function computeBudgetEnvelope({ pairs, model, provider, systemText, userText, overrides }){
  const settings = getSettings()
  const URA = overrides?.URA ?? settings.userRequestAllowance
  const ARA = overrides?.ARA ?? settings.assistantResponseAllowance
  const charsPerToken = overrides?.charsPerToken ?? settings.charsPerToken
  const meta = getModelMeta(model) || {}
  const otpm = meta.otpm
  const pred = predictHistory({ pairs, model, systemText, provider, charsPerToken, URA, ARA })
  const fin = finalizeHistory({ predicted: pred.predicted, userText, systemTokens: pred.systemTokens, C: pred.C, PARA: pred.PARA, URA, charsPerToken })
  if(fin.error){ return { error: fin.error, meta: { otpm }, symbols:{ ...pred, ...fin, URA, ARA } } }
  return { budget:{ maxContext: fin.C, inputTokens: fin.inputTokens, remainingContext: fin.remainingContext }, included: fin.included, meta:{ otpm }, symbols:{ ...pred, ...fin, URA, ARA } }
}
