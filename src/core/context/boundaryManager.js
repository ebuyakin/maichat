// Moved from src/context/boundaryManager.js (Phase 5 core move)
// Adjusted after removal of legacy src/context folder: local tokenEstimator lives alongside this file.
import { computeContextBoundary, computeContextBoundaryNew, estimatePairTokens } from './tokenEstimator.js'
import { getSettings } from '../settings/index.js'
export function createBoundaryManager() {
  let visiblePairs = []
  let model = null
  let settings = { userRequestAllowance: 0, charsPerToken: 4 }
  let dirty = true
  const pendingDirtyReasons = new Set(['init'])
  let cached = null
  function markDirty(r = 'unknown') {
    pendingDirtyReasons.add(r)
    dirty = true
  }
  function updateVisiblePairs(pairs) {
    visiblePairs = Array.isArray(pairs) ? pairs : []
    markDirty('visiblePairs')
  }
  function setModel(m) {
    if (m && m !== model) {
      model = m
      markDirty('model')
    }
  }
  function applySettings(newSettings) {
    if (!newSettings) return
    const { userRequestAllowance, charsPerToken } = newSettings
    let changed = false
    if (
      typeof userRequestAllowance === 'number' &&
      userRequestAllowance !== settings.userRequestAllowance
    ) {
      settings.userRequestAllowance = userRequestAllowance
      changed = true
    }
    if (typeof charsPerToken === 'number' && charsPerToken !== settings.charsPerToken) {
      settings.charsPerToken = charsPerToken
      changed = true
    }
    if (changed) markDirty('settings')
  }
  function recomputeIfNeeded() {
    if (!dirty && cached) return cached
    const { userRequestAllowance: URA, charsPerToken } = settings
    
    // Get ARA from global settings for new boundary calculation
    const globalSettings = getSettings()
    const ARA = globalSettings.assistantResponseAllowance || 0
    
    const res = computeContextBoundaryNew(visiblePairs, {
      reservedTokens: URA + ARA,
      model,
    })
    
    const predictedHistoryTokens = res.stats.totalIncludedTokens
    const predictedTotalTokens = predictedHistoryTokens + URA
    const dirtyReasons = [...pendingDirtyReasons]
    pendingDirtyReasons.clear()
    cached = {
      included: res.included,
      excluded: res.excluded,
      stats: {
        model: res.stats.model,
        predictedMessageCount: res.stats.includedCount,
        predictedHistoryTokens,
        predictedTotalTokens,
        URA,
        charsPerToken,
        maxContext: res.stats.maxContext,
        maxUsable: res.stats.maxUsable,
        dirtyReasons,
      },
    }
    dirty = false
    return cached
  }
  function getBoundary() {
    return recomputeIfNeeded()
  }
  return {
    updateVisiblePairs,
    setModel,
    applySettings,
    markDirty,
    getBoundary,
    _debugState: () => ({
      dirty,
      visibleCount: visiblePairs.length,
      model,
      settings: { ...settings },
    }),
  }
}
