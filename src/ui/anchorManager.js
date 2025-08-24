// Anchor Manager: aligns active part per settings (top/center/bottom) with adaptive/strict edge handling.
import { getSettings } from '../settings/index.js'

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
    container.scrollTop = targetScroll
  }

  return { applyAnchor }
}
