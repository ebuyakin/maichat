// gatherContext: assemble context with boundary & stats
import { computeContextBoundary } from './tokenEstimator.js'

/**
 * Gather context for sending a new request using extended WYSIWYG model.
 * @param {import('../models/messagePair.js').MessagePair[]} visiblePairs chronological filtered order
 * @param {object} opts
 * @param {number} [opts.charsPerToken=4]
 * @returns {{included: import('../models/messagePair.js').MessagePair[], excluded: import('../models/messagePair.js').MessagePair[], stats: object}}
 */
export function gatherContext(visiblePairs, opts={}){
  // Filter to those flagged includeInContext first (policy: only those eligible considered for boundary)
  const eligible = visiblePairs.filter(p=> p.includeInContext)
  const res = computeContextBoundary(eligible, opts)
  // Excluded list for UI should be: (eligible but outside boundary) plus (ineligible by flag) in chronological order, but marking reason difference later if needed.
  const ineligible = visiblePairs.filter(p=> !p.includeInContext)
  const boundaryExcludedSet = new Set(res.excluded.map(p=> p.id))
  const excludedChrono = []
  for(const p of visiblePairs){
    if(res.included.find(ip=> ip.id===p.id)) continue
    excludedChrono.push(p)
  }
  return { included: res.included, excluded: excludedChrono, stats: res.stats }
}
