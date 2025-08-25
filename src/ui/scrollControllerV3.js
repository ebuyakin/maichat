// scrollControllerV3: canonical window based scrolling with full-or-hidden invariant
// Assumes gap elements rendered explicitly (class 'gap') preceding parts as needed.

import { getSettings } from '../settings/index.js'

export function createScrollController({ container, getParts }){
  let metrics = null // { parts:[{id,h,gBefore}], lastIndexForFirst:[], paneH, edgeGap }
  let currentFirst = 0
  let anim = null
  let currentActiveIndex = 0

  function measure(){
    const settings = getSettings()
  const edgeGap = settings.gapOuterPx || 0 // structural (already applied via historyPane offsets)
  const paneH = container.clientHeight
    const nodeList = Array.from(container.querySelectorAll('#history > *'))
    const parts = []
    for(let i=0;i<nodeList.length;i++){
      const node = nodeList[i]
      if(node.classList.contains('part')){
        let gBefore = 0
        const prev = nodeList[i-1]
        if(prev && prev.classList.contains('gap')) gBefore = prev.offsetHeight
        parts.push({ id: node.getAttribute('data-part-id'), h: node.offsetHeight, g: gBefore })
      }
    }
    const N = parts.length
    const lastIndexForFirst = new Array(N).fill(0)
    // For each starting index f, pack greedily downward.
    for(let f=0; f<N; f++){
      const available = paneH // edge gaps are outside pane; do not subtract
      let used = parts[f].h
      let l = f
      for(let k=f+1; k<N; k++){
        const need = parts[k].g + parts[k].h
        if(used + need <= available){ used += need; l = k } else break
      }
      lastIndexForFirst[f] = l
    }
    metrics = { parts, lastIndexForFirst, paneH, edgeGap }
  }

  function canonicalScrollTop(first){
    if(!metrics) return 0
    const settings = getSettings()
    const mode = settings.anchorMode || 'bottom'
    if(mode === 'top'){
      const firstPart = metrics.parts[first]
      if(!firstPart) return 0
      const el = container.querySelector(`[data-part-id="${firstPart.id}"]`)
      if(!el) return 0
      const padTop = parseFloat(getComputedStyle(container).paddingTop)||0
      // offsetTop already includes padding; subtract padding to get pure prefix sum equivalent
      return el.offsetTop - padTop
    }
    const { parts } = metrics
    let sum = 0
    for(let i=0;i<first;i++) sum += parts[i].g + parts[i].h
    return sum
  }

  function chooseFirst(activeIndex){
    if(!metrics) return 0
    const { parts, lastIndexForFirst } = metrics
    const N = parts.length
    if(!N) return 0
    const settings = getSettings()
    const mode = settings.anchorMode || 'bottom'

    const clampActive = Math.max(0, Math.min(activeIndex, N-1))

    if(mode === 'top'){
  // Absolute rule: active is always first (no relaxation)
  return clampActive
    } else if(mode === 'bottom'){
      // Find minimal f such that lastIndexForFirst[f] >= active
      let candidate = 0
      for(let f=0; f<N; f++){
        if(lastIndexForFirst[f] >= clampActive){ candidate = f; break }
      }
      // Relax if candidate ==0 meaning nothing hidden above: try increasing f while active still visible and lastIndex same? we keep 0
      return candidate
    } else { // center heuristic: pick f minimizing distance to center
      let bestF = 0
      let bestScore = Infinity
      for(let f=0; f<N; f++){
        const l = lastIndexForFirst[f]
        if(l < clampActive) continue
        if(f > clampActive) break
        const mid = (f + l)/2
        const score = Math.abs(clampActive - mid)
        if(score < bestScore){ bestScore = score; bestF = f }
      }
      // Relaxation if at end: similar to top (if window hits end, shift up)
      const Nminus1 = N-1
      while(bestF>0 && lastIndexForFirst[bestF] === Nminus1 && lastIndexForFirst[bestF-1] === Nminus1 && clampActive >= bestF-1){ bestF-- }
      return bestF
    }
  }

  function apply(activeIndex, animate=true){
    if(!metrics) measure()
    const first = chooseFirst(activeIndex)
    const target = canonicalScrollTop(first)
    if(Math.abs(container.scrollTop - target) > 1){ scrollTo(target, animate) }
    currentFirst = first
  currentActiveIndex = activeIndex
  // No spacer; container padding supplies outer gap.
    // Post-frame validate (double RAF to allow font/layout settling)
    requestAnimationFrame(()=> requestAnimationFrame(validate))
  }

  function validate(){
    if(!metrics) return
  // edgeGap structural already applied; no internal adjustment here
    // Re-measure heights (in case of font reflow) and recompute canonical
    const settings = getSettings()
    const mode = settings.anchorMode || 'bottom'
    if(mode === 'top'){
      // Strict realignment using DOM offsetTop only
      const prevFirst = currentFirst
      const prevActive = currentActiveIndex
      measure()
      const target = canonicalScrollTop(prevFirst)
      if(Math.abs(container.scrollTop - target) > 0.5){ container.scrollTop = target }
      currentActiveIndex = prevActive
      return
    }
    const prevFirst = currentFirst
    measure()
    const target = canonicalScrollTop(prevFirst)
    const delta = container.scrollTop - target
    if(Math.abs(delta) > 0.5){ container.scrollTop = Math.round(target) }
    // Ensure active part fully visible (non-top modes only for now)
    // Optionally we could re-apply to active index if mismatch persists.
  }

  // enforceTopModeGap removed (container padding now authoritative)

  function scrollTo(target, animate){
    cancelAnimation()
    target = Math.max(0, Math.round(target))
    if(!animate){ container.scrollTop = target; return }
    const start = container.scrollTop
    const dist = target - start
    if(Math.abs(dist) < 2){ container.scrollTop = target; return }
    const dur = 140
    const t0 = performance.now()
    function ease(t){ return 1 - (1-t)*(1-t) }
    function step(now){
      const p = Math.min(1, (now - t0)/dur)
      container.scrollTop = start + dist * ease(p)
      if(p < 1) anim = requestAnimationFrame(step)
      else anim = null
    }
    anim = requestAnimationFrame(step)
  }

  function cancelAnimation(){ if(anim){ cancelAnimationFrame(anim); anim=null } }

  function remeasure(){ measure() }
  function debugInfo(){
    if(!metrics) return null
    const { parts, lastIndexForFirst, paneH } = metrics
    const first = currentFirst
    const active = currentActiveIndex
    if(parts.length === 0) return { parts:0 }
    const last = lastIndexForFirst[first] || first
    const containerRect = container.getBoundingClientRect()
    const visibleIndices = []
    const tops = []
    const heights = []
    for(let i=first;i<=last;i++){
      const id = parts[i].id
      const el = container.querySelector(`[data-part-id="${id}"]`)
      if(!el) continue
      const r = el.getBoundingClientRect()
      visibleIndices.push(i)
      tops.push(Math.round(r.top - containerRect.top))
      heights.push(r.height)
    }
    let firstTopPx = null
    if(visibleIndices.length){ firstTopPx = tops[0] }
    // visual gap for top mode relative to content padding
    let visualGap = null
    const settings2 = getSettings()
    if(settings2.anchorMode === 'top' && firstTopPx != null){
      const padTop = parseFloat(getComputedStyle(container).paddingTop)||0
      visualGap = firstTopPx - padTop
    }
    return { mode:(getSettings().anchorMode||'bottom'), paneH, currentFirst:first, activeIndex:active, shouldVisibleCount:(last-first+1), firstTopPx, visualGap, visibleIndices, tops, heights, scrollTop: container.scrollTop }
  }

  return { remeasure, apply, debugInfo }
}
