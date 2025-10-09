// fadeVisibility.js — computes and applies per-part opacity based on scroll position and settings
export function applyFadeVisibility({ paneEl, parts, settings, initial = false }) {
  if (!paneEl || !parts) return
  const G = settings.fadeZonePx || 0
  const fadeMode = settings.fadeMode || 'binary'
  const TOL = 1
  const hiddenOp = typeof settings.fadeHiddenOpacity === 'number' ? settings.fadeHiddenOpacity : 0
  const fadeInMs = settings.fadeInMs != null ? settings.fadeInMs : settings.fadeTransitionMs || 120
  const fadeOutMs =
    settings.fadeOutMs != null ? settings.fadeOutMs : settings.fadeTransitionMs || 120

  const S = paneEl.scrollTop
  const H = paneEl.clientHeight
  const fadeZone = G

  parts.forEach((p) => {
    const top = p.offsetTop
    const h = p.offsetHeight
    const bottom = top + h
    const isActive = p.classList.contains('active')
    const relTop = top - S
    const relBottom = bottom - S
    let op = 1
    if (fadeMode === 'gradient') {
      const effZone = Math.max(0, fadeZone - TOL)
      let topFade = 1
      if (effZone > 0) {
        if (relTop < effZone) {
          topFade = Math.max(0, relTop / effZone)
        } else {
          topFade = 1
        }
      }
      let bottomFade = 1
      const distFromBottom = H - relBottom
      if (effZone > 0) {
        if (distFromBottom < effZone) {
          bottomFade = Math.max(0, distFromBottom / effZone)
        } else {
          bottomFade = 1
        }
      }
      op = Math.min(topFade, bottomFade)
      if (op < 0) op = 0
      if (op > 1) op = 1
    } else {
      const effZone = Math.max(0, fadeZone - TOL)
      const topIntrudes = relTop < effZone
      const bottomIntrudes = H - relBottom < effZone
      if (topIntrudes || bottomIntrudes) op = hiddenOp
    }
    if (isActive) op = 1
    const prev = p.__lastOpacity != null ? p.__lastOpacity : parseFloat(p.style.opacity || '1')
    if (prev !== op) {
      const dirIn = op > prev
      const dur = initial ? 0 : dirIn ? fadeInMs : fadeOutMs
      if (p.__lastFadeDur !== dur) {
        p.style.transitionDuration = dur + 'ms'
        p.__lastFadeDur = dur
      }
      p.style.opacity = String(op)
      p.__lastOpacity = op
    }
    p.style.pointerEvents = op === 0 ? 'none' : ''
  })
}
