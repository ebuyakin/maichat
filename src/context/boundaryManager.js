// Boundary Manager: single source of truth for predicted history boundary (Phase 1)
// Responsibilities (current phase):
//  * Maintain a cached predicted boundary (included / excluded visible pairs)
//  * Recompute only when marked dirty due to: visible pair set change, model change, settings change
//  * Reserve URA (userRequestAllowance) when predicting (do NOT include pending user text)
//  * Provide telemetry-friendly stats: predictedMessageCount, predictedHistoryTokens, predictedTotalTokens
//  * Exclude any unsent new user request (caller supplies only existing visible pairs)
//  * Keep implementation simple; later phases may add fine-grained selective invalidation & reason telemetry
//

import { computeContextBoundary, estimatePairTokens } from './tokenEstimator.js'

/**
 * @typedef {object} BoundaryStats
 * @property {string} model
 * @property {number} predictedMessageCount
 * @property {number} predictedHistoryTokens
 * @property {number} predictedTotalTokens  // predictedHistoryTokens + URA
 * @property {number} URA  // userRequestAllowance reserved tokens
 * @property {number} charsPerToken
 * @property {number} maxContext
 * @property {number} maxUsable  // maxContext - URA
 * @property {string[]} dirtyReasons  // reasons applied before this recompute
 */

/** Create a boundary manager instance. */
export function createBoundaryManager(){
  let visiblePairs = [] // chronological filtered list (WYSIWYG)
  let model = null
  let settings = { userRequestAllowance: 0, charsPerToken: 4 }
  let dirty = true
  const pendingDirtyReasons = new Set(['init'])
  let cached = null

  function markDirty(reason='unknown'){
    pendingDirtyReasons.add(reason)
    dirty = true
  }

  function updateVisiblePairs(pairs){
    visiblePairs = Array.isArray(pairs) ? pairs : []
    markDirty('visiblePairs')
  }
  function setModel(m){
    if(m && m !== model){ model = m; markDirty('model') }
  }
  function applySettings(newSettings){
    if(!newSettings) return
    const { userRequestAllowance, charsPerToken } = newSettings
    let changed = false
    if(typeof userRequestAllowance === 'number' && userRequestAllowance !== settings.userRequestAllowance){ settings.userRequestAllowance = userRequestAllowance; changed = true }
    if(typeof charsPerToken === 'number' && charsPerToken !== settings.charsPerToken){ settings.charsPerToken = charsPerToken; changed = true }
    if(changed) markDirty('settings')
  }

  function recomputeIfNeeded(){
    if(!dirty && cached) return cached
    // Perform prediction boundary using allowance = URA (reserve forthcoming user message tokens)
    const { userRequestAllowance: URA, charsPerToken } = settings
    const res = computeContextBoundary(visiblePairs, { charsPerToken, assumedUserTokens: URA, model })
    const predictedHistoryTokens = res.included.reduce((acc,p)=> acc + estimatePairTokens(p, charsPerToken), 0)
    const predictedTotalTokens = predictedHistoryTokens + URA
    const dirtyReasons = Array.from(pendingDirtyReasons)
    pendingDirtyReasons.clear()
    cached = {
      included: res.included,
      excluded: res.excluded,
      stats: {
        model: res.stats.model,
        predictedMessageCount: res.included.length,
        predictedHistoryTokens,
        predictedTotalTokens,
        URA,
        charsPerToken,
        maxContext: res.stats.maxContext,
        maxUsable: res.stats.maxUsable,
        dirtyReasons
      }
    }
    dirty = false
    return cached
  }

  function getBoundary(){
    return recomputeIfNeeded()
  }

  return {
    // Inputs
    updateVisiblePairs,
    setModel,
    applySettings,
    markDirty,
    // Output accessor
    getBoundary,
    // Introspection (for debugging)
    _debugState: ()=> ({ dirty, visibleCount: visiblePairs.length, model, settings: { ...settings } })
  }
}

