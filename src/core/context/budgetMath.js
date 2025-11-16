// budgetMath.js - Step 2 (M24) universal budgeting logic
// Implements symbols & phases defined in docs/m24_multiple_providers.md Section 21.
// Pure / side-effect free; relies only on passed estimators & inputs.

import { estimateTokens, estimatePairTokens } from './tokenEstimator.js'
import { getModelBudget } from './tokenEstimator.js'
import { getSettings } from '../settings/index.js'
import { getModelMeta } from '../models/modelCatalog.js'

/**
 * Predict which history pairs will fit in the context window before knowing the user's new message.
 * 
 * Works backwards from newest to oldest pairs, reserving space for:
 * - System message
 * - User's new request (URA - User Request Allowance)
 * - Provider-specific assistant response buffer (PARA - only for OpenAI)
 * 
 * @param {Object} params - Prediction parameters
 * @param {Array<MessagePair>} params.pairs - All conversation pairs (chronological order)
 * @param {string} params.model - Model identifier (e.g., 'gpt-4', 'claude-3-5-sonnet')
 * @param {string} [params.systemText=''] - System instruction text
 * @param {string} params.provider - Provider name ('openai', 'anthropic', 'gemini', etc.)
 * @param {number} params.charsPerToken - Character-to-token ratio for estimation
 * @param {number} params.URA - User Request Allowance (reserved tokens for new user message)
 * @param {number} params.ARA - Assistant Response Allowance (reserved tokens for assistant reply)
 * 
 * @returns {Object} Prediction result
 * @returns {number} return.C - Context window limit (total available tokens)
 * @returns {number} return.HLP - History Limit for Prediction (tokens available for history)
 * @returns {number} return.systemTokens - Token count for system message
 * @returns {number} return.PARA - Provider-specific Assistant Response Allowance
 * @returns {Array<MessagePair>} return.predicted - Pairs that fit (chronological order)
 * @returns {number} return.predictedTokenSum - Total tokens in predicted pairs
 */
export function predictHistory({
  pairs,
  model,
  systemText = '',
  provider,
  charsPerToken,
  URA,
  ARA,
}) {
  if (!Array.isArray(pairs)) pairs = []
  const settings = getSettings()
  const cpt = charsPerToken ?? settings.charsPerToken ?? 4
  
  // Get effective context window for this model
  const { maxContext: cwEff } = getModelBudget(model)
  const systemTokens = systemText ? estimateTokens(systemText, cpt) : 0
  
  // PARA: Provider-specific Assistant Response Allowance
  // OpenAI requires reserving space for assistant response, others don't
  const PARA = provider === 'openai' ? (ARA ?? settings.assistantResponseAllowance ?? 0) : 0
  
  // C: Context window limit (total tokens available)
  const C = cwEff
  
  // HLP: History Limit for Prediction
  // = Total context - User Request Reserve - System Message - Provider Reserve
  const HLP = Math.max(0, C - (URA || 0) - systemTokens - PARA)
  
  // Work backwards (newest to oldest) to fill available history space
  const rev = []
  let acc = 0
  for (let i = pairs.length - 1; i >= 0; i--) {
    const p = pairs[i]
    const tok = estimatePairTokens(p, cpt)
    if (acc + tok > HLP) break
    rev.push(p)
    acc += tok
  }
  
  // Reverse to restore chronological order
  const predicted = rev.reverse()
  return { C, HLP, systemTokens, PARA, predicted, predictedTokenSum: acc }
}

// Finalize after user message known; trim if necessary.
export function finalizeHistory({
  predicted,
  userText,
  systemTokens,
  C,
  PARA,
  URA,
  charsPerToken,
}) {
  const settings = getSettings()
  const cpt = charsPerToken ?? settings.charsPerToken ?? 4
  const userTokens = estimateTokens(userText || '', cpt)
  const H0 = predicted.reduce((a, p) => a + estimatePairTokens(p, cpt), 0)
  const HLA = Math.max(0, C - userTokens - systemTokens - PARA)
  // Guard: user + system alone overflow
  if (userTokens + systemTokens > C) {
    return { error: 'user_prompt_too_large', C, H0, HLA, userTokens }
  }
  let included = predicted.slice()
  if (H0 > HLA) {
    let total = H0
    while (included.length && total > HLA) {
      const first = included[0]
      total -= estimatePairTokens(first, cpt)
      included.shift()
    }
    if (total > HLA) {
      return { error: 'context_overflow_after_trimming', C, H0, HLA, userTokens }
    }
  }
  const H = included.reduce((a, p) => a + estimatePairTokens(p, cpt), 0)
  const inputTokens = systemTokens + userTokens + H
  const R = Math.max(0, C - inputTokens)
  return { C, H0, H, HLA, userTokens, inputTokens, remainingContext: R, included }
}

// Convenience end-to-end computation.
export function computeBudgetEnvelope({ pairs, model, provider, systemText, userText, overrides }) {
  const settings = getSettings()
  const URA = overrides?.URA ?? settings.userRequestAllowance
  const ARA = overrides?.ARA ?? settings.assistantResponseAllowance
  const charsPerToken = overrides?.charsPerToken ?? settings.charsPerToken
  const meta = getModelMeta(model) || {}
  const otpm = meta.otpm
  const pred = predictHistory({ pairs, model, systemText, provider, charsPerToken, URA, ARA })
  const fin = finalizeHistory({
    predicted: pred.predicted,
    userText,
    systemTokens: pred.systemTokens,
    C: pred.C,
    PARA: pred.PARA,
    URA,
    charsPerToken,
  })
  if (fin.error) {
    return { error: fin.error, meta: { otpm }, symbols: { ...pred, ...fin, URA, ARA } }
  }
  return {
    budget: {
      maxContext: fin.C,
      inputTokens: fin.inputTokens,
      remainingContext: fin.remainingContext,
    },
    included: fin.included,
    meta: { otpm },
    symbols: { ...pred, ...fin, URA, ARA },
  }
}
