// interaction.js moved from ui/interaction/interaction.js (Phase 6.2 Interaction)
// NOTE: Imports updated to new feature/ and core paths.
import { parse } from '../command/parser.js'
import { evaluate } from '../command/evaluator.js'
import { getSettings } from '../../core/settings/index.js'
import { createKeyRouter } from './keyRouter.js'
import { splitFilterAndCommand } from '../command/colon/colonCommandSplitter.js'
import { parseColonCommand } from '../command/colon/colonCommandParser.js'
import { createCommandRegistry } from '../command/colon/colonCommandRegistry.js'
import { resolveTopicFilter } from '../command/topicResolver.js'
import { openConfirmOverlay } from '../command/confirmOverlay.js'
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
import { extractCodeBlocks } from '../codeDisplay/codeExtractor.js'
import { extractEquations } from '../codeDisplay/equationExtractor.js'
import { createCodeOverlay } from '../codeDisplay/codeOverlay.js'
import { createEquationOverlay } from '../codeDisplay/equationOverlay.js'
import { openModal } from '../../shared/openModal.js'
import { createViewKeyHandler } from './viewKeys.js'
import { createCommandKeyHandler } from './commandKeys.js'
import { createInputKeyHandler } from './inputKeys.js'
import { createAppMenuController } from './appMenu.js'
import { loadCommandHistory, saveCommandHistory, pushCommand, setFilterActive as setFilterActivePref, getFilterActive } from './userPrefs.js'

