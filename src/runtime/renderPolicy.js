// Centralized policy for deciding whether a settings change requires
// a history rebuild, a restyle-only update, or no action.
// This is intentionally a pure function to allow easy unit testing.

const REBUILD_KEYS = new Set([
  // Composition/layout impacting keys
  'partFraction',
  'partPadding',
  'userRequestAllowance',
  'charsPerToken',
])

const RESTYLE_KEYS = new Set([
  // Pure spacing/fade/animation UI knobs
  'gapOuterPx', 'gapMetaPx', 'gapIntraPx', 'gapBetweenPx',
  'fadeMode', 'fadeHiddenOpacity', 'fadeInMs', 'fadeOutMs', 'fadeTransitionMs',
  'scrollAnimMs', 'scrollAnimEasing', 'scrollAnimDynamic', 'scrollAnimMinMs', 'scrollAnimMaxMs',
  'showTrimNotice',
])

// Keys that are explicitly ignored with respect to view updates
const IGNORE_KEYS = new Set([
  // Overlay-only preferences that should not trigger re-render
  'topicOrderMode',
  // Misc not impacting the view
  'assumedUserTokens',
  'maxTrimAttempts',
])

export function diffChangedKeys(prev, next){
  const changed = []
  const keys = new Set([...Object.keys(prev||{}), ...Object.keys(next||{})])
  for(const k of keys){
    if(prev?.[k] !== next?.[k]) changed.push(k)
  }
  return changed
}

// Returns one of: 'none' | 'restyle' | 'rebuild'
export function decideRenderAction(prev, next){
  const changed = diffChangedKeys(prev||{}, next||{})
  if(changed.length === 0) return 'none'
  let needsRebuild = false
  let needsRestyle = false
  for(const k of changed){
    if(IGNORE_KEYS.has(k)) continue
    if(REBUILD_KEYS.has(k)) { needsRebuild = true; break }
    if(RESTYLE_KEYS.has(k)) needsRestyle = true
  }
  if(needsRebuild) return 'rebuild'
  if(needsRestyle) return 'restyle'
  return 'none'
}

export const __INTERNAL = { REBUILD_KEYS, RESTYLE_KEYS, IGNORE_KEYS }
