// historyRuntime.js (Phase 1 Step 3)
// Extracted rendering, layout sizing, spacing styles, active part application, fade visibility,
// message counts, context inclusion styling, boundary jump & status indicator.
// ZERO behavioral changes intended.

import { buildParts } from '../parts.js'
import { getSettings, subscribeSettings } from '../../settings/index.js'
import { invalidatePartitionCacheOnResize } from '../../partition/partitioner.js'
import { parse } from '../../filter/parser.js'
import { evaluate } from '../../filter/evaluator.js'
import { getActiveModel } from '../../models/modelCatalog.js'

export function createHistoryRuntime(ctx){
  const { store, activeParts, historyView, scrollController, boundaryMgr, lifecycle, pendingMessageMeta } = ctx
  const historyPaneEl = document.getElementById('historyPane')
  const commandErrEl = document.getElementById('commandError')

  // Internal state moved from main.js
  let lastContextStats = null
  let lastContextIncludedIds = new Set()
  let lastPredictedCount = 0
  let lastTrimmedCount = 0
  let lastViewportH = window.innerHeight

  // Public setters used by send/debug pipeline
  function setSendDebug(predictedMessageCount, trimmedCount){
    if(typeof predictedMessageCount === 'number') lastPredictedCount = predictedMessageCount
    if(typeof trimmedCount === 'number') lastTrimmedCount = trimmedCount
  }
  function setContextStats(stats, includedIds){
    lastContextStats = stats
    if(includedIds) lastContextIncludedIds = includedIds
  }

  // Layout sizing (moved from main.js)
  function layoutHistoryPane(){
    const topBar = document.getElementById('topBar')
    const inputBar = document.getElementById('inputBar')
    const histPane = document.getElementById('historyPane')
    if(!topBar || !inputBar || !histPane) return
    const topH = topBar.getBoundingClientRect().height
    const botH = inputBar.getBoundingClientRect().height
    histPane.style.top = topH + 'px'
    histPane.style.bottom = botH + 'px'
  }

  window.addEventListener('resize', layoutHistoryPane)
  window.addEventListener('resize', ()=>{
    const h = window.innerHeight
    if(!h || !lastViewportH){ lastViewportH = h; return }
    const delta = Math.abs(h - lastViewportH) / lastViewportH
    if(delta >= 0.10){
      lastViewportH = h
      invalidatePartitionCacheOnResize()
      renderCurrentView({ preserveActive:true })
    }
  })

  function applySpacingStyles(settings){
    if(!settings) return
    const { partPadding=4, gapOuterPx=6, gapMetaPx=6, gapIntraPx=6, gapBetweenPx=10, fadeInMs=120, fadeOutMs=120, fadeTransitionMs=120 } = settings
    const baseFadeMs = Math.max(fadeInMs||0, fadeOutMs||0, fadeTransitionMs||0)
    let styleEl = document.getElementById('runtimeSpacing')
    if(!styleEl){ styleEl = document.createElement('style'); styleEl.id='runtimeSpacing'; document.head.appendChild(styleEl) }
    styleEl.textContent = `#historyPane{padding-top:${gapOuterPx}px; padding-bottom:${gapOuterPx}px;}
    .history{gap:0;}
    .gap{width:100%; flex:none;}
    .gap-between{height:${gapBetweenPx}px;}
    .gap-meta{height:${gapMetaPx}px;}
    .gap-intra{height:${gapIntraPx}px;}
    .part{margin:0;box-shadow:none;background:transparent;opacity:1;transition:opacity ${baseFadeMs}ms linear;}
    .part.user .part-inner, .part.assistant .part-inner{padding:${partPadding}px;}
    .part.meta .part-inner{padding:0 ${partPadding}px; display:flex; flex-direction:row; align-items:center; gap:12px; min-height:1.6em; width:100%; box-sizing:border-box;}
    .part.meta .badge.model{color:#aaa;}
    .part.meta{white-space:nowrap;}
    .part.meta .meta-left{display:flex; gap:10px; align-items:center; white-space:nowrap;}
    .part.meta .meta-right{display:flex; gap:10px; align-items:center; margin-left:auto; white-space:nowrap;}
    .part.meta .badge{white-space:nowrap;}
    .part.user .part-inner{background:#0d2233; border-radius:3px; position:relative;}
    .part.assistant .part-inner{background:transparent;}
    .part.meta .part-inner{background:transparent; position:relative;}
    .part.assistant .part-inner, .part.meta .part-inner{position:relative;}
    .part.active .part-inner::after{content:''; position:absolute; top:1px; left:1px; right:1px; bottom:1px; border:1px solid var(--focus-ring); border-radius:3px; pointer-events:none;}
    .part.active.assistant .part-inner{background:rgba(40,80,120,0.10);} 
    .part.active{box-shadow:none; background:transparent;}`
  }

  function renderHistory(pairs){
    pairs = [...pairs].sort((a,b)=> a.createdAt - b.createdAt)
    const settings = getSettings()
    const cpt = settings.charsPerToken || 3.5
    const activeModel = pendingMessageMeta.model || getActiveModel() || 'gpt'
    boundaryMgr.applySettings({ userRequestAllowance: settings.userRequestAllowance||0, charsPerToken: cpt })
    boundaryMgr.setModel(activeModel)
    boundaryMgr.updateVisiblePairs(pairs)
    const boundary = boundaryMgr.getBoundary()
    lastContextStats = boundary.stats
    lastContextIncludedIds = new Set(boundary.included.map(p=>p.id))
    lastPredictedCount = boundary.included.length
    const parts = buildParts(pairs)
    activeParts.setParts(parts)
    historyView.render(parts)
    applyOutOfContextStyling()
    updateMessageCount(boundary.included.length, pairs.length)
    requestAnimationFrame(()=>{ scrollController.remeasure(); applyActivePart() })
    lifecycle.updateNewReplyBadgeVisibility()
  }

  function renderCurrentView(opts={}){
    const { preserveActive=false } = opts
    const prevActiveId = preserveActive && activeParts.active() ? activeParts.active().id : null
    let all = store.getAllPairs().slice().sort((a,b)=> a.createdAt - b.createdAt)
    const fq = lifecycle.getFilterQuery ? lifecycle.getFilterQuery() : ''
    if(fq){
      try {
        const ast = parse(fq)
        all = evaluate(ast, all)
        if(commandErrEl) commandErrEl.textContent=''
      } catch(ex){
        if(commandErrEl) commandErrEl.textContent = ex.message || 'filter error'
        return
      }
    }
    renderHistory(all)
    if(prevActiveId){
      activeParts.setActiveById(prevActiveId)
      if(!activeParts.active()){ activeParts.last() }
      applyActivePart()
    }
  }

  function applyActivePart(){
    document.querySelectorAll('.part.active').forEach(el=>el.classList.remove('active'))
    const act = activeParts.active(); if(!act) return
    const el = document.querySelector(`[data-part-id="${act.id}"]`)
    if(el){
      el.classList.add('active')
      scrollController.apply(activeParts.activeIndex, true)
      updateFadeVisibility()
    }
  }

  function updateFadeVisibility(){
    const settings = getSettings()
    const G = settings.gapOuterPx || 0
    const fadeMode = settings.fadeMode || 'binary'
    const hiddenOp = typeof settings.fadeHiddenOpacity === 'number' ? settings.fadeHiddenOpacity : 0
    const fadeInMs = settings.fadeInMs != null ? settings.fadeInMs : (settings.fadeTransitionMs || 120)
    const fadeOutMs = settings.fadeOutMs != null ? settings.fadeOutMs : (settings.fadeTransitionMs || 120)
    const pane = historyPaneEl
    if(!pane) return
    const S = pane.scrollTop
    const H = pane.clientHeight
    const fadeZone = G
    const parts = pane.querySelectorAll('#history > .part')
    parts.forEach(p=>{
      const top = p.offsetTop
      const h = p.offsetHeight
      const bottom = top + h
      const isActive = p.classList.contains('active')
      const relTop = top - S
      const relBottom = bottom - S
      let op = 1
      if(fadeMode === 'gradient'){
        let topFade = 1
        if(relTop < fadeZone){ topFade = Math.max(0, relTop / fadeZone) }
        let bottomFade = 1
        const distFromBottom = H - relBottom
        if(distFromBottom < fadeZone){ bottomFade = Math.max(0, distFromBottom / fadeZone) }
        op = Math.min(topFade, bottomFade)
        if(op < 0) op = 0
        if(op > 1) op = 1
      } else {
        const topIntrudes = relTop < fadeZone
        const bottomIntrudes = (H - relBottom) < fadeZone
        if(topIntrudes || bottomIntrudes) op = hiddenOp
      }
      if(isActive) op = 1
      const prev = p.__lastOpacity != null ? p.__lastOpacity : parseFloat(p.style.opacity||'1')
      if(prev !== op){
        const dirIn = op > prev
        const dur = dirIn ? fadeInMs : fadeOutMs
        if(p.__lastFadeDur !== dur){
          p.style.transitionDuration = dur + 'ms'
          p.__lastFadeDur = dur
        }
        p.style.opacity = String(op)
        p.__lastOpacity = op
      }
      p.style.pointerEvents = op === 0 ? 'none' : ''
    })
  }

  historyPaneEl.addEventListener('scroll', ()=> updateFadeVisibility())

  function renderStatus(){ const modeEl = document.getElementById('modeIndicator'); if(modeEl) modeEl.textContent = `[${window.__modeManager.mode.toUpperCase()}]` }

  function updateMessageCount(included, visible){
    const el = document.getElementById('messageCount')
    if(!el) return
    let newestHidden = false
    try {
      const allPairs = [...ctx.store.getAllPairs()].sort((a,b)=> a.createdAt - b.createdAt)
      const newest = allPairs[allPairs.length-1]
      if(newest){
        const visiblePairIds = new Set(activeParts.parts.map(p=> p.pairId))
        if(!visiblePairIds.has(newest.id)) newestHidden = true
      }
    } catch{}
    const prefix = newestHidden ? '(-) ' : ''
    let body
    if(lastTrimmedCount>0 && lastPredictedCount===included){
      const sent = included - lastTrimmedCount
      body = `[${sent}-${lastTrimmedCount}]/${visible}`
    } else {
      body = `${included}/${visible}`
    }
    el.textContent = prefix + body
    if(lastContextStats){
      el.title = (newestHidden? 'Latest message hidden by filter. ' : '') + `Predicted included / Visible. Predicted tokens: ${lastContextStats.totalIncludedTokens}. URA model active. Trimmed last send: ${lastTrimmedCount}`
    } else {
      el.title = (newestHidden? 'Latest message hidden by filter. ' : '') + 'Predicted Included / Visible'
    }
  }

  function applyOutOfContextStyling(){
    const partEls = document.querySelectorAll('#history .part')
    partEls.forEach(el=>{
      const partId = el.getAttribute('data-part-id')
      if(!partId) return
      const partObj = activeParts.parts.find(p=> p.id === partId)
      if(!partObj) return
      const included = lastContextIncludedIds.has(partObj.pairId)
      el.classList.toggle('ooc', !included)
      if(el.classList.contains('meta')){
        const off = el.querySelector('.badge.offctx')
        if(off){
          if(!included){
            off.textContent = 'off'
            off.setAttribute('data-offctx','1')
          } else {
            off.textContent = ''
            off.setAttribute('data-offctx','0')
          }
        }
      }
    })
  }

  function jumpToBoundary(){
    if(!lastContextIncludedIds || lastContextIncludedIds.size === 0) return
    const idx = activeParts.parts.findIndex(pt=> lastContextIncludedIds.has(pt.pairId))
    if(idx >= 0){ activeParts.activeIndex = idx; applyActivePart() }
  }

  // Settings subscription already exists in main; we keep subscription there to avoid duplication.

  return {
    layoutHistoryPane,
    applySpacingStyles,
    renderHistory,
    renderCurrentView,
    applyActivePart,
    updateFadeVisibility,
    updateMessageCount,
    applyOutOfContextStyling,
    jumpToBoundary,
    renderStatus,
    // debug/update hooks
    setSendDebug,
    setContextStats,
    // getters used by request debug until overlay extracted
    getContextStats: ()=> lastContextStats,
    getPredictedCount: ()=> lastPredictedCount,
    getTrimmedCount: ()=> lastTrimmedCount,
    getIncludedIds: ()=> new Set(lastContextIncludedIds)
  }
}
