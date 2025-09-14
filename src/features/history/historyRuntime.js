// historyRuntime moved from ui/history/historyRuntime.js
import { buildParts } from './parts.js'
import { getSettings } from '../../core/settings/index.js'
import { invalidatePartitionCacheOnResize } from './partitioner.js'
import { parse } from '../command/parser.js'
import { evaluate } from '../command/evaluator.js'
import { getActiveModel } from '../../core/models/modelCatalog.js'
import { applySpacingStyles as applySpacingStylesHelper } from './spacingStyles.js'
import { applyFadeVisibility } from './fadeVisibility.js'
export function createHistoryRuntime(ctx){
  const { store, activeParts, historyView, scrollController, boundaryMgr, lifecycle, pendingMessageMeta } = ctx
  const historyPaneEl = document.getElementById('historyPane')
  const commandErrEl = document.getElementById('commandError')
  let lastContextStats = null
  let lastContextIncludedIds = new Set()
  let lastPredictedCount = 0
  let lastTrimmedCount = 0
  let lastViewportH = window.innerHeight
  function setSendDebug(predictedMessageCount, trimmedCount){
    if(typeof predictedMessageCount === 'number') lastPredictedCount = predictedMessageCount
    if(typeof trimmedCount === 'number') lastTrimmedCount = trimmedCount
  }
  function setContextStats(stats, includedIds){
    lastContextStats = stats
    if(includedIds) lastContextIncludedIds = includedIds
  }
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
    applySpacingStylesHelper(settings)
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
  // Apply initial fade state before first paint to avoid bright-then-dim flicker on re-render
  updateFadeVisibility({ initial: true })
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
      try { const ast = parse(fq); all = evaluate(ast, all); if(commandErrEl){ commandErrEl.textContent=''; commandErrEl.title=''; } }
      catch(ex){
        if(commandErrEl){
          const raw = (ex && ex.message) ? String(ex.message).trim() : 'error'
          let friendly
          if(/^Unexpected token:/i.test(raw) || /^Unexpected trailing input/i.test(raw)) friendly = 'Incorrect command'
          else friendly = `Incorrect command: ${raw}`
          commandErrEl.textContent = friendly
          commandErrEl.title = friendly
        }
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
  // Highlight only; caller triggers one-shot alignment when needed
  scrollController.setActiveIndex(activeParts.activeIndex)
      updateFadeVisibility()
    }
  }
  function updateFadeVisibility(opts={}){
    const initial = !!opts.initial
    const settings = getSettings()
    const pane = historyPaneEl
    if(!pane) return
    const parts = pane.querySelectorAll('#history > .part')
    applyFadeVisibility({ paneEl: pane, parts, settings, initial })
  }
  historyPaneEl.addEventListener('scroll', ()=> updateFadeVisibility())
  function renderStatus(){ const modeEl = document.getElementById('modeIndicator'); if(modeEl) modeEl.textContent = `[${window.__modeManager.mode.toUpperCase()}]` }
  function updateMessageCount(included, visible){
    const el = document.getElementById('messageCount')
    if(!el) return
    let newestHidden = false
    try { const allPairs = [...ctx.store.getAllPairs()].sort((a,b)=> a.createdAt - b.createdAt); const newest = allPairs[allPairs.length-1]; if(newest){ const visiblePairIds = new Set(activeParts.parts.map(p=> p.pairId)); if(!visiblePairIds.has(newest.id)) newestHidden = true } } catch{}
    const prefix = newestHidden ? '(-) ' : ''
    let body
    if(lastTrimmedCount>0 && lastPredictedCount===included){ const sent = included - lastTrimmedCount; body = `[${sent}-${lastTrimmedCount}]/${visible}` } else { body = `${included}/${visible}` }
    el.textContent = prefix + body
    if(lastContextStats){ el.title = (newestHidden? 'Latest message hidden by filter. ' : '') + `Predicted included / Visible. Predicted tokens: ${lastContextStats.totalIncludedTokens}. URA model active. Trimmed last send: ${lastTrimmedCount}` }
    else { el.title = (newestHidden? 'Latest message hidden by filter. ' : '') + 'Predicted Included / Visible' }
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
          if(!included){ off.textContent = 'off'; off.setAttribute('data-offctx','1') }
          else { off.textContent = ''; off.setAttribute('data-offctx','0') }
        }
      }
    })
  }
  function jumpToBoundary(){ if(!lastContextIncludedIds || lastContextIncludedIds.size === 0) return; const idx = activeParts.parts.findIndex(pt=> lastContextIncludedIds.has(pt.pairId)); if(idx >= 0){ activeParts.activeIndex = idx; applyActivePart() } }
  try { lifecycle.bindApplyActivePart && lifecycle.bindApplyActivePart(applyActivePart) } catch {}
  return { layoutHistoryPane, applySpacingStyles, renderHistory, renderCurrentView, applyActivePart, updateFadeVisibility, updateMessageCount, applyOutOfContextStyling, jumpToBoundary, renderStatus, setSendDebug, setContextStats, getContextStats: ()=> lastContextStats, getPredictedCount: ()=> lastPredictedCount, getTrimmedCount: ()=> lastTrimmedCount, getIncludedIds: ()=> new Set(lastContextIncludedIds) }
}
