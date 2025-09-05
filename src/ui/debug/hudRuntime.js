// hudRuntime.js (Step 5)
// Extracted HUD monitoring logic from main.js. No behavior changes intended.

import { getSettings } from '../../settings/index.js'

export function createHudRuntime({ store, activeParts, scrollController, historyPaneEl, historyRuntime, modeManager }){
  const hudEl = document.getElementById('hud') || (()=>{ const el = document.createElement('div'); el.id='hud'; document.body.appendChild(el); return el })()
  let hudEnabled = false
  const hudState = { layout:true, visibility:true, partition:true, meta:true }

  if(!hudEl.__hudClickBound){
    hudEl.addEventListener('click', (e)=>{
      const target = e.target.closest('[data-hud-section-header]')
      if(!target) return
      const key = target.getAttribute('data-section')
      if(key && hudState.hasOwnProperty(key)){ hudState[key] = !hudState[key] }
    })
    hudEl.__hudClickBound = true
  }

  function formatTimestamp(ts){
    const d = new Date(ts)
    const yy = String(d.getFullYear()).slice(-2)
    const dd = String(d.getDate()).padStart(2,'0')
    const mm = String(d.getMonth()+1).padStart(2,'0')
    const hh = String(d.getHours()).padStart(2,'0')
    const mi = String(d.getMinutes()).padStart(2,'0')
    const ss = String(d.getSeconds()).padStart(2,'0')
    return `${yy}-${dd}-${mm} ${hh}:${mi}:${ss}`
  }

  function sectionHTML(key, title, arr){
    const open = hudState[key]
    const indicator = open ? '-' : '+'
    const header = `<div data-hud-section-header data-section="${key}" style="cursor:pointer; font-weight:bold;">[${indicator}] ${title}</div>`
    if(!open) return header
    return header + `<pre style="margin:0; white-space:pre;">${arr.join('\n')}</pre>`
  }

  function update(){
    hudEl.style.display = hudEnabled ? 'block' : 'none'
    if(!hudEnabled){ requestAnimationFrame(update); return }
    const act = activeParts.active()
    let pairInfo='(none)'
    if(act){
      const pair = store.pairs.get(act.pairId)
      if(pair){
        const topic = store.topics.get(pair.topicId)
        pairInfo = `${pair.id.slice(0,8)} t:${topic?topic.name:''}<br/>★:${pair.star} flag:${pair.colorFlag} model:${pair.model}<br/>@${formatTimestamp(pair.createdAt)}`
      }
    }
    const focusEl = document.activeElement
    const focusDesc = focusEl ? `${focusEl.tagName.toLowerCase()}${focusEl.id?('#'+focusEl.id):''}` : 'none'
    const dbg = scrollController.debugInfo && scrollController.debugInfo()
    let n=1
    const layoutParams = []
    layoutParams.push(`${n++}. Mode: ${modeManager.mode}`)
    layoutParams.push(`${n++}. Reading position mode: ${dbg?dbg.mode:'?'}`)
    const totalParts = activeParts.parts.length
    const activeIdx1 = dbg && dbg.activeIndex!=null ? (dbg.activeIndex+1) : (act? activeParts.parts.indexOf(act)+1 : 0)
    layoutParams.push(`${n++}. Active part / total parts: ${activeIdx1}/${totalParts}`)
    let start_part_k = '?'
    if(act){
      const el = document.querySelector(`[data-part-id="${act.id}"]`)
      if(el) start_part_k = el.offsetTop
    }
    const T = historyPaneEl ? historyPaneEl.scrollHeight : '?'
    layoutParams.push(`${n++}. Active part position / Total history length: ${start_part_k}/${T}`)
    if(start_part_k !== '?' && dbg){
      const S = dbg.scrollTop||0
      const vTop = (typeof start_part_k === 'number'? start_part_k : parseFloat(start_part_k)) - S
      layoutParams.push(`${n++}. Active part visual top (start_part_k - S): ${vTop}`)
    }
    const firstVisibleIndex = dbg? dbg.currentFirst : '?'
    const visibleCount = dbg? dbg.shouldVisibleCount : '?'
    layoutParams.push(`${n++}. First visible part index / total visible parts: ${firstVisibleIndex}/${visibleCount}`)
    let start_part_k2 = '?'
    if(firstVisibleIndex != null && firstVisibleIndex !== '?' && firstVisibleIndex >=0){
      const el2 = document.querySelector(`[data-part-index="${firstVisibleIndex}"]`) || historyPaneEl.querySelectorAll('[data-part-id]')[firstVisibleIndex]
      if(el2) start_part_k2 = el2.offsetTop
    }
    layoutParams.push(`${n++}. First visible position / Total history length: ${start_part_k2}/${T}`)
    const scrollVal = dbg? Math.round(dbg.scrollTop):0
    layoutParams.push(`${n++}. scrollTop: ${scrollVal}`)
    const H_total = historyPaneEl? historyPaneEl.clientHeight : '?'
    layoutParams.push(`${n++}. historyPane (H_total): ${H_total}`)
    let Gval='?'; let H_usable='?'
    if(historyPaneEl){
      const csPane = getComputedStyle(historyPaneEl)
      const padTop = parseFloat(csPane.paddingTop)||0
      const padBottom = parseFloat(csPane.paddingBottom)||0
      Gval = padTop
      H_usable = H_total != null ? (H_total - padTop - padBottom) : '?'
    }
    layoutParams.push(`${n++}. outerGap (G): ${Gval}`)
    layoutParams.push(`${n++}. Part space (H_usable): ${H_usable}`)
    if(dbg){
      layoutParams.push(`${n++}. rawAnchor (pre-clamp S): ${dbg.rawAnchor!=null?Math.round(dbg.rawAnchor):'-'}`)
      layoutParams.push(`${n++}. maxScroll (T-D): ${dbg.maxScroll!=null?dbg.maxScroll:'-'}`)
      if(dbg.gapBelow!=null) layoutParams.push(`${n++}. gapBelow (diagnostic): ${dbg.gapBelow}`)
    }
    const maskParams = []
    if(dbg){
      const partsList = historyPaneEl.querySelectorAll('#history > .part')
      let hidden=0, partialTop=0, partialBottom=0
      const S2 = historyPaneEl.scrollTop
      const H2 = historyPaneEl.clientHeight
      const G2 = parseFloat(getComputedStyle(historyPaneEl).paddingTop)||0
      partsList.forEach(p=>{
        const topRel = p.offsetTop - S2
        const bottomRel = topRel + p.offsetHeight
        const opVal = parseFloat(p.style.opacity||'1')
        if(opVal === 0) hidden++
        else {
          if(topRel < G2) partialTop++
          if((H2 - bottomRel) < G2) partialBottom++
        }
      })
      maskParams.push(`${n++}. hidden parts: ${hidden}`)
      maskParams.push(`${n++}. partialTop (within G): ${partialTop}`)
      maskParams.push(`${n++}. partialBottom (within G): ${partialBottom}`)
    }
    const partitionParams = []
    try {
      const settings = getSettings && getSettings()
      if(historyPaneEl && settings){
        const pane = historyPaneEl
        const csPane = window.getComputedStyle(pane)
        const padTop = parseFloat(csPane.paddingTop)||0
        const padBottom = parseFloat(csPane.paddingBottom)||0
        const padLeft = parseFloat(csPane.paddingLeft)||0
        const padRight = parseFloat(csPane.paddingRight)||0
        const H_total = pane.clientHeight
        const G = padTop
        const H_usable = H_total - padTop - padBottom
        const root = document.documentElement
        let lineH = parseFloat(getComputedStyle(root).lineHeight) || parseFloat(getComputedStyle(root).fontSize) || 18
        const actPartEl = document.querySelector('.part.active .part-inner')
        if(actPartEl){
          const lhCandidate = parseFloat(getComputedStyle(actPartEl).lineHeight)
          if(lhCandidate && !isNaN(lhCandidate)) lineH = lhCandidate
        }
        const pf = settings.partFraction
        const partPadding = settings.partPadding || 0
        const targetPartHeightPx = pf * H_usable
        const maxLines_target = Math.max(1, Math.floor((targetPartHeightPx - 2*partPadding)/lineH))
        const wrapWidthUsed = (pane.clientWidth - padLeft - padRight) - 2*partPadding
        const actPart = activeParts.active()
        let maxLines_used='?', logicalLines='?', physLines='?'
        let actTop='?', actHeight='?', actBottom='?'
        if(actPart){
          maxLines_used = actPart.maxLinesUsed != null ? actPart.maxLinesUsed : '?'
          logicalLines = actPart.lineCount != null ? actPart.lineCount : '?'
          const domEl = document.querySelector(`[data-part-id="${actPart.id}"] .part-inner`) || document.querySelector(`[data-part-id="${actPart.id}"]`)
          if(domEl && lineH>0){
            const h = domEl.getBoundingClientRect().height - 2*partPadding
            physLines = Math.max(1, Math.round(h / lineH))
          }
          const outerEl = document.querySelector(`[data-part-id="${actPart.id}"]`)
            if(outerEl){
              const paneRect = pane.getBoundingClientRect()
              const partRect = outerEl.getBoundingClientRect()
              actTop = Math.round(partRect.top - paneRect.top)
              actHeight = Math.round(partRect.height)
              actBottom = actTop + actHeight
            }
        }
        partitionParams.push(`${n++}. Part fraction (pf): ${pf.toFixed(2)}`)
        partitionParams.push(`${n++}. Line height (lineH): ${Math.round(lineH*10)/10}`)
        partitionParams.push(`${n++}. Inner padding (partPadding): ${partPadding}`)
        partitionParams.push(`${n++}. targetPartHeight: ${Math.round(targetPartHeightPx)}`)
        partitionParams.push(`${n++}. Actual part hight (p_k): ${actHeight}`)
        partitionParams.push(`${n++}. maxLines (formula target): ${maxLines_target}`)
        partitionParams.push(`${n++}. maxLines_used: ${maxLines_used}`)
        partitionParams.push(`${n++}. logicalLines: ${logicalLines}`)
        partitionParams.push(`${n++}. physicalLines: ${physLines}`)
        partitionParams.push(`${n++}. wrapWidthUsed: ${Math.round(wrapWidthUsed)}`)
      }
    } catch{}
    const metaParams = []
    metaParams.push(`focus: ${focusDesc}`)
    try {
      const settings = getSettings()
      const ctxStats = historyRuntime.getContextStats()
      const ura = (ctxStats && (('URA' in ctxStats)? ctxStats.URA : ctxStats.assumedUserTokens)) ?? settings.userRequestAllowance
      const cpt = settings.charsPerToken
      const nta = settings.maxTrimAttempts
      const ml = ctxStats ? ctxStats.maxContext : null
      const predictedHistoryTokens = (ctxStats ? ctxStats.totalIncludedTokens : null)
      const predictedMessages = historyRuntime.getPredictedCount()
      let predictedChars = 0
      const includedIds = historyRuntime.getIncludedIds()
      if(includedIds && includedIds.size){
        for(const p of store.getAllPairs()){
          if(includedIds.has(p.id)) predictedChars += (p.userText?p.userText.length:0) + (p.assistantText?p.assistantText.length:0)
        }
      }
      metaParams.push(`PARAMETERS: URA=${ura!=null?ura:'-'} CPT=${cpt!=null?cpt:'-'} NTA=${nta!=null?nta:'-'} ML=${ml!=null?ml:'-'}`)
      metaParams.push(`PREDICTED_HISTORY_CONTEXT: n_of_messages=${predictedMessages} n_of_characters=${predictedChars} n_of_tokens=${predictedHistoryTokens!=null?predictedHistoryTokens:'-'}`)
    } catch{}

    hudEl.innerHTML = [
      sectionHTML('layout','Layout', layoutParams),
      sectionHTML('visibility','Visibility', maskParams),
      sectionHTML('partition','Partition', partitionParams),
      sectionHTML('meta','Meta', metaParams),
      `<div class='pairInfo'>${pairInfo}</div>`
    ].join('\n')
    requestAnimationFrame(update)
  }
  requestAnimationFrame(update)

  function enable(v=true){ hudEnabled = !!v }
  function toggle(){ hudEnabled = !hudEnabled }
  return { enable, toggle, isEnabled: ()=> hudEnabled }
}
