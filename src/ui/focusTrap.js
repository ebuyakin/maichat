// focusTrap.js - central modal focus management utility
// Ensures keyboard focus stays within a container while active, and restores prior focus on release.

export function createFocusTrap(container, getPreferredEl){
  const previous = document.activeElement
  let active = true
  function refocus(){
    const el = (getPreferredEl && getPreferredEl()) || container
    if(el && el.focus) { try { el.focus() } catch(_){} }
  }
  function onFocusIn(e){
    if(!active) return
    if(!container.contains(e.target)){
      e.stopPropagation()
      refocus()
    }
  }
  document.addEventListener('focusin', onFocusIn, true)
  // initial ensure
  setTimeout(refocus,0)
  function release(){
    active = false
    document.removeEventListener('focusin', onFocusIn, true)
    if(previous && previous.focus){ try { previous.focus() } catch(_){} }
  }
  return { release, refocus }
}

// Helper to detect any active modal overlay to suppress global shortcuts.
export function modalIsActive(){
  if(document.body.hasAttribute('data-menu-open')) return true
  return !!document.querySelector('.topic-editor-backdrop, .topic-picker-backdrop, #settingsOverlayRoot, .overlay-backdrop.centered')
}
