// spacingStyles.js — set CSS variables on :root for spacing/fade so CSS can style history
export function applySpacingStyles(settings){
  if(!settings) return
  const {
    partPadding = 4,
    gapOuterPx = 20,
    gapMetaPx = 6,
    gapIntraPx = 6,
    gapBetweenPx = 10,
    fadeInMs = 120,
    fadeOutMs = 120,
    fadeTransitionMs = 120,
  } = settings
  const baseFadeMs = Math.max(fadeInMs||0, fadeOutMs||0, fadeTransitionMs||0)
  const root = document.documentElement
  // Spacing vars
  root.style.setProperty('--gap-outer', `${gapOuterPx}px`)
  root.style.setProperty('--gap-meta', `${gapMetaPx}px`)
  root.style.setProperty('--gap-intra', `${gapIntraPx}px`)
  root.style.setProperty('--gap-between', `${gapBetweenPx}px`)
  root.style.setProperty('--part-padding', `${partPadding}px`)
  // Fade base var (used as default; JS still governs per-part durations)
  root.style.setProperty('--fade-transition-ms', `${baseFadeMs}ms`)
}
