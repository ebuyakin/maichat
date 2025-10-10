// Moved from src/settings/index.js (Phase 5 core move)
// Removed legacy anchorMode / edgeAnchoringMode (stateless scroll now always explicit). Fallback is 'bottom'.
// Updated spacing defaults (2025-09-11): gapOuterPx 15 (was 6), gapMetaPx 4 (was 6), gapIntraPx 4 (was 6)
// Removed unused topZoneLines / bottomZoneLines (2025-09-11) — never implemented in scrollControllerV3; legacy keys are ignored if present in stored JSON.
// REFACTORED (2025-10-10): Settings now defined in schema.js (single source of truth)

import { DEFAULTS } from './schema.js'

const LS_KEY = 'maichat.settings.v1'
let current = null
const listeners = new Set()

// Legacy keys to remove from localStorage (cleaned on every load)
const LEGACY_KEYS = [
  // Fade system (replaced by CSS gradients)
  'fadeMode',
  'fadeHiddenOpacity',
  'fadeInMs',
  'fadeOutMs',
  'fadeTransitionMs',
  // Partition system (replaced by message-based rendering)
  'partFraction',
  'partPadding',
  // Old spacing keys (replaced by new spacing system)
  'gapOuterPx',
  'gapMetaPx',
  'gapIntraPx',
  'gapBetweenPx',
  // Deprecated zone keys
  'topZoneLines',
  'bottomZoneLines',
  // Unused settings
  'showTrimNotice',
]

/**
 * Load settings from localStorage with defaults fallback
 * Automatically cleans legacy keys on every load
 * @returns {Object} Complete settings object
 */
export function loadSettings() {
  if (current) return current
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      
      // Remove all legacy keys if present
      LEGACY_KEYS.forEach((key) => delete parsed[key])
      
      // Legacy fade transition single value → split (for backwards compatibility)
      if (parsed && parsed.fadeTransitionMs != null) {
        if (parsed.fadeInMs == null) parsed.fadeInMs = parsed.fadeTransitionMs
        if (parsed.fadeOutMs == null) parsed.fadeOutMs = parsed.fadeTransitionMs
      }
      
      current = { ...DEFAULTS, ...parsed }
    } else {
      current = { ...DEFAULTS }
    }
  } catch {
    current = { ...DEFAULTS }
  }
  return current
}

/**
 * Save settings patch to localStorage and notify all listeners
 * @param {Object} patch - Settings to update (merged with existing)
 * @returns {Object} Updated complete settings object
 */
export function saveSettings(patch) {
  current = { ...loadSettings(), ...patch }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(current))
  } catch {}
  for (const fn of listeners) fn(current)
  return current
}

/**
 * Get current settings (loads if not already loaded)
 * @returns {Object} Complete settings object
 */
export function getSettings() {
  return loadSettings()
}

/**
 * Subscribe to settings changes
 * @param {Function} fn - Callback function(settings)
 * @returns {Function} Unsubscribe function
 */
export function subscribeSettings(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * Reset all settings to defaults
 */
export function resetSettings() {
  current = { ...DEFAULTS }
  saveSettings({})
}

/**
 * Get default settings (from schema)
 * @returns {Object} Default settings object
 */
export function getDefaultSettings() {
  return { ...DEFAULTS }
}
