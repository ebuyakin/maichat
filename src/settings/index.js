// Settings module: load/save + subscription.
// Provides reactive settings object used by partition & anchoring.

const DEFAULTS = {
  partFraction: 0.6,            // fraction of viewport height target for parts before splitting
  anchorMode: 'bottom',         // 'top' | 'center' | 'bottom'
  edgeAnchoringMode: 'adaptive',// 'adaptive' | 'strict'
  // New granular spacing controls (uniform padding & gap families)
  partPadding: 4,               // uniform inner padding (px) applied inside part-inner wrapper
  gapOuterPx: 6,                // top & bottom padding of history pane
  gapMetaPx: 6,                 // user→meta and meta→assistant
  gapIntraPx: 6,                // user→user and assistant→assistant
  gapBetweenPx: 10,             // between messages (pairs)
  topZoneLines: 0,              // reserved future
  bottomZoneLines: 0,
  // Visibility / fade system
  fadeMode: 'binary',           // 'binary' | 'gradient'
  fadeHiddenOpacity: 0,         // opacity applied to parts outside viewing window when binary
  // Directional fade durations (fadeTransitionMs legacy kept for migration)
  fadeInMs: 120,                // fade-in duration (ms)
  fadeOutMs: 120,               // fade-out duration (ms)
  fadeTransitionMs: 120,        // legacy single duration (if present, migrates to both)
  scrollAnimMs: 240,            // base duration (ms) for medium-distance animated scroll
  scrollAnimEasing: 'easeOutQuad', // 'linear' | 'easeOutQuad' | 'easeInOutCubic' | 'easeOutExpo'
  scrollAnimDynamic: true,      // scale duration by distance relative to viewport height
  scrollAnimMinMs: 80,          // min duration clamp when dynamic
  scrollAnimMaxMs: 600,         // max duration clamp when dynamic
  // Context assembly performance guardrails
  assumedUserTokens: 256,       // allowance reserved in boundary calc for next prompt
  showTrimNotice: false         // if true, show transient notice when large prompt trims extra pairs
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
      // Migration from legacy keys paddingPx/gapPx (pre granular spacing)
      if(parsed && (parsed.paddingPx !== undefined || parsed.gapPx !== undefined)){
        if(parsed.paddingPx !== undefined && parsed.partPadding === undefined) parsed.partPadding = parsed.paddingPx
        if(parsed.gapPx !== undefined){
          if(parsed.gapIntraPx === undefined) parsed.gapIntraPx = parsed.gapPx
          if(parsed.gapMetaPx === undefined) parsed.gapMetaPx = parsed.gapPx
          if(parsed.gapOuterPx === undefined) parsed.gapOuterPx = parsed.gapPx
          if(parsed.gapBetweenPx === undefined) parsed.gapBetweenPx = parsed.gapPx
        }
        delete parsed.paddingPx; delete parsed.gapPx
      }
      // Migration: if old single fadeTransitionMs exists but new directional values missing, copy it.
      if(parsed && parsed.fadeTransitionMs != null){
        if(parsed.fadeInMs == null) parsed.fadeInMs = parsed.fadeTransitionMs
        if(parsed.fadeOutMs == null) parsed.fadeOutMs = parsed.fadeTransitionMs
      }
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
