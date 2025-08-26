// scrollControllerV3: canonical window based scrolling with full-or-hidden invariant
// Assumes gap elements rendered explicitly (class 'gap') preceding parts as needed.

import { getSettings } from '../settings/index.js'

export function createScrollController({ container, getParts }){
  // metrics: structural measurements for current DOM snapshot
  // parts: [{id,h,g,start}] where start = prefix sum of previous parts+gaps relative to content start (excluding container padding)
  let metrics = null // { parts:[], paneH, edgeGap, totalContentH }
  let anim = null
  let currentActiveIndex = 0
  let appliedScrollTop = 0 // last scrollTop we explicitly set (post animation)
  let visibleWindow = { first:0, last:0 }

  function measure(){
    const settings = getSettings()
    const edgeGap = settings.gapOuterPx || 0 // structural (already applied as container padding top/bottom)
    const paneH = container.clientHeight
    const nodeList = Array.from(container.querySelectorAll('#history > *'))
    const parts = []
    const padTop = parseFloat(getComputedStyle(container).paddingTop)||0
    for(let i=0;i<nodeList.length;i++){
      const node = nodeList[i]
      if(!node.classList.contains('part')) continue
      const h = node.offsetHeight
      // start coordinate in "internal" system excludes top padding
      const start = node.offsetTop - padTop
      // derive gap height relative to previous part bottom (robust to multiple consecutive gap elements)
      let gBefore = 0
      if(parts.length){
        const prev = parts[parts.length-1]
        const prevBottom = prev.start + prev.h
        const rawGap = start - prevBottom
        if(rawGap > 0) gBefore = rawGap
      } else {
        // first part: expect start ≈ 0; treat any positive deviation as (unexpected) leading gap beyond padding
        if(start > 0) gBefore = start
      }
      parts.push({ id: node.getAttribute('data-part-id'), h, g: gBefore, start })
    }
    let totalContentH = 0
    if(parts.length){
      const last = parts[parts.length-1]
      totalContentH = last.start + last.h + edgeGap
    }
    metrics = { parts, paneH, edgeGap, totalContentH } // totalContentH includes ideal bottom outer gap
  }

  // Direct anchor computation for active part (index k) producing desired scrollTop.
  function anchorScrollTop(k){
    if(!metrics) return 0
    const settings = getSettings()
    const mode = settings.anchorMode || 'bottom'
    const { parts, paneH, edgeGap } = metrics
    if(k < 0 || k >= parts.length) return 0
    const padTop = parseFloat(getComputedStyle(container).paddingTop)||0 // expected == edgeGap
    const padBottom = parseFloat(getComputedStyle(container).paddingBottom)||0
    const part = parts[k]
    // start coordinate already excludes top padding; offsetTop - padTop equals part.start
    // So we can rely on part.start for geometry.
    let S
    if(mode === 'top'){
      // Visual gap above part: padding-top = G. With scrollTop = part.start (which excludes G) the gap is maintained.
      S = part.start
    } else if(mode === 'bottom'){
      // Want visual gap below part = G.
  // Spec formula (using start_including_G): S = start_including_G + p_k - (H_total - G)
  // Our stored part.start excludes top padding (G), so start_including_G = part.start + padTop.
  // Substitute: S = (part.start + padTop) + part.h - (paneH - padBottom)
  // If top & bottom gaps equal (padTop==padBottom==G) this reduces to S = part.start + part.h - (paneH - G) + G
  S = (part.start + part.h) - (paneH - padBottom) + padTop
    } else { // center
      // Desired: part midpoint at pane midpoint (including padding). midpointVis = S + paneH/2
      S = (part.start + part.h/2) - (paneH/2)
    }
  const raw = Number.isFinite(S)? S : 0
  let S2 = Math.round(raw)
  const maxScroll = Math.max(0, container.scrollHeight - paneH)
  if(S2 < 0) S2 = 0
  if(S2 > maxScroll) S2 = maxScroll
  // attach last debug
  anchorScrollTop._last = { raw, clamped:S2, maxScroll }
  return S2
  }
  // After scroll we derive which parts are fully visible (first & last) for debug/HUD consistency.
  function computeVisibleWindow(){
    if(!metrics) return { first:0, last:0 }
    const { parts, paneH } = metrics
    if(parts.length === 0) return { first:0, last:0 }
    const S = container.scrollTop
    const viewBottom = S + paneH
    let first = 0
    for(let i=0;i<parts.length;i++){
      const top = parts[i].start
      const bottom = top + parts[i].h
      if(top >= S){ first = i; break }
      if(bottom > S){ first = i; break } // part straddles top (masked); treated as first
    }
    let last = first
    for(let i=first;i<parts.length;i++){
      const top = parts[i].start
      const bottom = top + parts[i].h
      if(bottom <= viewBottom) last = i
      else break
    }
    return { first, last }
  }

  function apply(activeIndex, animate=true){
    if(!metrics) measure()
    const k = Math.max(0, Math.min(activeIndex, metrics.parts.length-1))
    currentActiveIndex = k
    const target = anchorScrollTop(k)
    if(Math.abs(container.scrollTop - target) > 1){ scrollTo(target, animate) }
    else appliedScrollTop = target
    // Post-frame validate to correct drift after layout settles
    requestAnimationFrame(()=> requestAnimationFrame(validate))
  }

  function validate(){
    if(!metrics) return
    const prevActive = currentActiveIndex
    measure()
    const target = anchorScrollTop(prevActive)
    if(Math.abs(container.scrollTop - target) > 0.5){ container.scrollTop = target }
    appliedScrollTop = target
    visibleWindow = computeVisibleWindow()
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
    const { parts, paneH } = metrics
    if(parts.length === 0) return { parts:0 }
    const containerRect = container.getBoundingClientRect()
    const vis = computeVisibleWindow()
    const visibleIndices = []
    const tops = []
    const heights = []
    for(let i=vis.first; i<=vis.last; i++){
      const id = parts[i].id
      const el = container.querySelector(`[data-part-id="${id}"]`)
      if(!el) continue
      const r = el.getBoundingClientRect()
      visibleIndices.push(i)
      tops.push(Math.round(r.top - containerRect.top))
      heights.push(r.height)
    }
    let firstTopPx = tops.length? tops[0] : null
    let visualGap = null
    const settings2 = getSettings()
    if(settings2.anchorMode === 'top' && firstTopPx != null){
      const padTop = parseFloat(getComputedStyle(container).paddingTop)||0
      visualGap = firstTopPx - padTop
    }
  const anchorMeta = anchorScrollTop._last || {}
    // For bottom mode add diagnostic of actual gap below active part
    let gapBelow = null
    if(getSettings().anchorMode === 'bottom'){
      const padTop = parseFloat(getComputedStyle(container).paddingTop)||0
      const part = parts[currentActiveIndex]
      if(part){
        gapBelow = paneH - (part.start + part.h + padTop - container.scrollTop)
        gapBelow = Math.round(gapBelow)
      }
    }
    return { mode:(getSettings().anchorMode||'bottom'), paneH, currentFirst:vis.first, activeIndex:currentActiveIndex, shouldVisibleCount:(vis.last-vis.first+1), firstTopPx, visualGap, visibleIndices, tops, heights, scrollTop: container.scrollTop, rawAnchor: anchorMeta.raw, maxScroll: anchorMeta.maxScroll, gapBelow }
  }

  return { remeasure: measure, apply, debugInfo }
}
