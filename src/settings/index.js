// Settings module: load/save + subscription.
// Provides reactive settings object used by partition & anchoring.

const DEFAULTS = {
  partFraction: 0.6,            // fraction of viewport height target for parts before splitting
  anchorMode: 'bottom',          // 'top' | 'center' | 'bottom'
  edgeAnchoringMode: 'adaptive', // 'adaptive' | 'strict'
  paddingPx: 8,
  gapPx: 6,
  topZoneLines: 0,               // reserved for future (sticky zone lines)
  bottomZoneLines: 0
}

const LS_KEY = 'maichat.settings.v1'

let current = null
const listeners = new Set()

export function loadSettings(){
  if(current) return current
  try {
    const raw = localStorage.getItem(LS_KEY)
    if(raw){
      const parsed = JSON.parse(raw)
      current = { ...DEFAULTS, ...parsed }
    } else current = { ...DEFAULTS }
  } catch { current = { ...DEFAULTS } }
  return current
}

export function saveSettings(patch){
  current = { ...loadSettings(), ...patch }
  try { localStorage.setItem(LS_KEY, JSON.stringify(current)) } catch {}
  for(const fn of listeners) fn(current)
  return current
}

export function getSettings(){ return loadSettings() }

export function subscribeSettings(fn){ listeners.add(fn); return () => listeners.delete(fn) }

export function resetSettings(){ current = { ...DEFAULTS }; saveSettings({}) }
