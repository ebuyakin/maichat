// gatherContext: assemble context with boundary & stats
import { computeContextBoundary, estimateTokens } from './tokenEstimator.js'

/**
 * Gather context for sending a new request using extended WYSIWYG model.
 * @param {import('../models/messagePair.js').MessagePair[]} visiblePairs chronological filtered order
 * @param {object} opts
 * @param {number} [opts.charsPerToken=4]
 * @param {string} [opts.pendingUserText] optional unsent user text to simulate inclusion for pre-send estimation
 * @returns {{included: import('../models/messagePair.js').MessagePair[], excluded: import('../models/messagePair.js').MessagePair[], stats: object}}
 */
export function gatherContext(visiblePairs, opts={}){
  // All visible pairs are candidates; boundary selects newest that fit.
  const res = computeContextBoundary(visiblePairs, opts)
  const excludedChrono = visiblePairs.filter(p=> !res.included.includes(p))
  const stats = { ...res.stats }
  if(opts.pendingUserText){
    stats.pendingUserTokens = estimateTokens(opts.pendingUserText, opts.charsPerToken||4)
    stats.totalWithPending = stats.totalIncludedTokens + stats.pendingUserTokens
  }
  return { included: res.included, excluded: excludedChrono, stats }
}
