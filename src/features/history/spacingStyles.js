// spacingStyles.js — set CSS variables on :root for spacing/fade so CSS can style history
export function applySpacingStyles(settings){
  if(!settings) return
  const {
    fadeZonePx,
    messageGapPx,
    assistantGapPx,
    messagePaddingPx,
    metaGapPx,
    gutterLPx,
    gutterRPx,
    fadeInMs = 120,
    fadeOutMs = 120,
    fadeTransitionMs = 120,
  } = settings
  const baseFadeMs = Math.max(fadeInMs||0, fadeOutMs||0, fadeTransitionMs||0)
  const root = document.documentElement
  if(Number.isFinite(fadeZonePx)) root.style.setProperty('--fade-zone', `${fadeZonePx}px`)
  if(Number.isFinite(messageGapPx)) root.style.setProperty('--message-gap', `${messageGapPx}px`)
  if(Number.isFinite(assistantGapPx)) root.style.setProperty('--assistant-gap', `${assistantGapPx}px`)
  if(Number.isFinite(messagePaddingPx)) root.style.setProperty('--message-padding', `${messagePaddingPx}px`)
  if(Number.isFinite(metaGapPx)) root.style.setProperty('--meta-gap', `${metaGapPx}px`)
  if(Number.isFinite(gutterLPx)) root.style.setProperty('--gutter-l', `${gutterLPx}px`)
  if(Number.isFinite(gutterRPx)) root.style.setProperty('--gutter-r', `${gutterRPx}px`)
  // Fade base var (used as default; JS still governs per-part durations)
  root.style.setProperty('--fade-transition-ms', `${baseFadeMs}ms`)
}
