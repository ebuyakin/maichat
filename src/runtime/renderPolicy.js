// Centralized policy for deciding whether a settings change requires
// a history rebuild, a restyle-only update, or no action.
// This is intentionally a pure function to allow easy unit testing.
// REFACTORED (2025-10-10): Keys now imported from schema.js (single source of truth)

import { REBUILD_KEYS, RESTYLE_KEYS, IGNORE_KEYS } from '../core/settings/schema.js'

export function diffChangedKeys(prev, next) {
  const changed = []
  const keys = new Set([...Object.keys(prev || {}), ...Object.keys(next || {})])
  for (const k of keys) {
    if (prev?.[k] !== next?.[k]) changed.push(k)
  }
  return changed
}

// Returns one of: 'none' | 'restyle' | 'rebuild'
export function decideRenderAction(prev, next) {
  const changed = diffChangedKeys(prev || {}, next || {})
  if (changed.length === 0) return 'none'
  let needsRebuild = false
  let needsRestyle = false
  for (const k of changed) {
    if (IGNORE_KEYS.has(k)) continue
    if (REBUILD_KEYS.has(k)) {
      needsRebuild = true
      break
    }
    if (RESTYLE_KEYS.has(k)) needsRestyle = true
  }
  if (needsRebuild) return 'rebuild'
  if (needsRestyle) return 'restyle'
  return 'none'
}

export const __INTERNAL = { REBUILD_KEYS, RESTYLE_KEYS, IGNORE_KEYS }
