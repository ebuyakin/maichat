// interaction.js (Step 6)
// Extracted from main.js: key handlers, command execution, command history, star/flag toggles,
// quick topic picker, menu system, pending metadata rendering, send button handling, anchor mode cycle,
// request debug toggle dispatch. ZERO behavioral changes intended.

import { parse } from '../../filter/parser.js'
import { evaluate } from '../../filter/evaluator.js'
import { getSettings, saveSettings } from '../../settings/index.js'
import { createKeyRouter } from '../keyRouter.js'
import { createTopicPicker } from '../topicPicker.js'
import { openTopicEditor } from '../topicEditor.js'
import { openSettingsOverlay } from '../settingsOverlay.js'
import { openApiKeysOverlay } from '../apiKeysOverlay.js'
import { openModelSelector } from '../modelSelector.js'
import { openModelEditor } from '../modelEditor.js'
import { openHelpOverlay } from '../helpOverlay.js'
import { getActiveModel } from '../../models/modelCatalog.js'
import { executeSend } from '../../send/pipeline.js'

export function createInteraction({
  ctx,
  dom: { commandInput, commandErrEl, inputField, sendBtn, historyPaneEl },
  historyRuntime,
  requestDebug,
  hudRuntime
}){
  const { store, activeParts, lifecycle, boundaryMgr, pendingMessageMeta } = ctx
  const modeManager = window.__modeManager // already created in main before this is called
  let currentTopicId = store.rootTopicId

  // ----- Command history -----
  let commandHistory = []
  let commandHistoryPos = -1
  try {
    const savedHist = localStorage.getItem('maichat_command_history')
    if(savedHist){ const arr = JSON.parse(savedHist); if(Array.isArray(arr)) commandHistory = arr.slice(-100) }
  } catch{}
  function pushCommandHistory(q){
    if(!q) return
    if(commandHistory[commandHistory.length-1] === q) return
    commandHistory.push(q)
    if(commandHistory.length > 100) commandHistory = commandHistory.slice(-100)
    try { localStorage.setItem('maichat_command_history', JSON.stringify(commandHistory)) } catch{}
  }
  function historyPrev(){
    if(!commandHistory.length) return
    if(commandHistoryPos === -1) commandHistoryPos = commandHistory.length
    if(commandHistoryPos > 0){ commandHistoryPos--; commandInput.value = commandHistory[commandHistoryPos] }
  }
  function historyNext(){
    if(!commandHistory.length) return
    if(commandHistoryPos === -1) return
    if(commandHistoryPos < commandHistory.length) commandHistoryPos++
    if(commandHistoryPos === commandHistory.length){ commandInput.value=''; commandHistoryPos = -1 }
    else { commandInput.value = commandHistory[commandHistoryPos] }
  }

  // State for command mode re-render logic
  let lastAppliedFilter = ''
  let commandModeEntryActivePartId = null

  // Debug toggles state
  let hudEnabled = false
  let maskDebug = true

  // Handlers
  const viewHandler = (e)=>{
    if(window.modalIsActive && window.modalIsActive()) return false
    window.__lastKey = e.key
    if(e.key === 'Enter'){ modeManager.set(modeManager.MODES?.INPUT || 'input'); return true }
    if(e.key === 'Escape'){ modeManager.set(modeManager.MODES?.COMMAND || 'command'); return true }
    if(e.key === 'j' || e.key === 'ArrowDown'){ activeParts.next(); historyRuntime.applyActivePart(); return true }
    if(e.key === 'k' || e.key === 'ArrowUp'){ activeParts.prev(); historyRuntime.applyActivePart(); return true }
    if(e.key === 'g'){ activeParts.first(); historyRuntime.applyActivePart(); return true }
    if(e.key === 'G'){ activeParts.last(); historyRuntime.applyActivePart(); return true }
    if(e.key === 'R'){ cycleAnchorMode(); return true }
    if(e.key === 'O' && e.shiftKey){ historyRuntime.jumpToBoundary(); return true }
    if(e.key === '*'){ cycleStar(); return true }
    if(e.key === 'a'){ toggleFlag(); return true }
    if(e.key === '1'){ setStarRating(1); return true }
    if(e.key === '2'){ setStarRating(2); return true }
    if(e.key === '3'){ setStarRating(3); return true }
    if(e.key === ' '){ setStarRating(0); return true }
  }

  const commandHandler = (e)=>{
    if(window.modalIsActive && window.modalIsActive()) return false
    if(e.ctrlKey && (e.key === 'p' || e.key === 'P')){ historyPrev(); return true }
    if(e.ctrlKey && (e.key === 'n' || e.key === 'N')){ historyNext(); return true }
    if(e.key === 'Enter'){
      const q = commandInput.value.trim()
      if(q === ':hud' || q === ':hud on'){ hudEnabled = true; hudRuntime.enable(true); commandInput.value=''; commandErrEl.textContent=''; return true }
      if(q === ':hud off'){ hudEnabled = false; hudRuntime.enable(false); commandInput.value=''; commandErrEl.textContent=''; return true }
      if(q === ':maskdebug' || q === ':maskdebug on'){ maskDebug = true; commandInput.value=''; commandErrEl.textContent=''; historyRuntime.applySpacingStyles(getSettings()); historyRuntime.updateFadeVisibility(); return true }
      if(q === ':maskdebug off'){ maskDebug = false; commandInput.value=''; commandErrEl.textContent=''; historyRuntime.applySpacingStyles(getSettings()); historyRuntime.updateFadeVisibility(); return true }
      if(q === ':anim off' || q === ':noanim' || q === ':noanim on'){ ctx.scrollController.setAnimationEnabled(false); commandInput.value=''; commandErrEl.textContent=''; return true }
      if(q === ':anim on' || q === ':noanim off'){ ctx.scrollController.setAnimationEnabled(true); commandInput.value=''; commandErrEl.textContent=''; return true }
      if(q === ':scrolllog on'){ window.__scrollLog = true; commandInput.value=''; commandErrEl.textContent=''; return true }
      if(q === ':scrolllog off'){ window.__scrollLog = false; commandInput.value=''; commandErrEl.textContent=''; return true }
      historyRuntime.updateFadeVisibility()
      const prevFilter = lastAppliedFilter
      const prevActiveId = commandModeEntryActivePartId || (activeParts.active() && activeParts.active().id)
      lifecycle.setFilterQuery(q)
      if(!q){
        if(prevFilter === ''){
          if(prevFilter === '' && prevActiveId){
            if(lastAppliedFilter === '' && lastAppliedFilter === q){
              commandErrEl.textContent=''
              modeManager.set(modeManager.MODES?.VIEW || 'view')
              activeParts.setActiveById(prevActiveId); historyRuntime.applyActivePart()
              return true
            }
          }
        }
        commandErrEl.textContent=''
        historyRuntime.renderCurrentView()
        activeParts.last(); historyRuntime.applyActivePart()
        lastAppliedFilter = ''
        pushCommandHistory(q)
        commandHistoryPos = -1
        modeManager.set(modeManager.MODES?.VIEW || 'view')
        return true
      }
      try {
        const ast = parse(q)
        const basePairs = store.getAllPairs().slice().sort((a,b)=> a.createdAt - b.createdAt)
        const res = evaluate(ast, basePairs)
        const changed = q !== prevFilter
        lifecycle.setFilterQuery(q)
        historyRuntime.renderHistory(res)
        commandErrEl.textContent=''
        modeManager.set(modeManager.MODES?.VIEW || 'view')
        if(!changed && prevActiveId){
          activeParts.setActiveById(prevActiveId); historyRuntime.applyActivePart()
        }
        if(changed){ lastAppliedFilter = q; pushCommandHistory(q); commandHistoryPos = -1 }
      } catch(ex){ commandErrEl.textContent = ex.message }
      return true
    }
    if(e.key === 'Escape'){
      if(commandInput.value){ commandInput.value=''; lifecycle.setFilterQuery(''); lastAppliedFilter=''; historyRuntime.renderCurrentView(); activeParts.last(); historyRuntime.applyActivePart(); commandErrEl.textContent='' }
      return true
    }
  }

  const inputHandler = (e)=>{
    if(window.modalIsActive && window.modalIsActive()) return false
    if(e.key === 'Enter'){
      const text = inputField.value.trim()
      if(text){
        if(lifecycle.isPending()) return true
        const editingId = window.__editingPairId
        const topicId = pendingMessageMeta.topicId || currentTopicId
        const model = pendingMessageMeta.model || 'gpt'
        const settings = getSettings()
        boundaryMgr.updateVisiblePairs(store.getAllPairs().sort((a,b)=>a.createdAt-b.createdAt))
        boundaryMgr.setModel(pendingMessageMeta.model || getActiveModel())
        boundaryMgr.applySettings(getSettings())
        const preBoundary = boundaryMgr.getBoundary()
        const beforeIncludedIds = new Set(preBoundary.included.map(p=>p.id))
        lifecycle.beginSend()
        let id
        if(editingId){
          store.updatePair(editingId, { userText: text, assistantText: '', lifecycleState:'sending', model, topicId })
          id = editingId
          window.__editingPairId = null
        } else {
          id = store.addMessagePair({ topicId, model, userText: text, assistantText: '' })
        }
        ;(async()=>{
          try {
            const currentPairs = activeParts.parts.map(pt=> store.pairs.get(pt.pairId)).filter(Boolean)
            const chrono = [...new Set(currentPairs)].sort((a,b)=> a.createdAt - b.createdAt)
            boundaryMgr.updateVisiblePairs(chrono)
            boundaryMgr.setModel(model)
            boundaryMgr.applySettings(getSettings())
            const boundarySnapshot = boundaryMgr.getBoundary()
            const { content } = await executeSend({ store, model, userText: text, signal: undefined, visiblePairs: chrono, boundarySnapshot, onDebugPayload: (payload)=>{ historyRuntime.setSendDebug(payload.predictedMessageCount, payload.trimmedCount); requestDebug.setPayload(payload); historyRuntime.updateMessageCount(historyRuntime.getPredictedCount(), chrono.length) } })
            store.updatePair(id, { assistantText: content, lifecycleState:'complete', errorMessage:undefined })
            lifecycle.completeSend(); updateSendDisabled()
            historyRuntime.renderCurrentView({ preserveActive:true })
            lifecycle.handleNewAssistantReply(id)
          } catch(ex){
            let errMsg = (ex && ex.message) ? ex.message : 'error'
            store.updatePair(id, { assistantText: '', lifecycleState:'error', errorMessage: errMsg })
            lifecycle.completeSend(); updateSendDisabled()
            historyRuntime.renderCurrentView({ preserveActive:true })
          } finally {
            if(getSettings().showTrimNotice){
              boundaryMgr.updateVisiblePairs(store.getAllPairs().sort((a,b)=>a.createdAt-b.createdAt))
              boundaryMgr.setModel(pendingMessageMeta.model || getActiveModel())
              boundaryMgr.applySettings(getSettings())
              const postBoundary = boundaryMgr.getBoundary()
              const afterIncludedIds = new Set(postBoundary.included.map(p=>p.id))
              let trimmed=0
              beforeIncludedIds.forEach(pid=>{ if(!afterIncludedIds.has(pid)) trimmed++ })
              if(trimmed>0){ console.log(`[context] large prompt trimmed ${trimmed} older pair(s)`) }
            }
          }
        })()
        inputField.value=''
        historyRuntime.renderCurrentView({ preserveActive:true })
        activeParts.last(); historyRuntime.applyActivePart()
        updateSendDisabled()
      }
      return true
    }
    if(e.key === 'Escape'){ modeManager.set(modeManager.MODES?.VIEW || 'view'); return true }
  }

  function cycleStar(){
    const act = activeParts.active(); if(!act) return
    const pair = store.pairs.get(act.pairId); if(!pair) return
    store.updatePair(pair.id, { star: (pair.star+1)%4 })
    historyRuntime.renderCurrentView({ preserveActive:true })
  }
  function setStarRating(star){
    const act = activeParts.active(); if(!act) return
    const pair = store.pairs.get(act.pairId); if(!pair) return
    if(pair.star === star) return
    store.updatePair(pair.id, { star })
    historyRuntime.renderCurrentView({ preserveActive:true })
  }
  function toggleFlag(){
    const act = activeParts.active(); if(!act) return
    const pair = store.pairs.get(act.pairId); if(!pair) return
    const next = pair.colorFlag === 'b' ? 'g' : 'b'
    store.updatePair(pair.id, { colorFlag: next })
    historyRuntime.renderCurrentView({ preserveActive:true })
  }

  function openQuickTopicPicker({ prevMode }){
    const openMode = prevMode || modeManager.mode
    createTopicPicker({
      store,
      modeManager,
      onSelect: (topicId)=>{
        if(openMode === (modeManager.MODES?.INPUT || 'input')){
          pendingMessageMeta.topicId = topicId
          renderPendingMeta()
          try { localStorage.setItem('maichat_pending_topic', pendingMessageMeta.topicId) } catch{}
        } else if(openMode === (modeManager.MODES?.VIEW || 'view')){
          const act = activeParts.active(); if(act){
            const pair = store.pairs.get(act.pairId); if(pair){ store.updatePair(pair.id, { topicId }); historyRuntime.renderCurrentView({ preserveActive:true }); activeParts.setActiveById(act.id); historyRuntime.applyActivePart() }
          }
        }
        if(prevMode) modeManager.set(prevMode)
      },
      onCancel: ()=>{ if(prevMode) modeManager.set(prevMode) }
    })
  }

  // Menu system
  const menuBtn = () => document.getElementById('appMenuBtn')
  const menuEl = () => document.getElementById('appMenu')
  let menuTrap = null
  let menuKeyHandlerBound = false
  function toggleMenu(force){
    const btn = menuBtn(); const m = menuEl(); if(!btn || !m) return
    let show = force
    if(show == null) show = m.hasAttribute('hidden')
    if(show){
      m.removeAttribute('hidden')
      btn.setAttribute('aria-expanded','true')
      document.body.setAttribute('data-menu-open','1')
      m.querySelectorAll('li.active').forEach(li=> li.classList.remove('active'))
      const first = m.querySelector('li'); if(first) first.classList.add('active')
      menuTrap = window.createFocusTrap && window.createFocusTrap(m, ()=> first)
      if(!menuKeyHandlerBound){ window.addEventListener('keydown', menuGlobalKeyHandler, true); menuKeyHandlerBound = true }
    } else {
      m.setAttribute('hidden','')
      document.body.removeAttribute('data-menu-open')
      btn.setAttribute('aria-expanded','false')
      if(menuTrap){ menuTrap.release(); menuTrap = null }
    }
  }
  function menuGlobalKeyHandler(e){
    const m = menuEl(); if(!m || m.hasAttribute('hidden')) return
    const navKeys = ['j','k','ArrowDown','ArrowUp','Enter','Escape']
    if(navKeys.includes(e.key)){
      e.preventDefault(); e.stopImmediatePropagation()
      const items = Array.from(m.querySelectorAll('li'))
      let idx = items.findIndex(li=> li.classList.contains('active'))
      if(idx < 0 && items.length){ idx = 0; items[0].classList.add('active') }
      if(e.key === 'Escape'){ toggleMenu(false); return }
      if(e.key === 'j' || e.key === 'ArrowDown'){
        if(items.length){ idx = (idx+1+items.length)%items.length; items.forEach(li=>li.classList.remove('active')); items[idx].classList.add('active') }
        return
      }
      if(e.key === 'k' || e.key === 'ArrowUp'){
        if(items.length){ idx = (idx-1+items.length)%items.length; items.forEach(li=>li.classList.remove('active')); items[idx].classList.add('active') }
        return
      }
      if(e.key === 'Enter'){
        const act = items[idx] || items[0]
        if(act) activateMenuItem(act)
        return
      }
    }
  }
  function closeMenu(){ toggleMenu(false) }
  function activateMenuItem(li){ if(!li) return; const act = li.getAttribute('data-action'); closeMenu(); runMenuAction(act) }
  function runMenuAction(action){
    if(action === 'topic-editor'){ const prevMode = modeManager.mode; openTopicEditor({ store, onClose:()=>{ modeManager.set(prevMode) } }) }
    else if(action === 'settings'){ const prevMode = modeManager.mode; openSettingsOverlay({ onClose:()=>{ modeManager.set(prevMode) } }) }
    else if(action === 'api-keys'){ const prevMode = modeManager.mode; openApiKeysOverlay({ modeManager, onClose:()=>{ modeManager.set(prevMode) } }) }
    else if(action === 'help'){ openHelpOverlay({ modeManager, onClose:()=>{} }) }
  }
  document.addEventListener('click', e=>{
    const btn = menuBtn(); const m = menuEl(); if(!btn || !m) return
    if(e.target === btn){ e.stopPropagation(); toggleMenu(); return }
    if(m.contains(e.target)){
      const li = e.target.closest('li[data-action]'); if(li){ activateMenuItem(li) }
      return
    }
    if(!btn.contains(e.target)) closeMenu()
  })

  function renderPendingMeta(){
    const pm = document.getElementById('pendingModel')
    const pt = document.getElementById('pendingTopic')
    if(pm){
      pm.textContent = pendingMessageMeta.model || getActiveModel() || 'gpt-4o'
      if(!pm.textContent) pm.textContent = 'gpt-4o'
      pm.title = `Model: ${pendingMessageMeta.model || getActiveModel() || 'gpt-4o'} (Ctrl+M select (Input mode) · Ctrl+Shift+M manage (any mode))`
    }
    if(pt){
      const topic = store.topics.get(pendingMessageMeta.topicId || currentTopicId)
      if(topic){
        const path = formatTopicPath(topic.id)
        pt.textContent = middleTruncate(path, 90)
        pt.title = `Topic: ${path} (Ctrl+T pick, Ctrl+E edit)`
      } else {
        const rootTopic = store.topics.get(store.rootTopicId)
        if(rootTopic){
          const path = formatTopicPath(rootTopic.id)
          pt.textContent = middleTruncate(path, 90)
          pt.title = `Topic: ${path} (Ctrl+T pick, Ctrl+E edit)`
        } else {
          pt.textContent = 'Select Topic'
          pt.title = 'No topic found (Ctrl+T)'
        }
      }
    }
  }
  function formatTopicPath(id){
    const parts = store.getTopicPath(id)
    if(parts[0] === 'Root') parts.shift()
    return parts.join(' > ')
  }
  function middleTruncate(str, max){
    if(str.length <= max) return str
    const keep = max - 3
    const head = Math.ceil(keep/2)
    const tail = Math.floor(keep/2)
    return str.slice(0, head) + '…' + str.slice(str.length - tail)
  }

  function updateSendDisabled(){
    if(!sendBtn) return
    const empty = inputField.value.trim().length === 0
    const zeroIncluded = (historyRuntime.getContextStats() && historyRuntime.getContextStats().includedCount === 0)
    sendBtn.disabled = empty || lifecycle.isPending() || zeroIncluded
    if(lifecycle.isPending()){
      if(!sendBtn.__animTimer){
        sendBtn.innerHTML = '<span class="lbl">AI is thinking</span><span class="dots"><span>.</span><span>.</span><span>.</span></span>'
        sendBtn.__animPhase = 0
        const applyPhase = ()=>{
          const dotsWrap = sendBtn.querySelector('.dots')
          if(!dotsWrap) return
            const spans = dotsWrap.querySelectorAll('span')
            spans.forEach((sp,i)=>{ sp.style.opacity = (i < sendBtn.__animPhase) ? '1' : '0' })
        }
        applyPhase()
        sendBtn.__animTimer = setInterval(()=>{
          if(!lifecycle.isPending()) return
          sendBtn.__animPhase = (sendBtn.__animPhase + 1) % 4
          applyPhase()
        }, 500)
      }
      sendBtn.classList.add('pending')
    } else {
      if(sendBtn.__animTimer){ clearInterval(sendBtn.__animTimer); sendBtn.__animTimer=null }
      sendBtn.textContent = 'Send'
      sendBtn.classList.remove('pending')
      if(zeroIncluded){ sendBtn.title = 'Cannot send: no pairs included in context (token budget exhausted)'; }
      else { sendBtn.title = 'Send' }
    }
  }

  function cycleAnchorMode(){
    const settings = getSettings()
    const order = ['bottom','center','top']
    const idx = order.indexOf(settings.anchorMode || 'bottom')
    const next = order[(idx+1)%order.length]
    saveSettings({ anchorMode: next })
    historyRuntime.applyActivePart()
    console.log('Anchor mode ->', next)
  }

  // Mode change side-effects
  modeManager.onChange((m)=>{
    historyRuntime.renderStatus()
    if(m === modeManager.MODES?.VIEW || m === 'view'){ commandInput.blur(); inputField.blur() }
    else if(m === modeManager.MODES?.INPUT || m === 'input'){ inputField.focus() }
    else if(m === modeManager.MODES?.COMMAND || m === 'command'){
      commandModeEntryActivePartId = activeParts.active() ? activeParts.active().id : null
      commandInput.focus()
    }
  })

  // Key router
  const keyRouter = createKeyRouter({ modeManager, handlers:{ view:viewHandler, command:commandHandler, input:inputHandler } })
  keyRouter.attach()

  // Click activation on parts
  document.addEventListener('click', e=>{
    const el = e.target.closest('.part'); if(!el) return
    activeParts.setActiveById(el.getAttribute('data-part-id'))
    historyRuntime.applyActivePart()
  })

  // Ctrl-based command shortcuts
  window.addEventListener('keydown', e=>{
    if(!e.ctrlKey) return
    const k = e.key.toLowerCase()
    if(window.modalIsActive && window.modalIsActive()) return
    if(k==='i'){ e.preventDefault(); modeManager.set(modeManager.MODES?.INPUT || 'input') }
    else if(k==='d'){ e.preventDefault(); modeManager.set(modeManager.MODES?.COMMAND || 'command') }
    else if(k==='v'){ e.preventDefault(); modeManager.set(modeManager.MODES?.VIEW || 'view') }
    else if(k==='t'){ if(!document.getElementById('appLoading')){ e.preventDefault(); const prevMode = modeManager.mode; openQuickTopicPicker({ prevMode }) } }
    else if(k==='e'){ if(!document.getElementById('appLoading')){ e.preventDefault(); const prevMode = modeManager.mode; openTopicEditor({ store, onClose:()=>{ modeManager.set(prevMode) } }) } }
    else if(k==='m'){
      if(e.shiftKey){
        e.preventDefault();
        const prevMode = modeManager.mode
        openModelEditor({ onClose: ()=>{ pendingMessageMeta.model = getActiveModel(); renderPendingMeta(); historyRuntime.renderCurrentView({ preserveActive:true }); modeManager.set(prevMode) } })
      } else {
        if(modeManager.mode !== (modeManager.MODES?.INPUT || 'input')) return
        e.preventDefault();
        const prevMode = modeManager.mode
        openModelSelector({ onClose: ()=>{ pendingMessageMeta.model = getActiveModel(); renderPendingMeta(); historyRuntime.renderCurrentView({ preserveActive:true }); modeManager.set(prevMode) } })
      }
    }
    else if(k==='k'){
      e.preventDefault();
      const prevMode = modeManager.mode
      openApiKeysOverlay({ modeManager, onClose: ()=>{ modeManager.set(prevMode) } })
    }
    else if(k===','){ e.preventDefault(); const prevMode = modeManager.mode; openSettingsOverlay({ onClose:()=>{ modeManager.set(prevMode) } }) }
    else if(e.key === '.' || e.code === 'Period'){ e.preventDefault(); toggleMenu(); }
    else if(e.shiftKey && k==='r'){ e.preventDefault(); requestDebug.toggle(); }
    if(e.shiftKey && k==='s'){ e.preventDefault(); window.seedTestMessages && window.seedTestMessages() }
  })

  window.addEventListener('keydown', e=>{ if(e.key==='F1'){ e.preventDefault(); openHelpOverlay({ modeManager, onClose:()=>{} }) } })

  if(sendBtn){
    sendBtn.addEventListener('click', ()=>{
      if(modeManager.mode !== (modeManager.MODES?.INPUT || 'input')) modeManager.set(modeManager.MODES?.INPUT || 'input')
      const text = inputField.value.trim(); if(!text) return
      if(lifecycle.isPending()) return
      lifecycle.beginSend()
      const topicId = pendingMessageMeta.topicId || currentTopicId
      const model = pendingMessageMeta.model || 'gpt'
      const editingId = window.__editingPairId
      let id
      if(editingId){
        store.updatePair(editingId, { userText: text, assistantText:'', lifecycleState:'sending', model, topicId })
        id = editingId
        window.__editingPairId = null
      } else {
        id = store.addMessagePair({ topicId, model, userText: text, assistantText: '' })
      }
      try { localStorage.setItem('maichat_pending_topic', topicId) } catch{}
      ;(async()=>{
        try {
          const currentPairs = activeParts.parts.map(pt=> store.pairs.get(pt.pairId)).filter(Boolean)
          const chrono = [...new Set(currentPairs)].sort((a,b)=> a.createdAt - b.createdAt)
          const { content } = await executeSend({ store, model, userText: text, signal: undefined, visiblePairs: chrono, onDebugPayload: (payload)=>{ requestDebug.setPayload(payload) } })
          store.updatePair(id, { assistantText: content, lifecycleState:'complete', errorMessage:undefined })
          lifecycle.completeSend(); updateSendDisabled()
          historyRuntime.renderCurrentView({ preserveActive:true })
          lifecycle.handleNewAssistantReply(id)
        } catch(ex){
          let errMsg = (ex && ex.message) ? ex.message : 'error'
          if(errMsg === 'missing_api_key') errMsg = 'API key missing (Ctrl+.) -> API Keys'
          store.updatePair(id, { assistantText: '', lifecycleState:'error', errorMessage: errMsg })
          lifecycle.completeSend(); updateSendDisabled()
          historyRuntime.renderCurrentView({ preserveActive:true })
        } finally { updateSendDisabled() }
      })()
      inputField.value=''; historyRuntime.renderCurrentView({ preserveActive:true }); activeParts.last(); historyRuntime.applyActivePart(); updateSendDisabled()
    })
    inputField.addEventListener('input', updateSendDisabled)
  }

  // Public API
  return {
    keyRouter,
    updateSendDisabled,
    renderPendingMeta,
    cycleAnchorMode,
    openQuickTopicPicker
  }
}
