// Discrete window-based scrolling & snapping
// Provides canonical first-index based scroll positions ensuring full-part visibility

import { getSettings } from '../settings/index.js'

export function createWindowScroller({ container }){
  if(!container) throw new Error('container required')
  let parts = [] // [{id, el, height, top}]
  let firstVisibleIndex = 0

  function measure(){
    // We store offsetTop (position within scroll content independent of current scrollTop)
    parts.forEach(p=>{
      const el = container.querySelector(`[data-part-id="${p.id}"]`)
      if(!el) return
      p.offsetTop = el.offsetTop
      p.height = el.offsetHeight
      if(typeof window !== 'undefined'){
        const cs = window.getComputedStyle(el)
        p.marginTop = parseFloat(cs.marginTop)||0
      } else { p.marginTop = 0 }
    })
  }

  function setParts(list){
  parts = list.map(p=> ({ id:p.id, height:0, offsetTop:0, marginTop:0 }))
    // defer measure to next frame when DOM rendered
    requestAnimationFrame(()=>{ measure(); snapToActive(false) })
  }

  function paneHeight(){ return container.clientHeight }

  function computeWindow(activeIdx){
    const settings = getSettings()
    const mode = settings.anchorMode || 'bottom'
    const G = settings.gapOuterPx || 0
    const H = paneHeight()
    if(!parts.length) return { first:0, last:-1, scrollTop:0 }
    // Ensure measurements
    measure()
    // Guarantee heights known
    const clampedActive = Math.max(0, Math.min(activeIdx, parts.length-1))
    // Greedy strategies per mode
    if(mode === 'top'){
      // Active intended at top (edge gap G). We compute window downward.
      let first = clampedActive
      let last = first
      // Space used so far: top gap + active height + bottom gap
      let used = G + parts[clampedActive].height + G
      for(let i=clampedActive+1; i<parts.length; i++){
        const part = parts[i]
        const needed = part.marginTop + part.height
        if(used + needed <= H){ last = i; used += needed } else break
      }
      // Relaxation: if we ended at very end, attempt to backfill upwards fully (drop strict anchoring)
      if(last === parts.length-1){
        let newFirst = first
        while(newFirst>0){
          const prev = parts[newFirst-1]
          const needed = prev.marginTop + prev.height
          if(used + needed <= H){ newFirst--; used += needed } else break
        }
        first = newFirst
      }
      // Align so first part's BORDER (not its margin-top) sits at gap.
  const targetTop = parts[first].offsetTop - parts[first].marginTop - G
      return { first, last, scrollTop: targetTop }
    } else if(mode === 'bottom'){
      let last = clampedActive
      let first = last
      let used = G + parts[clampedActive].height + G
      for(let i=clampedActive-1; i>=0; i--){
        const part = parts[i]
        const needed = part.marginTop + part.height
        if(used + needed <= H){ first = i; used += needed } else break
      }
      if(first === 0){
        // Try forward fill (relaxation)
        let newLast = last
        while(newLast < parts.length-1){
          const part = parts[newLast+1]
          const needed = part.marginTop + part.height
          if(used + needed <= H){ newLast++; used += needed } else break
        }
        last = newLast
      }
  const targetTop = parts[first].offsetTop - parts[first].marginTop - G
      return { first, last, scrollTop: targetTop }
    } else { // center
      // Start with active centered approximated; then expand
      const active = parts[clampedActive]
      let first = clampedActive
      let last = clampedActive
      let used = active.height
      // alternate expansion
      for(let radius=1; ; radius++){
        const left = clampedActive - radius
        const right = clampedActive + radius
        let progressed = false
        if(left >=0){ const part = parts[left]; const needed = part.height + part.marginTop; if(used + needed <= H){ first = left; used += needed; progressed = true } }
        if(right < parts.length){ const part = parts[right]; const needed = part.height + part.marginTop; if(used + needed <= H){ last = right; used += needed; progressed = true } }
        if(!progressed) break
      }
  const targetTop = parts[first].offsetTop - parts[first].marginTop - G
      return { first, last, scrollTop: targetTop }
    }
  }

  function snapToActive(animate=true){
    const activeId = window.__activePartId
    if(!activeId) return
    const idx = parts.findIndex(p=> p.id===activeId)
    if(idx===-1) return
    const w = computeWindow(idx)
    firstVisibleIndex = w.first
    if(Math.abs(container.scrollTop - w.scrollTop) > 2){
      if(animate) smoothScrollTo(w.scrollTop)
      else container.scrollTop = w.scrollTop
    }
  }

  function smoothScrollTo(target){
    const start = container.scrollTop
    const dist = target - start
    const dur = 140
    const t0 = performance.now()
    function ease(t){ return 1 - (1-t)*(1-t) }
    function step(now){
      const p = Math.min(1, (now - t0)/dur)
      container.scrollTop = start + dist * ease(p)
      if(p<1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }

  function onWheel(e){
    if(!parts.length) return
    e.preventDefault()
    const dir = e.deltaY > 0 ? 1 : -1
    const activeId = window.__activePartId
    const idx = parts.findIndex(p=> p.id===activeId)
    if(idx===-1) return
    const nextIdx = Math.max(0, Math.min(parts.length-1, idx + dir))
    if(nextIdx !== idx){
      window.__setActiveIndex(nextIdx) // delegate to activeParts controller via global hook
    }
  }

  container.addEventListener('wheel', onWheel, { passive:false })

  return { setParts, snapToActive, recompute: ()=>{ measure(); snapToActive(false) } }
}
