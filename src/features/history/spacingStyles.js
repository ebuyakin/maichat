// spacingStyles.js — set CSS variables on :root for spacing/fade so CSS can style history
export function applySpacingStyles(settings) {
  if (!settings) return
  const {
    fadeZonePx,
    messageGapPx,
    assistantGapPx,
    messagePaddingPx,
    metaGapPx,
    gutterLPx,
    gutterRPx,
    historyBgLightness,
    textLightnessPct,
    fontWeightNormal,
    fontWeightStrong,
    fadeInMs = 120,
    fadeOutMs = 120,
    fadeTransitionMs = 120,
    twoColumns,
    justifyColumns,
  } = settings
  const baseFadeMs = Math.max(fadeInMs || 0, fadeOutMs || 0, fadeTransitionMs || 0)
  const root = document.documentElement
  if (Number.isFinite(fadeZonePx)) root.style.setProperty('--fade-zone', `${fadeZonePx}px`)
  if (Number.isFinite(messageGapPx)) root.style.setProperty('--message-gap', `${messageGapPx}px`)
  if (Number.isFinite(assistantGapPx))
    root.style.setProperty('--assistant-gap', `${assistantGapPx}px`)
  if (Number.isFinite(messagePaddingPx))
    root.style.setProperty('--message-padding', `${messagePaddingPx}px`)
  if (Number.isFinite(metaGapPx)) root.style.setProperty('--meta-gap', `${metaGapPx}px`)
  if (Number.isFinite(gutterLPx)) root.style.setProperty('--gutter-l', `${gutterLPx}px`)
  if (Number.isFinite(gutterRPx)) root.style.setProperty('--gutter-r', `${gutterRPx}px`)
  if (Number.isFinite(historyBgLightness)) {
    root.style.setProperty('--history-bg', `hsl(0, 0%, ${historyBgLightness}%)`)
  }
  if (Number.isFinite(textLightnessPct)) {
    root.style.setProperty('--text', `hsl(0, 0%, ${textLightnessPct}%)`)
  }
  // Assistant reading layout (columns + justification)
  try {
    root.style.setProperty('--assistant-columns', twoColumns ? '2' : '1')
    // Only meaningful when columns > 1; safe fallback is 'left'
    root.style.setProperty('--assistant-text-align', justifyColumns ? 'justify' : 'left')
    // Lists indentation tuned for columns
    root.style.setProperty('--assistant-list-ul-padding', twoColumns ? '1.2em' : '2em')
    root.style.setProperty('--assistant-list-ol-padding', twoColumns ? '1.6em' : '2em')
    root.style.setProperty('--assistant-list-nested-padding', twoColumns ? '1.1em' : '1.5em')
  } catch {}
  if (Number.isFinite(fontWeightNormal)) {
    root.style.setProperty('--font-w-normal', String(fontWeightNormal))
  }
  if (Number.isFinite(fontWeightStrong)) {
    root.style.setProperty('--font-w-strong', String(fontWeightStrong))
  }

  // Update topBar and inputBar padding dynamically
  if (
    Number.isFinite(gutterLPx) &&
    Number.isFinite(gutterRPx) &&
    Number.isFinite(messagePaddingPx)
  ) {
    const topBar = document.getElementById('topBar')
    const inputBar = document.getElementById('inputBar')
    const leftPadding = `${gutterLPx + messagePaddingPx}px`
    const rightPadding = `${gutterRPx + messagePaddingPx}px`

    if (topBar) {
      topBar.style.paddingLeft = leftPadding
      topBar.style.paddingRight = rightPadding
    }
    if (inputBar) {
      inputBar.style.paddingLeft = leftPadding
      inputBar.style.paddingRight = rightPadding
    }
  }

  // Fade base var (used as default; JS still governs per-part durations)
  root.style.setProperty('--fade-transition-ms', `${baseFadeMs}ms`)
}