export function createInteraction({
  ctx,
  dom: { commandInput, commandErrEl, inputField, sendBtn, historyPaneEl },
  historyRuntime,
  requestDebug,
  hudRuntime
}){
  // Restore local state and utilities (previously at top)
  const { store, activeParts, lifecycle, boundaryMgr, pendingMessageMeta } = ctx
  const modeManager = window.__modeManager
  // Reading Mode toggle (centers on j/k when active)
  let readingMode = false
  let currentTopicId = store.rootTopicId
  let commandHistory = loadCommandHistory()
  let commandHistoryPos = -1
  function pushCommandHistory(q){ commandHistory = pushCommand(commandHistory, q); saveCommandHistory(commandHistory) }
  function setFilterActive(active){ setFilterActivePref(!!active) }
  function restoreLastFilter(){ 
  if(getFilterActive() && commandHistory.length > 0){ 
      const lastFilter = commandHistory[commandHistory.length-1]
      if(lastFilter){
        commandInput.value = lastFilter
        // Trigger filter application logic (same as pressing Enter)
        lifecycle.setFilterQuery(lastFilter)
        historyRuntime.renderCurrentView({ preserveActive:true })
        try {
          const act = ctx.activeParts && ctx.activeParts.active && ctx.activeParts.active()
          const id = act && act.id
          if(id && ctx.scrollController && ctx.scrollController.alignTo){
            requestAnimationFrame(()=>{ requestAnimationFrame(()=>{ ctx.scrollController.alignTo(id, 'bottom', false) }) })
          }
        } catch {}
        modeManager.set('view')
      }
    }
  }
  function historyPrev(){ 
    if(!commandHistory.length) return; 
    if(commandHistoryPos===-1) commandHistoryPos = commandHistory.length; 
    if(commandHistoryPos>0){ 
      commandHistoryPos--; 
      // If the new position shows the same value as currently in input, skip to previous
      if(commandHistory[commandHistoryPos] === commandInput.value && commandHistoryPos > 0){
        commandHistoryPos--;
      }
      commandInput.value = commandHistory[commandHistoryPos];
    } 
  }
  function historyNext(){ if(!commandHistory.length) return; if(commandHistoryPos===-1) return; if(commandHistoryPos < commandHistory.length) commandHistoryPos++; if(commandHistoryPos===commandHistory.length){ commandInput.value=''; commandHistoryPos=-1 } else { commandInput.value = commandHistory[commandHistoryPos] } }
  let lastAppliedFilter = ''
  let commandModeEntryActivePartId = null
  let hudEnabled = false
  let maskDebug = true
  const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : '/'
  const tutorialUrl = (BASE.endsWith('/') ? BASE : (BASE + '/')) + 'tutorial.html'

  // Create overlay instances (used by view handler and others)
  const codeOverlay = createCodeOverlay({ modeManager });
  const equationOverlay = createEquationOverlay({ modeManager });

  // VIEW handler extracted
  const getReadingMode = ()=> readingMode
  const setReadingMode = (v)=>{ readingMode = !!v }
  const viewHandler = createViewKeyHandler({
    modeManager,
    activeParts,
    historyRuntime,
    scrollController: ctx.scrollController,
    hudRuntime,
    store,
    codeOverlay,
    equationOverlay,
    getReadingMode,
    setReadingMode,
    cycleStar,
    toggleFlag,
    setStarRating,
    handleEditIfErrorActive,
    handleDeleteIfErrorActive,
  })

  // COMMAND handler extracted
  const commandHandler = createCommandKeyHandler({
    modeManager,
    commandInput,
    commandErrEl,
    lifecycle,
    store,
    boundaryMgr,
    pendingMessageMeta,
    historyRuntime,
    activeParts,
    scrollController: ctx.scrollController,
    hudRuntime,
    openConfirmOverlay,
    getCurrentTopicId: ()=> currentTopicId,
    pushCommandHistory: (q)=>{ pushCommandHistory(q); commandHistoryPos=-1 },
    historyPrev,
    historyNext,
    setFilterActive,
    getCommandModeEntryActivePartId: ()=> commandModeEntryActivePartId,
  })

  const inputHandler = createInputKeyHandler({
    modeManager,
    inputField,
    lifecycle,
    store,
    boundaryMgr,
    pendingMessageMeta,
    historyRuntime,
    activeParts,
    scrollController: ctx.scrollController,
    requestDebug,
    updateSendDisabled,
    getCurrentTopicId: ()=> currentTopicId,
    getReadingMode: ()=> readingMode,
    setReadingMode: (v)=>{ readingMode = !!v },
    sanitizeDisplayPreservingTokens,
    escapeHtmlAttr,
    escapeHtml,
  })
  function cycleStar(){
    const act = activeParts.active(); if(!act) return;
    const pair = store.pairs.get(act.pairId); if(!pair) return;
    const next = (pair.star+1)%4
    store.updatePair(pair.id, { star: next })
    updateMetaBadgesInline(pair.id, { star: next })
  }
  function setStarRating(star){
    const act = activeParts.active(); if(!act) return;
    const pair = store.pairs.get(act.pairId); if(!pair) return;
    if(pair.star===star) return;
    store.updatePair(pair.id,{ star })
    updateMetaBadgesInline(pair.id, { star })
  }
  function toggleFlag(){
    const act = activeParts.active(); if(!act) return;
    const pair = store.pairs.get(act.pairId); if(!pair) return;
    const next = pair.colorFlag==='b' ? 'g':'b'
    store.updatePair(pair.id,{ colorFlag:next })
    updateMetaBadgesInline(pair.id, { colorFlag: next })
  }
  function openQuickTopicPicker({ prevMode }){
    const openMode = prevMode || modeManager.mode;
    createTopicPicker({
      store,
      modeManager,
      onSelect:(topicId)=>{
        if(openMode==='input'){
          pendingMessageMeta.topicId=topicId; renderPendingMeta();
          try{ localStorage.setItem('maichat_pending_topic', pendingMessageMeta.topicId) }catch{}
        } else if(openMode==='view'){
          const act = activeParts.active();
          if(act){
            const pair = store.pairs.get(act.pairId);
            if(pair){
              store.updatePair(pair.id,{ topicId })
              // Inline update of topic badge; do not rebuild list per spec
              updateMetaBadgesInline(pair.id, { topicId })
              // Preserve focus styling
              activeParts.setActiveById(act.id); historyRuntime.applyActiveMessage()
            }
          }
        }
        if(prevMode) modeManager.set(prevMode)
      },
      onCancel:()=>{ if(prevMode) modeManager.set(prevMode) }
    })
  }

  function updateMetaBadgesInline(pairId, changes){
    try {
      const pane = document.getElementById('historyPane'); if(!pane) return
      // Query for assistant-meta in message-based view
      const metaRoot = pane.querySelector(`.message.assistant[data-pair-id="${pairId}"] .assistant-meta`)
      if(!metaRoot) return
      const left = metaRoot.querySelector('.meta-left')
      const right = metaRoot.querySelector('.meta-right')
      if(!left || !right) return
      // Stars
      if(Object.prototype.hasOwnProperty.call(changes,'star')){
        const v = Math.max(0, Math.min(3, Number(changes.star)||0))
        const starsEl = left.querySelector('.badge.stars')
        if(starsEl){ starsEl.textContent = '★'.repeat(v) + '☆'.repeat(Math.max(0,3-v)) }
      }
      // Flag
      if(Object.prototype.hasOwnProperty.call(changes,'colorFlag')){
        const flagEl = left.querySelector('.badge.flag')
        if(flagEl){
          flagEl.setAttribute('data-flag', changes.colorFlag==='b' ? 'b' : 'g')
          flagEl.title = (changes.colorFlag==='b') ? 'Flagged (blue)' : 'Unflagged (grey)'
        }
      }
      // Topic path text/title
      if(Object.prototype.hasOwnProperty.call(changes,'topicId')){
        const badge = left.querySelector('.badge.topic')
        const topic = store.topics.get(changes.topicId)
        if(badge && topic){
          const path = formatTopicPath(topic.id)
          badge.textContent = middleTruncate(path, 72)
          badge.title = path
        }
      }
    } catch {}
  }
  // App menu controller
  const appMenu = createAppMenuController({
    modeManager,
    store,
    activeParts,
    historyRuntime,
    pendingMessageMeta,
    tutorialUrl,
    overlays: { openTopicEditor, openModelEditor, openDailyStatsOverlay, openSettingsOverlay, openApiKeysOverlay, openHelpOverlay },
    getActiveModel,
    renderPendingMeta,
    scrollController: ctx.scrollController,
  })
  appMenu.handleGlobalClick()
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
  
  modeManager.onChange((m)=>{ 
    historyRuntime.renderStatus(); 
    if(m==='view'){ 
      commandInput.blur(); inputField.blur() 
    } else if(m==='input'){ 
      // Delay focus to avoid mouse click interference
      requestAnimationFrame(()=> inputField.focus())
    } else if(m==='command'){ 
      commandModeEntryActivePartId = activeParts.active() ? activeParts.active().id : null;
      // Reset command history position so first Ctrl-P shows previous command, not current
      commandHistoryPos = commandHistory.length;
      // Delay focus to avoid mouse click interference
      requestAnimationFrame(()=> commandInput.focus())
    } 
  })
  const keyRouter = createKeyRouter({ modeManager, handlers:{ view:viewHandler, command:commandHandler, input:inputHandler } }); keyRouter.attach()

  // Helpers for segmented sanitize preserving placeholders & inline equation markers
  function sanitizeDisplayPreservingTokens(text){
    if(!text) return text || '';
    const TOKEN_REGEX = /(\[[a-zA-Z0-9_]+-\d+\]|\[eq-\d+\]|__EQINL_\d+__)/g;
    const parts = text.split(TOKEN_REGEX).filter(p=> p!=='' && p!=null);
    let out = '';
    for(const part of parts){
      if(TOKEN_REGEX.test(part)){
        out += part; // token untouched
      } else {
        out += sanitizeAssistantText(part);
      }
      TOKEN_REGEX.lastIndex = 0;
    }
    return out;
  }
  function escapeHtmlAttr(str){ return String(str).replace(/[&<>"']/g, s=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[s])); }
  function escapeHtml(str){ const div=document.createElement('div'); div.textContent=str; return div.innerHTML; }
    document.addEventListener('click', e=>{
      const msgEl = e.target.closest('.message'); if(!msgEl) return
      // Allow interactive controls to work without changing selection when inside assistant-meta
      const t = e.target
      const tag = t && t.tagName ? t.tagName.toLowerCase() : ''
      const isInteractive = tag==='button' || tag==='a' || tag==='input' || tag==='textarea' || t.getAttribute('role')==='button' || t.isContentEditable
      if(isInteractive) return
      const id = msgEl.getAttribute('data-part-id')
      if(!id) return
      activeParts.setActiveById(id)
      historyRuntime.applyActiveMessage()
      // No auto-scroll on click per spec. If reading mode is ON, we still center for readability.
      try {
        if(readingMode && ctx.scrollController && ctx.scrollController.alignToMessage){
          const act = activeParts.active(); if(act) ctx.scrollController.alignToMessage(act.id, 'center', false)
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
      if(e.shiftKey){
        e.preventDefault();
        const prevMode=modeManager.mode;
        openModelEditor({ store, onClose: ({ dirty } = {})=>{
          pendingMessageMeta.model = getActiveModel();
          renderPendingMeta();
          if(dirty){
            historyRuntime.renderCurrentView({ preserveActive:true });
            try {
              const act = ctx.activeParts && ctx.activeParts.active && ctx.activeParts.active();
              const id = act && act.id;
              if(id && ctx.scrollController && ctx.scrollController.alignTo){
                requestAnimationFrame(()=>{ requestAnimationFrame(()=>{ ctx.scrollController.alignTo(id, 'bottom', false) }) })
              }
            } catch {}
          }
          modeManager.set(prevMode)
        } })
      }
      else {
        if(modeManager.mode!=='input') return;
        e.preventDefault();
        const prevMode=modeManager.mode;
        openModelSelector({ onClose: ({ dirty } = {})=>{
          pendingMessageMeta.model = getActiveModel();
          renderPendingMeta();
          if(dirty){
            historyRuntime.renderCurrentView({ preserveActive:true });
            try {
              const act = ctx.activeParts && ctx.activeParts.active && ctx.activeParts.active();
              const id = act && act.id;
              if(id && ctx.scrollController && ctx.scrollController.alignTo){
                requestAnimationFrame(()=>{ requestAnimationFrame(()=>{ ctx.scrollController.alignTo(id, 'bottom', false) }) })
              }
            } catch {}
          }
          modeManager.set(prevMode)
        } })
      }
    }
    else if(k==='k'){ e.preventDefault(); const prevMode=modeManager.mode; openApiKeysOverlay({ modeManager, onClose:()=>{ modeManager.set(prevMode) } }) }
    else if(k===','){ e.preventDefault(); const prevMode=modeManager.mode; openSettingsOverlay({ onClose:()=>{ modeManager.set(prevMode) } }) }
  else if(e.key==='.' || e.code==='Period'){ e.preventDefault(); appMenu.toggle(); }
    else if(e.shiftKey && k==='r'){ e.preventDefault(); requestDebug.toggle(); }
    else if(e.shiftKey && k==='s'){ e.preventDefault(); window.seedTestMessages && window.seedTestMessages() }
  // Removed global error actions for clarity; use VIEW-only e/d on focused row
  })
  window.addEventListener('keydown', e=>{ if(e.key==='F1'){ e.preventDefault(); openHelpOverlay({ modeManager, onClose:()=>{} }) } })
  if(sendBtn){ sendBtn.addEventListener('click', ()=>{ if(modeManager.mode!=='input') modeManager.set('input'); const text = inputField.value.trim(); if(!text) return; if(lifecycle.isPending()) return; lifecycle.beginSend(); const topicId = pendingMessageMeta.topicId || currentTopicId; const model = pendingMessageMeta.model || getActiveModel(); const editingId = window.__editingPairId; let id; if(editingId){ const old = store.pairs.get(editingId); if(old){ store.removePair(editingId) } id = store.addMessagePair({ topicId, model, userText:text, assistantText:'' }); window.__editingPairId=null } else { id = store.addMessagePair({ topicId, model, userText:text, assistantText:'' }) } try{ localStorage.setItem('maichat_pending_topic', topicId) }catch{} ;(async()=>{ try { const currentPairs = activeParts.parts.map(pt=> store.pairs.get(pt.pairId)).filter(Boolean); const chrono = [...new Set(currentPairs)].sort((a,b)=> a.createdAt - b.createdAt); const { content } = await executeSend({ store, model, topicId, userText:text, signal: undefined, visiblePairs: chrono, onDebugPayload:(payload)=>{ requestDebug.setPayload(payload) } }); const clean = sanitizeAssistantText(content); store.updatePair(id, { assistantText: clean, lifecycleState:'complete', errorMessage:undefined }); lifecycle.completeSend(); updateSendDisabled(); historyRuntime.renderCurrentView({ preserveActive:true }); lifecycle.handleNewAssistantReply(id) } catch(ex){ let errMsg = (ex && ex.message) ? ex.message : 'error'; if(errMsg==='missing_api_key') errMsg='API key missing (Ctrl+.) -> API Keys'; store.updatePair(id, { assistantText:'', lifecycleState:'error', errorMessage: errMsg }); lifecycle.completeSend(); updateSendDisabled(); historyRuntime.renderCurrentView({ preserveActive:true }) } finally { updateSendDisabled() } })(); inputField.value=''; historyRuntime.renderCurrentView({ preserveActive:true }); try { const pane = document.getElementById('historyPane'); const userEls = pane ? pane.querySelectorAll(`.message[data-pair-id="${id}"][data-role="user"], .part[data-pair-id="${id}"][data-role="user"]`) : null; const lastUserEl = userEls && userEls.length ? userEls[userEls.length-1] : null; if(lastUserEl){ const lastUserId = lastUserEl.getAttribute('data-part-id'); if(lastUserId){ activeParts.setActiveById(lastUserId) } } else { activeParts.last() } } catch { activeParts.last() } historyRuntime.applyActivePart(); updateSendDisabled() }); inputField.addEventListener('input', updateSendDisabled) }
  if(sendBtn){
    // Also bottom-align meta after send via button (in addition to legacy policy anchor)
    sendBtn.addEventListener('click', ()=>{
      readingMode = false; hudRuntime && hudRuntime.setReadingMode && hudRuntime.setReadingMode(false);
      try{
        const lastPair = activeParts.parts.length ? store.pairs.get(activeParts.parts[activeParts.parts.length-1].pairId) : null
        const id = lastPair ? lastPair.id : null
        if(id && ctx.scrollController && ctx.scrollController.alignTo){
          try { if(ctx.scrollController.remeasure) ctx.scrollController.remeasure() } catch {}
          try {
            // Lazy import to avoid cyclic deps; avoid await in non-async function
            import('../history/featureFlags.js').then(mod=>{
              const useMsg = mod && mod.shouldUseMessageView && mod.shouldUseMessageView()
              const anchorId = useMsg ? `${id}:a` : `${id}:meta`
              ctx.scrollController.alignTo(anchorId, 'bottom', false)
            }).catch(()=>{
              ctx.scrollController.alignTo(`${id}:meta`, 'bottom', false)
            })
          } catch {
            ctx.scrollController.alignTo(`${id}:meta`, 'bottom', false)
          }
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
    // Delete the original pair after copying its content
    store.removePair(pair.id)
    historyRuntime.renderCurrentView({ preserveActive:true })
    // Focus on last part and bottom align
    try {
      activeParts.last()
      historyRuntime.applyActivePart()
      const act = activeParts.active()
      const id = act && act.id
      if(id && ctx.scrollController && ctx.scrollController.alignTo){
        requestAnimationFrame(()=>{ requestAnimationFrame(()=>{ ctx.scrollController.alignTo(id, 'bottom', false) }) })
      }
    } catch {}
    modeManager.set('input')
    inputField.focus()
    window.__editingPairId = pair.id
  }
  function deletePairWithFocus(pairId){
    store.removePair(pairId)
    historyRuntime.renderCurrentView({ preserveActive:true })
    // Always focus on last part and bottom align after deletion
    try {
      activeParts.last()
      historyRuntime.applyActivePart()
      const act = activeParts.active()
      const id = act && act.id
      if(id && ctx.scrollController && ctx.scrollController.alignTo){
        requestAnimationFrame(()=>{ requestAnimationFrame(()=>{ ctx.scrollController.alignTo(id, 'bottom', false) }) })
      }
    } catch {
      // If no parts remain (empty history), no focus needed
    }
  }
  return { keyRouter, updateSendDisabled, renderPendingMeta, openQuickTopicPicker, prepareEditResend, deletePairWithFocus, isErrorPair, restoreLastFilter }
}
