// interaction.js moved from ui/interaction/interaction.js (Phase 6.2 Interaction)
// NOTE: Imports updated to new feature/ and core paths.
import { parse } from '../command/parser.js'
import { evaluate } from '../command/evaluator.js'
import { getSettings } from '../../core/settings/index.js'
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
import { sanitizeAssistantText } from './sanitizeAssistant.js'

export function createInteraction({
  ctx,
  dom: { commandInput, commandErrEl, inputField, sendBtn, historyPaneEl },
  historyRuntime,
  requestDebug,
  hudRuntime
}){
  const { store, activeParts, lifecycle, boundaryMgr, pendingMessageMeta } = ctx
  const modeManager = window.__modeManager
  // Reading Mode toggle (centers on j/k when active)
  let readingMode = false
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
  const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : '/'
  const tutorialUrl = (BASE.endsWith('/') ? BASE : (BASE + '/')) + 'tutorial.html'
  const viewHandler = (e)=>{
    if(window.modalIsActive && window.modalIsActive()) return false
    window.__lastKey = e.key
    if(e.key==='Enter'){ modeManager.set('input'); return true }
    if(e.key==='Escape'){ modeManager.set('command'); return true }
    if(e.key==='r' && !e.ctrlKey && !e.metaKey && !e.altKey){
      readingMode = !readingMode
      hudRuntime && hudRuntime.setReadingMode && hudRuntime.setReadingMode(readingMode)
      // When turning ON, immediately center the currently focused part
      if(readingMode){
        try { const act = activeParts.active(); if(act && ctx.scrollController && ctx.scrollController.alignTo){ ctx.scrollController.alignTo(act.id, 'center', false) } } catch{}
      }
      return true
    }
  if(e.key==='j' || e.key==='ArrowDown'){
      activeParts.next();
      historyRuntime.applyActivePart();
      const act = activeParts.active(); if(act){
        if(readingMode && ctx.scrollController.alignTo){ ctx.scrollController.alignTo(act.id, 'center', false) }
        else if(ctx.scrollController.ensureVisible){ ctx.scrollController.ensureVisible(act.id, false) }
      }
      return true
    }
  if(e.key==='k' || e.key==='ArrowUp'){
      activeParts.prev();
      historyRuntime.applyActivePart();
      const act = activeParts.active(); if(act){
        if(readingMode && ctx.scrollController.alignTo){ ctx.scrollController.alignTo(act.id, 'center', false) }
        else if(ctx.scrollController.ensureVisible){ ctx.scrollController.ensureVisible(act.id, false) }
      }
      return true
    }
  if(e.key==='g'){
      activeParts.first();
      historyRuntime.applyActivePart();
      const act = activeParts.active(); if(act){ if(ctx.scrollController.ensureVisible){ ctx.scrollController.ensureVisible(act.id, false) } }
      readingMode = false; hudRuntime && hudRuntime.setReadingMode && hudRuntime.setReadingMode(false);
      return true
    }
  if(e.key==='G'){
      activeParts.last();
      historyRuntime.applyActivePart();
      const act = activeParts.active(); if(act){ if(ctx.scrollController.ensureVisible){ ctx.scrollController.ensureVisible(act.id, false) } }
      readingMode = false; hudRuntime && hudRuntime.setReadingMode && hudRuntime.setReadingMode(false);
      return true
    }
    // Jump to first in-context (included) pair and center it (one-shot, does not toggle Reading Mode)
    if((e.key==='O' && e.shiftKey) || e.key==='o'){
      historyRuntime.jumpToBoundary();
      try {
        const act = activeParts.active();
        if(act && ctx.scrollController && ctx.scrollController.alignTo){
          ctx.scrollController.alignTo(act.id, 'center', false)
        }
      } catch {}
      return true
    }
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
      // Handle debug/utility commands first
      if(q === ':hud' || q === ':hud on'){ hudEnabled=true; hudRuntime.enable(true); commandInput.value=''; commandErrEl.textContent=''; return true }
      if(q === ':hud off'){ hudEnabled=false; hudRuntime.enable(false); commandInput.value=''; commandErrEl.textContent=''; return true }
      if(q === ':maskdebug' || q === ':maskdebug on'){ maskDebug=true; commandInput.value=''; commandErrEl.textContent=''; historyRuntime.applySpacingStyles(getSettings()); historyRuntime.updateFadeVisibility(); return true }
      if(q === ':maskdebug off'){ maskDebug=false; commandInput.value=''; commandErrEl.textContent=''; historyRuntime.applySpacingStyles(getSettings()); historyRuntime.updateFadeVisibility(); return true }
      if(q === ':anim off' || q === ':noanim' || q === ':noanim on'){ ctx.scrollController.setAnimationEnabled(false); commandInput.value=''; commandErrEl.textContent=''; return true }
      if(q === ':anim on' || q === ':noanim off'){ ctx.scrollController.setAnimationEnabled(true); commandInput.value=''; commandErrEl.textContent=''; return true }
      if(q === ':scrolllog on'){ window.__scrollLog=true; commandInput.value=''; commandErrEl.textContent=''; return true }
      if(q === ':scrolllog off'){ window.__scrollLog=false; commandInput.value=''; commandErrEl.textContent=''; return true }

      // Apply filter (including empty) and rebuild view. Preserve focus if possible; else fallback.
  // Preserve focus based on snapshot taken on entering COMMAND mode only
  const prevActiveId = commandModeEntryActivePartId
      lifecycle.setFilterQuery(q)
      try {
        let pairs
        if(q){
          const ast = parse(q)
          const basePairsAll = store.getAllPairs().slice().sort((a,b)=> a.createdAt - b.createdAt)
          const currentBareTopicId = pendingMessageMeta.topicId || currentTopicId
          const currentBareModel = pendingMessageMeta.model || getActiveModel()
          // Helpers to detect/strip 'o' filters
          const hasO = (node)=>{
            if(!node) return false
            if(node.type==='FILTER' && node.kind==='o') return true
            if(node.type==='NOT') return hasO(node.expr)
            if(node.type==='AND' || node.type==='OR') return hasO(node.left) || hasO(node.right)
            return false
          }
          const stripO = (node)=>{
            if(!node) return null
            if(node.type==='FILTER' && node.kind==='o') return null
            if(node.type==='NOT'){
              const inner = stripO(node.expr)
              if(inner==null) return null
              return { type:'NOT', expr: inner }
            }
            if(node.type==='AND' || node.type==='OR'){
              const l = stripO(node.left)
              const r = stripO(node.right)
              if(!l && !r) return null
              if(!l) return r
              if(!r) return l
              return { type: node.type, left: l, right: r }
            }
            return node
          }
          if(hasO(ast)){
            const baseAst = stripO(ast) || { type:'ALL' }
            const base = evaluate(baseAst, basePairsAll, { store, currentTopicId: currentBareTopicId, currentModel: currentBareModel })
            // Compute boundary on base
            boundaryMgr.updateVisiblePairs(base)
            boundaryMgr.setModel(currentBareModel)
            boundaryMgr.applySettings(getSettings())
            const boundary = boundaryMgr.getBoundary()
            const includedIds = new Set(boundary.included.map(p=> p.id))
            const offContextOrder = base.filter(p=> !includedIds.has(p.id)).map(p=> p.id)
            pairs = evaluate(ast, base, { store, currentTopicId: currentBareTopicId, currentModel: currentBareModel, includedIds, offContextOrder })
          } else {
            pairs = evaluate(ast, basePairsAll, { store, currentTopicId: currentBareTopicId, currentModel: currentBareModel })
          }
        } else {
          pairs = store.getAllPairs().slice().sort((a,b)=> a.createdAt - b.createdAt)
        }
        historyRuntime.renderHistory(pairs)
        commandErrEl.textContent=''

        // If nothing to show, leave focus empty and viewport unchanged.
        if(!activeParts.parts.length){
          lastAppliedFilter = q
          // Turn off Reading Mode on apply (idempotent)
          readingMode = false; hudRuntime && hudRuntime.setReadingMode && hudRuntime.setReadingMode(false)
          pushCommandHistory(q); commandHistoryPos=-1
          modeManager.set('view')
          return true
        }

        // Try to preserve previous focused part if still present.
        let preserved = false
        if(prevActiveId){
          const before = activeParts.active() && activeParts.active().id
          activeParts.setActiveById(prevActiveId)
          const now = activeParts.active() && activeParts.active().id
          preserved = !!now && now === prevActiveId
          // If setActiveById couldn't match exactly, don't treat as preserved.
          if(!preserved && before && now === before){ preserved = false }
        }

        // Compute fallback focus and anchor when not preserved.
        let anchorTargetId = null
        if(!preserved){
          try{
            const lastPair = pairs && pairs.length ? pairs[pairs.length-1] : null
            if(lastPair){
              const lastId = lastPair.id
              // Find parts for this pair in current view
              const partsForPair = activeParts.parts.filter(p=> p.pairId === lastId)
              const assistants = partsForPair.filter(p=> p.role==='assistant')
              if(assistants.length){
                const focusPart = assistants[assistants.length-1]
                activeParts.setActiveById(focusPart.id)
                anchorTargetId = focusPart.id // anchor to the focused assistant part
              } else {
                const users = partsForPair.filter(p=> p.role==='user')
                if(users.length){
                  const focusPart = users[users.length-1]
                  activeParts.setActiveById(focusPart.id)
                  anchorTargetId = `${lastId}:meta` // anchor bottom to meta, not the focused user
                } else {
                  // Extremely rare: no user/assistant (shouldn't happen). Fallback to last non-meta in entire list
                  let idx = activeParts.parts.length-1
                  while(idx>=0 && activeParts.parts[idx].role==='meta') idx--
                  if(idx>=0){ activeParts.activeIndex = idx }
                  anchorTargetId = `${lastId}:meta`
                }
              }
            }
          } catch{}
        }

        // Apply visual active highlight
        historyRuntime.applyActivePart()

        // Ensure fresh metrics then one-shot bottom align
        try { if(ctx.scrollController && ctx.scrollController.remeasure) ctx.scrollController.remeasure() } catch {}
        try {
          const act = activeParts.active()
          const targetId = anchorTargetId || (act && act.id)
          if(targetId && ctx.scrollController && ctx.scrollController.alignTo){
            ctx.scrollController.alignTo(targetId, 'bottom', false)
          }
        } catch {}

        // Turn off Reading Mode on apply (idempotent) and switch to VIEW
        readingMode = false; hudRuntime && hudRuntime.setReadingMode && hudRuntime.setReadingMode(false)
        lastAppliedFilter = q; pushCommandHistory(q); commandHistoryPos=-1
        modeManager.set('view')
      } catch(ex){
        const raw = (ex && ex.message) ? String(ex.message).trim() : 'error'
        const friendly = (/^Unexpected token:/i.test(raw) || /^Unexpected trailing input/i.test(raw)) ? 'Incorrect command' : `Incorrect command: ${raw}`
        commandErrEl.textContent = friendly
      }
      return true
    }
    if(e.key==='Escape'){
      // Clear input only; do not rebuild, do not change mode, do not change Reading Mode
      if(commandInput.value){ commandInput.value=''; return true }
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
  const model = pendingMessageMeta.model || getActiveModel();
        boundaryMgr.updateVisiblePairs(store.getAllPairs().sort((a,b)=>a.createdAt-b.createdAt));
        boundaryMgr.setModel(pendingMessageMeta.model || getActiveModel());
        boundaryMgr.applySettings(getSettings());
        const preBoundary = boundaryMgr.getBoundary();
        const beforeIncludedIds = new Set(preBoundary.included.map(p=>p.id));
  lifecycle.beginSend(); readingMode = false; hudRuntime && hudRuntime.setReadingMode && hudRuntime.setReadingMode(false);
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
            const { content } = await executeSend({ store, model, topicId, userText:text, signal: undefined, visiblePairs: chrono, boundarySnapshot, onDebugPayload: (payload)=>{ historyRuntime.setSendDebug(payload.predictedMessageCount, payload.trimmedCount); requestDebug.setPayload(payload); historyRuntime.updateMessageCount(historyRuntime.getPredictedCount(), chrono.length) } });
            const clean = sanitizeAssistantText(content)
            store.updatePair(id, { assistantText: clean, lifecycleState:'complete', errorMessage:undefined });
            lifecycle.completeSend();
            updateSendDisabled();
            historyRuntime.renderCurrentView({ preserveActive:true });
            lifecycle.handleNewAssistantReply(id)
          } catch(ex){
            let errMsg = (ex && ex.message)? ex.message : 'error';
            if(errMsg==='missing_api_key') errMsg='API key missing (Ctrl+. → API Keys or Ctrl+K)';
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
        // Focus the new pair's last user part explicitly (meta remains non-focusable)
        try {
          const pane = document.getElementById('historyPane')
          const userEls = pane ? pane.querySelectorAll(`.part[data-pair-id="${id}"][data-role="user"]`) : null
          const lastUserEl = userEls && userEls.length ? userEls[userEls.length-1] : null
          if(lastUserEl){
            const lastUserId = lastUserEl.getAttribute('data-part-id')
            if(lastUserId){ activeParts.setActiveById(lastUserId) }
          } else {
            activeParts.last()
          }
        } catch { activeParts.last() }
        historyRuntime.applyActivePart();
  // One-shot: bottom-align the new meta row as visual cue (spec)
  // Ensure fresh metrics: remeasure immediately before aligning.
  if(id && ctx.scrollController && ctx.scrollController.alignTo){
    try { if(ctx.scrollController.remeasure) ctx.scrollController.remeasure() } catch {}
    ctx.scrollController.alignTo(`${id}:meta`, 'bottom', false)
  }
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
  let menuModal = null
  function toggleMenu(force){
    const btn = menuBtn(); const m = menuEl(); if(!btn||!m) return
    let show = force; if(show==null) show = m.hasAttribute('hidden')
    if(show){
      // Wrap existing menu in a modal backdrop container (non-centered)
      const backdrop = document.createElement('div')
      backdrop.className = 'overlay-backdrop' // not centered; acts as modal root
      // Ensure menu is visible inside the backdrop; preserve DOM structure
      m.removeAttribute('hidden')
      backdrop.appendChild(m)
      document.body.appendChild(backdrop)
      btn.setAttribute('aria-expanded','true')
      document.body.setAttribute('data-menu-open','1')
      // Init selection
      m.querySelectorAll('li.active').forEach(li=> li.classList.remove('active'))
      const first = m.querySelector('li'); if(first) first.classList.add('active')
      // Local key handler on backdrop (capture) so it's isolated
      function onKey(e){
        const nav=['j','k','ArrowDown','ArrowUp','Enter','Escape']
        if(!nav.includes(e.key)) return
        e.preventDefault(); e.stopImmediatePropagation()
        const items = Array.from(m.querySelectorAll('li'))
        let idx = items.findIndex(li=> li.classList.contains('active'))
        if(idx<0 && items.length){ idx=0; items[0].classList.add('active') }
        if(e.key==='Escape'){ closeMenu(); return }
        if(e.key==='j' || e.key==='ArrowDown'){
          if(items.length){ idx=(idx+1+items.length)%items.length; items.forEach(li=>li.classList.remove('active')); items[idx].classList.add('active') }
          return
        }
        if(e.key==='k' || e.key==='ArrowUp'){
          if(items.length){ idx=(idx-1+items.length)%items.length; items.forEach(li=>li.classList.remove('active')); items[idx].classList.add('active') }
          return
        }
        if(e.key==='Enter'){
          const act=items[idx]||items[0]; if(act) activateMenuItem(act)
          return
        }
      }
      backdrop.addEventListener('keydown', onKey, true)
      menuModal = openModal({ modeManager, root: backdrop, closeKeys:[], restoreMode:true, preferredFocus: ()=> first || m })
      // Click handling within menu
      backdrop.addEventListener('click', (e)=>{
        if(m.contains(e.target)){
          const li = e.target.closest('li[data-action]')
          if(li){ e.stopPropagation(); activateMenuItem(li) }
          return
        }
        // Click outside menu closes it
        closeMenu()
      })
    } else {
      closeMenu()
    }
  }
  function closeMenu(){
    const btn = menuBtn(); const m = menuEl(); if(!btn||!m) return
    if(menuModal){ try{ menuModal.close('manual') }catch{} menuModal=null }
    // Restore menu element back to its original container and hide
    const statusRight = document.getElementById('statusRight')
    if(statusRight && !m.parentElement?.isSameNode(statusRight)){
      statusRight.appendChild(m)
    }
    m.setAttribute('hidden','')
    document.body.removeAttribute('data-menu-open')
    btn.setAttribute('aria-expanded','false')
  }
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
    } else if(action==='tutorial'){
      try { window.open(tutorialUrl, '_blank', 'noopener'); } catch { window.location.href = tutorialUrl }
    } else if(action==='help'){
      openHelpOverlay({ modeManager, onClose:()=>{} })
    }
  }
  document.addEventListener('click', e=>{ const btn = menuBtn(); const m = menuEl(); if(!btn||!m) return; if(e.target===btn){ e.stopPropagation(); toggleMenu(); return } })
  function renderPendingMeta(){ const pm = document.getElementById('pendingModel'); const pt = document.getElementById('pendingTopic'); if(pm){ pm.textContent = pendingMessageMeta.model || getActiveModel() || 'gpt-4o-mini'; if(!pm.textContent) pm.textContent='gpt-4o-mini'; pm.title = `Model: ${pendingMessageMeta.model || getActiveModel() || 'gpt-4o-mini'} (Ctrl+M select (Input mode) · Ctrl+Shift+M manage (any mode))` } if(pt){ const topic = store.topics.get(pendingMessageMeta.topicId || currentTopicId); if(topic){ const path = formatTopicPath(topic.id); pt.textContent = middleTruncate(path, 90); pt.title = `Topic: ${path} (Ctrl+T pick, Ctrl+E edit)` } else { const rootTopic = store.topics.get(store.rootTopicId); if(rootTopic){ const path = formatTopicPath(rootTopic.id); pt.textContent = middleTruncate(path, 90); pt.title = `Topic: ${path} (Ctrl+T pick, Ctrl+E edit)` } else { pt.textContent='Select Topic'; pt.title='No topic found (Ctrl+T)' } } } }
  function formatTopicPath(id){ const parts = store.getTopicPath(id); if(parts[0]==='Root') parts.shift(); return parts.join(' > ') }
  function middleTruncate(str,max){ if(str.length<=max) return str; const keep=max-3; const head=Math.ceil(keep/2); const tail=Math.floor(keep/2); return str.slice(0,head)+'…'+str.slice(str.length-tail) }
  function updateSendDisabled(){
    if(!sendBtn) return;
    const empty = inputField.value.trim().length===0;
    const zeroIncluded = (historyRuntime.getContextStats() && historyRuntime.getContextStats().includedCount===0);
    const pending = lifecycle.isPending();
    sendBtn.disabled = empty || pending || zeroIncluded;
    if(pending){
      // Replace dot animation with timer (mm:ss)
      if(sendBtn.__animTimer){ clearInterval(sendBtn.__animTimer); sendBtn.__animTimer=null }
      if(!sendBtn.__pendingTimer){
        sendBtn.__pendingStart = Date.now();
        const renderTimer = ()=>{
          if(!lifecycle.isPending()){ return }
          const elapsed = Date.now() - (sendBtn.__pendingStart||Date.now());
          const mm = Math.floor(elapsed/60000);
          const ss = Math.floor((elapsed%60000)/1000);
          const label = `AI is thinking: ${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
          // Include a hidden widest-case placeholder (59:59) to keep width constant
          sendBtn.innerHTML = `<span class=\"lbl\" data-base=\"AI is thinking: 59:59\">${label}</span>`;
        };
        renderTimer();
        sendBtn.__pendingTimer = setInterval(()=>{ if(!lifecycle.isPending()){ return } renderTimer() }, 1000);
      }
      sendBtn.classList.add('pending');
      sendBtn.title = 'Request in progress…';
    } else {
      if(sendBtn.__pendingTimer){ clearInterval(sendBtn.__pendingTimer); sendBtn.__pendingTimer=null }
      if(sendBtn.__animTimer){ clearInterval(sendBtn.__animTimer); sendBtn.__animTimer=null }
      sendBtn.textContent='Send';
      sendBtn.classList.remove('pending');
      if(zeroIncluded){ sendBtn.title='Cannot send: no pairs included in context (token budget exhausted)'; }
      else { sendBtn.title='Send'; }
    }
  }
  
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
    // If Reading Mode is ON, center-align the newly focused part on click as well
    try {
      if(readingMode && ctx.scrollController && ctx.scrollController.alignTo){
        const act = activeParts.active(); if(act) ctx.scrollController.alignTo(act.id, 'center', false)
      }
    } catch {}
  })
  window.addEventListener('keydown', e=>{
    if(!e.ctrlKey) return;
    const k = e.key.toLowerCase();
    if(window.modalIsActive && window.modalIsActive()) return;
  if(k==='i'){ e.preventDefault(); modeManager.set('input') }
  else if(e.shiftKey && k==='d'){ e.preventDefault(); openDailyStatsOverlay({ store, activeParts, historyRuntime, modeManager }) }
  else if(k==='d' && !e.shiftKey){ e.preventDefault(); modeManager.set('command') }
    else if(k==='v'){ e.preventDefault(); modeManager.set('view') }
  else if(e.shiftKey && k==='h'){ e.preventDefault(); try { window.open(tutorialUrl, '_blank', 'noopener'); } catch { window.location.href = tutorialUrl } }
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
  if(sendBtn){ sendBtn.addEventListener('click', ()=>{ if(modeManager.mode!=='input') modeManager.set('input'); const text = inputField.value.trim(); if(!text) return; if(lifecycle.isPending()) return; lifecycle.beginSend(); const topicId = pendingMessageMeta.topicId || currentTopicId; const model = pendingMessageMeta.model || getActiveModel(); const editingId = window.__editingPairId; let id; if(editingId){ const old = store.pairs.get(editingId); if(old){ store.removePair(editingId) } id = store.addMessagePair({ topicId, model, userText:text, assistantText:'' }); window.__editingPairId=null } else { id = store.addMessagePair({ topicId, model, userText:text, assistantText:'' }) } try{ localStorage.setItem('maichat_pending_topic', topicId) }catch{} ;(async()=>{ try { const currentPairs = activeParts.parts.map(pt=> store.pairs.get(pt.pairId)).filter(Boolean); const chrono = [...new Set(currentPairs)].sort((a,b)=> a.createdAt - b.createdAt); const { content } = await executeSend({ store, model, topicId, userText:text, signal: undefined, visiblePairs: chrono, onDebugPayload:(payload)=>{ requestDebug.setPayload(payload) } }); const clean = sanitizeAssistantText(content); store.updatePair(id, { assistantText: clean, lifecycleState:'complete', errorMessage:undefined }); lifecycle.completeSend(); updateSendDisabled(); historyRuntime.renderCurrentView({ preserveActive:true }); lifecycle.handleNewAssistantReply(id) } catch(ex){ let errMsg = (ex && ex.message) ? ex.message : 'error'; if(errMsg==='missing_api_key') errMsg='API key missing (Ctrl+.) -> API Keys'; store.updatePair(id, { assistantText:'', lifecycleState:'error', errorMessage: errMsg }); lifecycle.completeSend(); updateSendDisabled(); historyRuntime.renderCurrentView({ preserveActive:true }) } finally { updateSendDisabled() } })(); inputField.value=''; historyRuntime.renderCurrentView({ preserveActive:true }); try { const pane = document.getElementById('historyPane'); const userEls = pane ? pane.querySelectorAll(`.part[data-pair-id="${id}"][data-role="user"]`) : null; const lastUserEl = userEls && userEls.length ? userEls[userEls.length-1] : null; if(lastUserEl){ const lastUserId = lastUserEl.getAttribute('data-part-id'); if(lastUserId){ activeParts.setActiveById(lastUserId) } } else { activeParts.last() } } catch { activeParts.last() } historyRuntime.applyActivePart(); updateSendDisabled() }); inputField.addEventListener('input', updateSendDisabled) }
  if(sendBtn){
    // Also bottom-align meta after send via button (in addition to legacy policy anchor)
    sendBtn.addEventListener('click', ()=>{
      readingMode = false; hudRuntime && hudRuntime.setReadingMode && hudRuntime.setReadingMode(false);
      try{
        const lastPair = activeParts.parts.length ? store.pairs.get(activeParts.parts[activeParts.parts.length-1].pairId) : null
        const id = lastPair ? lastPair.id : null
        if(id && ctx.scrollController && ctx.scrollController.alignTo){
          try { if(ctx.scrollController.remeasure) ctx.scrollController.remeasure() } catch {}
          ctx.scrollController.alignTo(`${id}:meta`, 'bottom', false)
        }
      } catch {}
    })
  }
  // No persistent policy to clear on scroll in stateless model
  // No policy clearing needed on typing in stateless model
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
  return { keyRouter, updateSendDisabled, renderPendingMeta, openQuickTopicPicker, prepareEditResend, deletePairWithFocus, isErrorPair }
}
