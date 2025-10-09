// Moved from src/ui/focusTrap.js (Phase 4 shared primitives move)
export function createFocusTrap(container, getPreferredEl) {
  const previous = document.activeElement
  let active = true
  function refocus() {
    const el = (getPreferredEl && getPreferredEl()) || container
    if (el && el.focus) {
      try {
        el.focus()
      } catch (_) {}
    }
  }
  function onFocusIn(e) {
    if (!active) return
    if (!container.contains(e.target)) {
      e.stopPropagation()
      refocus()
    }
  }
  document.addEventListener('focusin', onFocusIn, true)
  setTimeout(refocus, 0)
  function release() {
    active = false
    document.removeEventListener('focusin', onFocusIn, true)
    if (previous && previous.focus) {
      try {
        previous.focus()
      } catch (_) {}
    }
  }
  return { release, refocus }
}

export function modalIsActive() {
  if (document.body.hasAttribute('data-menu-open')) return true
  return !!document.querySelector(
    '.topic-editor-backdrop, .topic-picker-backdrop, #settingsOverlayRoot, .overlay-backdrop.centered'
  )
}
