// interaction.js moved from ui/interaction/interaction.js (Phase 6.2 Interaction)
// NOTE: Imports updated to new feature/ and core paths.
import { parse } from '../command/parser.js'
import { evaluate } from '../command/evaluator.js'
import { getSettings, saveSettings } from '../../core/settings/index.js'
import { createKeyRouter } from './keyRouter.js'
// Topics moved (Phase 6.4)
import { createTopicPicker } from '../topics/topicPicker.js'
import { openTopicEditor } from '../topics/topicEditor.js'
// Config overlays moved (Phase 6.6)
import { openSettingsOverlay } from '../config/settingsOverlay.js'
import { openApiKeysOverlay } from '../config/apiKeysOverlay.js'
import { openModelSelector } from '../config/modelSelector.js'
import { openModelEditor } from '../config/modelEditor.js'
import { openHelpOverlay } from '../config/helpOverlay.js'
import { openDailyStatsOverlay } from '../config/dailyStatsOverlay.js'
import { getActiveModel } from '../../core/models/modelCatalog.js'
// Compose pipeline not yet moved (Phase 6.5). Use current send/ path.
// Compose pipeline moved (Phase 6.5) to features/compose
import { executeSend } from '../compose/pipeline.js'

export function createInteraction({
  ctx,
  dom: { commandInput, commandErrEl, inputField, sendBtn, historyPaneEl },
  historyRuntime,
  requestDebug,
  hudRuntime
}){
  const { store, activeParts, lifecycle, boundaryMgr, pendingMessageMeta } = ctx
  const modeManager = window.__modeManager
  let currentTopicId = store.rootTopicId
  let commandHistory = []
  let commandHistoryPos = -1
  try { const saved = localStorage.getItem('maichat_command_history'); if(saved){ const arr = JSON.parse(saved); if(Array.isArray(arr)) commandHistory = arr.slice(-100) } } catch{}
  function pushCommandHistory(q){ if(!q) return; if(commandHistory[commandHistory.length-1]===q) return; commandHistory.push(q); if(commandHistory.length>100) commandHistory = commandHistory.slice(-100); try{ localStorage.setItem('maichat_command_history', JSON.stringify(commandHistory)) }catch{} }
  function historyPrev(){ if(!commandHistory.length) return; if(commandHistoryPos===-1) commandHistoryPos = commandHistory.length; if(commandHistoryPos>0){ commandHistoryPos--; commandInput.value = commandHistory[commandHistoryPos] } }
  function historyNext(){ if(!commandHistory.length) return; if(commandHistoryPos===-1) return; if(commandHistoryPos < commandHistory.length) commandHistoryPos++; if(commandHistoryPos===commandHistory.length){ commandInput.value=''; commandHistoryPos=-1 } else { commandInput.value = commandHistory[commandHistoryPos] } }
  let lastAppliedFilter = ''
  let commandModeEntryActivePartId = null
  let hudEnabled = false
  let maskDebug = true
  const viewHandler = (e)=>{
    if(window.modalIsActive && window.modalIsActive()) return false
    window.__lastKey = e.key
    if(e.key==='Enter'){ modeManager.set('input'); return true }
    if(e.key==='Escape'){ modeManager.set('command'); return true }
    if(e.key==='j' || e.key==='ArrowDown'){ activeParts.next(); historyRuntime.applyActivePart(); return true }
    if(e.key==='k' || e.key==='ArrowUp'){ activeParts.prev(); historyRuntime.applyActivePart(); return true }
    if(e.key==='g'){ activeParts.first(); historyRuntime.applyActivePart(); return true }
    if(e.key==='G'){ activeParts.last(); historyRuntime.applyActivePart(); return true }
    if(e.key==='R'){ cycleAnchorMode(); return true }
    if(e.key==='O' && e.shiftKey){ historyRuntime.jumpToBoundary(); return true }
    if(e.key==='*'){ cycleStar(); return true }
    if(e.key==='a'){ toggleFlag(); return true }
    if(e.key==='1'){ setStarRating(1); return true }
    if(e.key==='2'){ setStarRating(2); return true }
    if(e.key==='3'){ setStarRating(3); return true }
    if(e.key===' '){ setStarRating(0); return true }
    // VIEW-only fast keys for error pairs
    if(e.key==='e'){ if(handleEditIfErrorActive()) return true }
    if(e.key==='d'){ if(handleDeleteIfErrorActive()) return true }
  }
  const commandHandler = (e)=>{
    if(window.modalIsActive && window.modalIsActive()) return false
  // Emacs-like editing shortcuts in command box
  if(e.ctrlKey && (e.key==='u' || e.key==='U')){ e.preventDefault(); const el = commandInput; const end = el.selectionEnd; const start = 0; el.setRangeText('', start, end, 'end'); return true }
  if(e.ctrlKey && (e.key==='w' || e.key==='W')){ e.preventDefault(); const el = commandInput; const pos = el.selectionStart; const left = el.value.slice(0, pos); const right = el.value.slice(el.selectionEnd); const newLeft = left.replace(/\s*[^\s]+\s*$/, ''); const delStart = newLeft.length; el.value = newLeft + right; el.setSelectionRange(delStart, delStart); return true }
    if(e.ctrlKey && (e.key==='p' || e.key==='P')){ historyPrev(); return true }
    if(e.ctrlKey && (e.key==='n' || e.key==='N')){ historyNext(); return true }
    if(e.key==='Enter'){
      const q = commandInput.value.trim()
      if(q === ':hud' || q === ':hud on'){ hudEnabled=true; hudRuntime.enable(true); commandInput.value=''; commandErrEl.textContent=''; return true }
      if(q === ':hud off'){ hudEnabled=false; hudRuntime.enable(false); commandInput.value=''; commandErrEl.textContent=''; return true }
      if(q === ':maskdebug' || q === ':maskdebug on'){ maskDebug=true; commandInput.value=''; commandErrEl.textContent=''; historyRuntime.applySpacingStyles(getSettings()); historyRuntime.updateFadeVisibility(); return true }
      if(q === ':maskdebug off'){ maskDebug=false; commandInput.value=''; commandErrEl.textContent=''; historyRuntime.applySpacingStyles(getSettings()); historyRuntime.updateFadeVisibility(); return true }
      if(q === ':anim off' || q === ':noanim' || q === ':noanim on'){ ctx.scrollController.setAnimationEnabled(false); commandInput.value=''; commandErrEl.textContent=''; return true }
      if(q === ':anim on' || q === ':noanim off'){ ctx.scrollController.setAnimationEnabled(true); commandInput.value=''; commandErrEl.textContent=''; return true }
      if(q === ':scrolllog on'){ window.__scrollLog=true; commandInput.value=''; commandErrEl.textContent=''; return true }
      if(q === ':scrolllog off'){ window.__scrollLog=false; commandInput.value=''; commandErrEl.textContent=''; return true }
      historyRuntime.updateFadeVisibility()
      const prevFilter = lastAppliedFilter
      const prevActiveId = commandModeEntryActivePartId || (activeParts.active() && activeParts.active().id)
      lifecycle.setFilterQuery(q)
      if(!q){
        commandErrEl.textContent=''
        historyRuntime.renderCurrentView()
        activeParts.last(); historyRuntime.applyActivePart()
        lastAppliedFilter=''
        pushCommandHistory(q); commandHistoryPos=-1; modeManager.set('view'); return true
      }
      try {
  const ast = parse(q)
  const basePairs = store.getAllPairs().slice().sort((a,b)=> a.createdAt - b.createdAt)
  const currentBareTopicId = pendingMessageMeta.topicId || currentTopicId
  const currentBareModel = pendingMessageMeta.model || getActiveModel()
  const res = evaluate(ast, basePairs, { store, currentTopicId: currentBareTopicId, currentModel: currentBareModel })
        const changed = q !== prevFilter
        lifecycle.setFilterQuery(q)
        historyRuntime.renderHistory(res)
        commandErrEl.textContent=''
        modeManager.set('view')
        if(!changed && prevActiveId){ activeParts.setActiveById(prevActiveId); historyRuntime.applyActivePart() }
        if(changed){ lastAppliedFilter=q; pushCommandHistory(q); commandHistoryPos=-1 }
  } catch(ex){ const raw = (ex && ex.message) ? String(ex.message).trim() : 'error'; const friendly = (/^Unexpected token:/i.test(raw) || /^Unexpected trailing input/i.test(raw)) ? 'Incorrect command' : `Incorrect command: ${raw}`; commandErrEl.textContent = friendly }
      return true
    }
    if(e.key==='Escape'){
      if(commandInput.value){ commandInput.value=''; lifecycle.setFilterQuery(''); lastAppliedFilter=''; historyRuntime.renderCurrentView(); activeParts.last(); historyRuntime.applyActivePart(); commandErrEl.textContent='' }
      return true
    }
  }
  const inputHandler = (e)=>{
    if(window.modalIsActive && window.modalIsActive()) return false
  // Emacs-like editing shortcuts in input (new message) box
  if(e.ctrlKey && (e.key==='u' || e.key==='U')){ e.preventDefault(); const el = inputField; const end = el.selectionEnd; const start = 0; el.setRangeText('', start, end, 'end'); return true }
  if(e.ctrlKey && (e.key==='w' || e.key==='W')){ e.preventDefault(); const el = inputField; const pos = el.selectionStart; const left = el.value.slice(0, pos); const right = el.value.slice(el.selectionEnd); const newLeft = left.replace(/\s*[^\s]+\s*$/, ''); const delStart = newLeft.length; el.value = newLeft + right; el.setSelectionRange(delStart, delStart); return true }
    if(e.key==='Enter'){
      const text = inputField.value.trim();
      if(text){
        if(lifecycle.isPending()) return true;
        const editingId = window.__editingPairId;
        const topicId = pendingMessageMeta.topicId || currentTopicId;
        const model = pendingMessageMeta.model || 'gpt';
        boundaryMgr.updateVisiblePairs(store.getAllPairs().sort((a,b)=>a.createdAt-b.createdAt));
        boundaryMgr.setModel(pendingMessageMeta.model || getActiveModel());
        boundaryMgr.applySettings(getSettings());
        const preBoundary = boundaryMgr.getBoundary();
        const beforeIncludedIds = new Set(preBoundary.included.map(p=>p.id));
        lifecycle.beginSend();
        let id;
        if(editingId){
          // Re-ask behavior: remove old error pair and create a new pair at end with same meta
          const old = store.pairs.get(editingId);
          if(old){ store.removePair(editingId) }
          id = store.addMessagePair({ topicId, model, userText:text, assistantText:'' });
          window.__editingPairId = null;
        } else {
          id = store.addMessagePair({ topicId, model, userText:text, assistantText:'' })
        }
        ;(async()=>{
          try {
            const currentPairs = activeParts.parts.map(pt=> store.pairs.get(pt.pairId)).filter(Boolean);
            const chrono = [...new Set(currentPairs)].sort((a,b)=> a.createdAt - b.createdAt);
            boundaryMgr.updateVisiblePairs(chrono);
            boundaryMgr.setModel(model);
            boundaryMgr.applySettings(getSettings());
            const boundarySnapshot = boundaryMgr.getBoundary();
            const { content } = await executeSend({ store, model, userText:text, signal: undefined, visiblePairs: chrono, boundarySnapshot, onDebugPayload: (payload)=>{ historyRuntime.setSendDebug(payload.predictedMessageCount, payload.trimmedCount); requestDebug.setPayload(payload); historyRuntime.updateMessageCount(historyRuntime.getPredictedCount(), chrono.length) } });
            store.updatePair(id, { assistantText: content, lifecycleState:'complete', errorMessage:undefined });
            lifecycle.completeSend();
            updateSendDisabled();
            historyRuntime.renderCurrentView({ preserveActive:true });
            lifecycle.handleNewAssistantReply(id)
          } catch(ex){
            let errMsg = (ex && ex.message)? ex.message : 'error';
            store.updatePair(id, { assistantText:'', lifecycleState:'error', errorMessage: errMsg });
            lifecycle.completeSend();
            updateSendDisabled();
            historyRuntime.renderCurrentView({ preserveActive:true })
          } finally {
            if(getSettings().showTrimNotice){
              boundaryMgr.updateVisiblePairs(store.getAllPairs().sort((a,b)=>a.createdAt-b.createdAt));
              boundaryMgr.setModel(pendingMessageMeta.model || getActiveModel());
              boundaryMgr.applySettings(getSettings());
              const postBoundary = boundaryMgr.getBoundary();
              const afterIncludedIds = new Set(postBoundary.included.map(p=>p.id));
              let trimmed=0; beforeIncludedIds.forEach(pid=>{ if(!afterIncludedIds.has(pid)) trimmed++ });
              if(trimmed>0){ console.log(`[context] large prompt trimmed ${trimmed} older pair(s)`) }
            }
          }
        })();
        inputField.value='';
        historyRuntime.renderCurrentView({ preserveActive:true });
        activeParts.last(); historyRuntime.applyActivePart();
        updateSendDisabled()
      }
      return true
    }
    if(e.key==='Escape'){ modeManager.set('view'); return true }
  }
  function cycleStar(){ const act = activeParts.active(); if(!act) return; const pair = store.pairs.get(act.pairId); if(!pair) return; store.updatePair(pair.id, { star:(pair.star+1)%4 }); historyRuntime.renderCurrentView({ preserveActive:true }) }
  function setStarRating(star){ const act = activeParts.active(); if(!act) return; const pair = store.pairs.get(act.pairId); if(!pair) return; if(pair.star===star) return; store.updatePair(pair.id,{ star }); historyRuntime.renderCurrentView({ preserveActive:true }) }
  function toggleFlag(){ const act = activeParts.active(); if(!act) return; const pair = store.pairs.get(act.pairId); if(!pair) return; const next = pair.colorFlag==='b' ? 'g':'b'; store.updatePair(pair.id,{ colorFlag:next }); historyRuntime.renderCurrentView({ preserveActive:true }) }
  function openQuickTopicPicker({ prevMode }){ const openMode = prevMode || modeManager.mode; createTopicPicker({ store, modeManager, onSelect:(topicId)=>{ if(openMode==='input'){ pendingMessageMeta.topicId=topicId; renderPendingMeta(); try{ localStorage.setItem('maichat_pending_topic', pendingMessageMeta.topicId) }catch{} } else if(openMode==='view'){ const act = activeParts.active(); if(act){ const pair = store.pairs.get(act.pairId); if(pair){ store.updatePair(pair.id,{ topicId }); historyRuntime.renderCurrentView({ preserveActive:true }); activeParts.setActiveById(act.id); historyRuntime.applyActivePart() } } } if(prevMode) modeManager.set(prevMode) }, onCancel:()=>{ if(prevMode) modeManager.set(prevMode) } }) }
  const menuBtn = ()=> document.getElementById('appMenuBtn')
  const menuEl = ()=> document.getElementById('appMenu')
  let menuTrap = null
  let menuKeyHandlerBound = false
  function toggleMenu(force){ const btn = menuBtn(); const m = menuEl(); if(!btn||!m) return; let show = force; if(show==null) show = m.hasAttribute('hidden'); if(show){ m.removeAttribute('hidden'); btn.setAttribute('aria-expanded','true'); document.body.setAttribute('data-menu-open','1'); m.querySelectorAll('li.active').forEach(li=> li.classList.remove('active')); const first = m.querySelector('li'); if(first) first.classList.add('active'); menuTrap = window.createFocusTrap && window.createFocusTrap(m, ()=> first); if(!menuKeyHandlerBound){ window.addEventListener('keydown', menuGlobalKeyHandler, true); menuKeyHandlerBound=true } } else { m.setAttribute('hidden',''); document.body.removeAttribute('data-menu-open'); btn.setAttribute('aria-expanded','false'); if(menuTrap){ menuTrap.release(); menuTrap=null } } }
  function menuGlobalKeyHandler(e){ const m = menuEl(); if(!m || m.hasAttribute('hidden')) return; const nav=['j','k','ArrowDown','ArrowUp','Enter','Escape']; if(nav.includes(e.key)){ e.preventDefault(); e.stopImmediatePropagation(); const items = Array.from(m.querySelectorAll('li')); let idx = items.findIndex(li=> li.classList.contains('active')); if(idx<0 && items.length){ idx=0; items[0].classList.add('active') } if(e.key==='Escape'){ toggleMenu(false); return } if(e.key==='j' || e.key==='ArrowDown'){ if(items.length){ idx=(idx+1+items.length)%items.length; items.forEach(li=>li.classList.remove('active')); items[idx].classList.add('active') } return } if(e.key==='k' || e.key==='ArrowUp'){ if(items.length){ idx=(idx-1+items.length)%items.length; items.forEach(li=>li.classList.remove('active')); items[idx].classList.add('active') } return } if(e.key==='Enter'){ const act=items[idx]||items[0]; if(act) activateMenuItem(act); return } } }
  function closeMenu(){ toggleMenu(false) }
  function activateMenuItem(li){ if(!li) return; const act = li.getAttribute('data-action'); closeMenu(); runMenuAction(act) }
  function runMenuAction(action){
    if(action==='topic-editor'){
      const prev=modeManager.mode; openTopicEditor({ store, onClose:()=>{ modeManager.set(prev) } })
    } else if(action==='model-editor'){
      const prev=modeManager.mode; openModelEditor({ store, onClose: ()=>{ pendingMessageMeta.model = getActiveModel(); renderPendingMeta(); historyRuntime.renderCurrentView({ preserveActive:true }); modeManager.set(prev) } })
    } else if(action==='daily-stats'){
      openDailyStatsOverlay({ store, activeParts, historyRuntime, modeManager })
    } else if(action==='settings'){
      const prev=modeManager.mode; openSettingsOverlay({ onClose:()=>{ modeManager.set(prev) } })
    } else if(action==='api-keys'){
      const prev=modeManager.mode; openApiKeysOverlay({ modeManager, onClose:()=>{ modeManager.set(prev) } })
    } else if(action==='help'){
      openHelpOverlay({ modeManager, onClose:()=>{} })
    }
  }
  document.addEventListener('click', e=>{ const btn = menuBtn(); const m = menuEl(); if(!btn||!m) return; if(e.target===btn){ e.stopPropagation(); toggleMenu(); return } if(m.contains(e.target)){ const li = e.target.closest('li[data-action]'); if(li) activateMenuItem(li); return } if(!btn.contains(e.target)) closeMenu() })
  function renderPendingMeta(){ const pm = document.getElementById('pendingModel'); const pt = document.getElementById('pendingTopic'); if(pm){ pm.textContent = pendingMessageMeta.model || getActiveModel() || 'gpt-4o'; if(!pm.textContent) pm.textContent='gpt-4o'; pm.title = `Model: ${pendingMessageMeta.model || getActiveModel() || 'gpt-4o'} (Ctrl+M select (Input mode) · Ctrl+Shift+M manage (any mode))` } if(pt){ const topic = store.topics.get(pendingMessageMeta.topicId || currentTopicId); if(topic){ const path = formatTopicPath(topic.id); pt.textContent = middleTruncate(path, 90); pt.title = `Topic: ${path} (Ctrl+T pick, Ctrl+E edit)` } else { const rootTopic = store.topics.get(store.rootTopicId); if(rootTopic){ const path = formatTopicPath(rootTopic.id); pt.textContent = middleTruncate(path, 90); pt.title = `Topic: ${path} (Ctrl+T pick, Ctrl+E edit)` } else { pt.textContent='Select Topic'; pt.title='No topic found (Ctrl+T)' } } } }
  function formatTopicPath(id){ const parts = store.getTopicPath(id); if(parts[0]==='Root') parts.shift(); return parts.join(' > ') }
  function middleTruncate(str,max){ if(str.length<=max) return str; const keep=max-3; const head=Math.ceil(keep/2); const tail=Math.floor(keep/2); return str.slice(0,head)+'…'+str.slice(str.length-tail) }
  function updateSendDisabled(){ if(!sendBtn) return; const empty = inputField.value.trim().length===0; const zeroIncluded = (historyRuntime.getContextStats() && historyRuntime.getContextStats().includedCount===0); sendBtn.disabled = empty || lifecycle.isPending() || zeroIncluded; if(lifecycle.isPending()){ if(!sendBtn.__animTimer){ sendBtn.innerHTML='<span class="lbl">AI is thinking</span><span class="dots"><span>.</span><span>.</span><span>.</span></span>'; sendBtn.__animPhase=0; const applyPhase=()=>{ const dotsWrap = sendBtn.querySelector('.dots'); if(!dotsWrap) return; const spans = dotsWrap.querySelectorAll('span'); spans.forEach((sp,i)=>{ sp.style.opacity = (i < sendBtn.__animPhase) ? '1':'0' }) }; applyPhase(); sendBtn.__animTimer = setInterval(()=>{ if(!lifecycle.isPending()) return; sendBtn.__animPhase = (sendBtn.__animPhase + 1) % 4; applyPhase() }, 500) } sendBtn.classList.add('pending') } else { if(sendBtn.__animTimer){ clearInterval(sendBtn.__animTimer); sendBtn.__animTimer=null } sendBtn.textContent='Send'; sendBtn.classList.remove('pending'); if(zeroIncluded){ sendBtn.title='Cannot send: no pairs included in context (token budget exhausted)'; } else { sendBtn.title='Send' } } }
  function cycleAnchorMode(){ const settings = getSettings(); const order = ['bottom','center','top']; const idx = order.indexOf(settings.anchorMode || 'bottom'); const next = order[(idx+1)%order.length]; saveSettings({ anchorMode: next }); historyRuntime.applyActivePart(); console.log('Anchor mode ->', next) }
  modeManager.onChange((m)=>{ historyRuntime.renderStatus(); if(m==='view'){ commandInput.blur(); inputField.blur() } else if(m==='input'){ inputField.focus() } else if(m==='command'){ commandModeEntryActivePartId = activeParts.active() ? activeParts.active().id : null; commandInput.focus() } })
  const keyRouter = createKeyRouter({ modeManager, handlers:{ view:viewHandler, command:commandHandler, input:inputHandler } }); keyRouter.attach()
  document.addEventListener('click', e=>{
    const partEl = e.target.closest('.part'); if(!partEl) return
    // Ignore selection changes when clicking meta parts (request was: meta never becomes active via mouse)
    if(partEl.getAttribute('data-role') === 'meta'){
      // However, allow interactive controls inside meta to work without changing selection
      const t = e.target
      const tag = t && t.tagName ? t.tagName.toLowerCase() : ''
      const isInteractive = tag==='button' || tag==='a' || tag==='input' || tag==='textarea' || t.getAttribute('role')==='button' || t.isContentEditable
      if(isInteractive){ return }
      // Non-interactive click on meta: do nothing selection-wise
      return
    }
    activeParts.setActiveById(partEl.getAttribute('data-part-id'))
    historyRuntime.applyActivePart()
  })
  window.addEventListener('keydown', e=>{
    if(!e.ctrlKey) return;
    const k = e.key.toLowerCase();
    if(window.modalIsActive && window.modalIsActive()) return;
    if(k==='i'){ e.preventDefault(); modeManager.set('input') }
  else if(e.shiftKey && k==='d'){ e.preventDefault(); openDailyStatsOverlay({ store, activeParts, historyRuntime, modeManager }) }
  else if(k==='d' && !e.shiftKey){ e.preventDefault(); modeManager.set('command') }
    else if(k==='v'){ e.preventDefault(); modeManager.set('view') }
    else if(k==='t'){
      if(!document.getElementById('appLoading')){ e.preventDefault(); const prevMode = modeManager.mode; openQuickTopicPicker({ prevMode }) }
    }
    else if(k==='e' && !e.shiftKey){
      if(!document.getElementById('appLoading')){ e.preventDefault(); const prevMode = modeManager.mode; openTopicEditor({ store, onClose:()=>{ modeManager.set(prevMode) } }) }
    }
  else if(k==='m'){
      if(e.shiftKey){ e.preventDefault(); const prevMode=modeManager.mode; openModelEditor({ store, onClose: ()=>{ pendingMessageMeta.model = getActiveModel(); renderPendingMeta(); historyRuntime.renderCurrentView({ preserveActive:true }); modeManager.set(prevMode) } }) }
      else { if(modeManager.mode!=='input') return; e.preventDefault(); const prevMode=modeManager.mode; openModelSelector({ onClose: ()=>{ pendingMessageMeta.model = getActiveModel(); renderPendingMeta(); historyRuntime.renderCurrentView({ preserveActive:true }); modeManager.set(prevMode) } }) }
    }
    else if(k==='k'){ e.preventDefault(); const prevMode=modeManager.mode; openApiKeysOverlay({ modeManager, onClose:()=>{ modeManager.set(prevMode) } }) }
    else if(k===','){ e.preventDefault(); const prevMode=modeManager.mode; openSettingsOverlay({ onClose:()=>{ modeManager.set(prevMode) } }) }
    else if(e.key==='.' || e.code==='Period'){ e.preventDefault(); toggleMenu(); }
    else if(e.shiftKey && k==='r'){ e.preventDefault(); requestDebug.toggle(); }
    else if(e.shiftKey && k==='s'){ e.preventDefault(); window.seedTestMessages && window.seedTestMessages() }
  // Removed global error actions for clarity; use VIEW-only e/d on focused row
  })
  window.addEventListener('keydown', e=>{ if(e.key==='F1'){ e.preventDefault(); openHelpOverlay({ modeManager, onClose:()=>{} }) } })
  if(sendBtn){ sendBtn.addEventListener('click', ()=>{ if(modeManager.mode!=='input') modeManager.set('input'); const text = inputField.value.trim(); if(!text) return; if(lifecycle.isPending()) return; lifecycle.beginSend(); const topicId = pendingMessageMeta.topicId || currentTopicId; const model = pendingMessageMeta.model || 'gpt'; const editingId = window.__editingPairId; let id; if(editingId){ const old = store.pairs.get(editingId); if(old){ store.removePair(editingId) } id = store.addMessagePair({ topicId, model, userText:text, assistantText:'' }); window.__editingPairId=null } else { id = store.addMessagePair({ topicId, model, userText:text, assistantText:'' }) } try{ localStorage.setItem('maichat_pending_topic', topicId) }catch{} ;(async()=>{ try { const currentPairs = activeParts.parts.map(pt=> store.pairs.get(pt.pairId)).filter(Boolean); const chrono = [...new Set(currentPairs)].sort((a,b)=> a.createdAt - b.createdAt); const { content } = await executeSend({ store, model, userText:text, signal: undefined, visiblePairs: chrono, onDebugPayload:(payload)=>{ requestDebug.setPayload(payload) } }); store.updatePair(id, { assistantText: content, lifecycleState:'complete', errorMessage:undefined }); lifecycle.completeSend(); updateSendDisabled(); historyRuntime.renderCurrentView({ preserveActive:true }); lifecycle.handleNewAssistantReply(id) } catch(ex){ let errMsg = (ex && ex.message) ? ex.message : 'error'; if(errMsg==='missing_api_key') errMsg='API key missing (Ctrl+.) -> API Keys'; store.updatePair(id, { assistantText:'', lifecycleState:'error', errorMessage: errMsg }); lifecycle.completeSend(); updateSendDisabled(); historyRuntime.renderCurrentView({ preserveActive:true }) } finally { updateSendDisabled() } })(); inputField.value=''; historyRuntime.renderCurrentView({ preserveActive:true }); activeParts.last(); historyRuntime.applyActivePart(); updateSendDisabled() }); inputField.addEventListener('input', updateSendDisabled) }
  // Helpers for error edit/delete actions
  function isErrorPair(pairId){ const p = store.pairs.get(pairId); return !!p && p.lifecycleState==='error' }
  function handleEditIfErrorActive(){
    const act = activeParts.active(); if(!act) return false
    const pair = store.pairs.get(act.pairId); if(!pair || pair.lifecycleState!=='error') return false
    prepareEditResend(pair.id)
    return true
  }
  function handleDeleteIfErrorActive(){
    const act = activeParts.active(); if(!act) return false
    const pair = store.pairs.get(act.pairId); if(!pair || pair.lifecycleState!=='error') return false
    deletePairWithFocus(pair.id)
    return true
  }
  function prepareEditResend(pairId){
    const pair = store.pairs.get(pairId); if(!pair) return
    inputField.value = pair.userText || ''
    pendingMessageMeta.topicId = pair.topicId
    pendingMessageMeta.model = pair.model
    renderPendingMeta()
    // Clear error badge immediately for UX cleanliness (optional)
    store.updatePair(pair.id, { errorMessage: undefined })
    historyRuntime.renderCurrentView({ preserveActive:true })
    modeManager.set('input')
    inputField.focus()
    window.__editingPairId = pair.id
  }
  function deletePairWithFocus(pairId){
    const wasActive = !!activeParts.active() && activeParts.active().pairId === pairId
    const preParts = activeParts.parts.slice()
    let targetId = null
    if(wasActive){
      // Find previous non-meta part before the first part of the deleted pair
      const firstIdx = preParts.findIndex(p=> p.pairId===pairId)
      for(let i=firstIdx-1; i>=0; i--){ if(preParts[i].role!=='meta'){ targetId = preParts[i].id; break } }
    } else {
      const act = activeParts.active(); targetId = act ? act.id : null
    }
    store.removePair(pairId)
    historyRuntime.renderCurrentView({ preserveActive:true })
    if(targetId){ activeParts.setActiveById(targetId); historyRuntime.applyActivePart() }
    else {
      // No target available (likely empty list). Keep mode; nothing to focus.
    }
  }
  return { keyRouter, updateSendDisabled, renderPendingMeta, cycleAnchorMode, openQuickTopicPicker, prepareEditResend, deletePairWithFocus, isErrorPair }
}
