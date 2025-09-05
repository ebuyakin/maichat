// LEGACY: anchorManager (superseded by scrollControllerV3). Retained temporarily for reference; scheduled for deletion after confirmation of non-use.
// Original location: src/ui/anchorManager.js
import { getSettings } from '../core/settings/index.js'

export function computeScrollFor(elementOffset, elementHeight, container, mode, edgeMode){
  const viewportHeight = container.clientHeight
  let alignY
  if(mode === 'top') alignY = 0
  else if(mode === 'center') alignY = Math.max(0, (viewportHeight - elementHeight)/2)
  else alignY = Math.max(0, viewportHeight - elementHeight) // bottom
  let rawScroll = elementOffset - alignY
  const maxScroll = Math.max(0, container.scrollHeight - viewportHeight)
  if(edgeMode === 'adaptive'){
    if(rawScroll < 0) rawScroll = 0
    else if(rawScroll > maxScroll) rawScroll = maxScroll
  } else {
    if(rawScroll < 0) rawScroll = 0
    if(rawScroll > maxScroll) rawScroll = maxScroll
  }
  return rawScroll
}

export function createAnchorManager({ container }){
  if(!container) throw new Error('anchor container missing')
  let anim = null
  function cancelAnim(){ if(anim){ cancelAnimationFrame(anim.raf); anim=null } }

  function animateScroll(target){
    cancelAnim()
    const start = container.scrollTop
    const delta = target - start
    if(Math.abs(delta) < 4){ container.scrollTop = target; return }
    const duration = 140 // ms
    const t0 = performance.now()
    anim = { raf: null }
    function easeOutQuad(t){ return 1 - (1-t)*(1-t) }
    function step(now){
      const elapsed = now - t0
      const p = Math.min(1, elapsed / duration)
      const eased = easeOutQuad(p)
      container.scrollTop = start + delta * eased
      if(p < 1) anim.raf = requestAnimationFrame(step)
      else anim = null
    }
    anim.raf = requestAnimationFrame(step)
  }

  function applyAnchor(activeId){
    const el = container.querySelector(`[data-part-id="${activeId}"]`)
    if(!el) return
    const settings = getSettings()
    const mode = settings.anchorMode || 'bottom'
    const edgeMode = settings.edgeAnchoringMode || 'adaptive'
    const paneRect = container.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    const currentScroll = container.scrollTop
    const elementOffset = elRect.top - paneRect.top + currentScroll
    const targetScroll = computeScrollFor(elementOffset, elRect.height, container, mode, edgeMode)
    animateScroll(targetScroll)
  }

  return { applyAnchor }
}
