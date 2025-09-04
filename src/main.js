import './style.css'
// Step 1 extraction: runtime setup moved to runtime/runtimeSetup.js
import { initRuntime } from './runtime/runtimeSetup.js'
// (Removed direct imports: createStore, attachIndexes, createIndexedDbAdapter, attachContentPersistence, createHistoryView, ActivePartController, createScrollController, createBoundaryManager, createNewMessageLifecycle)
// Removed unused TEMP imports (createStore, attachIndexes) after runtime extraction
import { parse } from './filter/parser.js'
import { evaluate } from './filter/evaluator.js'
import { createModeManager, MODES } from './ui/modes.js'
import { createKeyRouter } from './ui/keyRouter.js'
import { bindHistoryErrorActions } from './ui/history/historyView.js'
import { createHistoryRuntime } from './ui/history/historyRuntime.js'
// Removed unused TEMP UI construction imports (anchorManager, scrollController)
import { getSettings, subscribeSettings, saveSettings } from './settings/index.js'
import { invalidatePartitionCacheOnResize } from './partition/partitioner.js'
// Removed unused persistence construction imports
import { createTopicPicker } from './ui/topicPicker.js'
import { openTopicEditor } from './ui/topicEditor.js'
import { modalIsActive, createFocusTrap } from './ui/focusTrap.js'
import { escapeHtml } from './ui/util.js'
// newMessageLifecycle provided via runtimeSetup
import { openSettingsOverlay } from './ui/settingsOverlay.js'
import { openApiKeysOverlay } from './ui/apiKeysOverlay.js'
import { getApiKey } from './api/keys.js'
import { ensureCatalogLoaded, getActiveModel } from './models/modelCatalog.js'
import { seedDemoPairs, exposeSeedingHelpers } from './store/demoSeeding.js'
import { openModelSelector } from './ui/modelSelector.js'
import { openModelEditor } from './ui/modelEditor.js'
import { openHelpOverlay } from './ui/helpOverlay.js'
// Boundary manager supersedes legacy gatherContext.
// boundaryManager provided via runtimeSetup
import { registerProvider } from './provider/adapter.js'
import { createOpenAIAdapter } from './provider/openaiAdapter.js'
import { executeSend } from './send/pipeline.js'
// Mask system removed; using fade-based visibility.

// Mode management
const modeManager = createModeManager()
// Expose for late-bound lifecycle logic (avoids circular import)
window.__modeManager = modeManager
window.__MODES = MODES

// Root layout
const appEl = document.querySelector('#app')
appEl.innerHTML = `
  <div id="topBar" class="zone">
    <div id="commandWrapper">
      <input id="commandInput" placeholder=": command / filter" autocomplete="off" />
    </div>
    <div id="statusRight">
      <span id="messageCount" title="Visible message pairs" class="mc">0</span>
      <button id="appMenuBtn" aria-haspopup="true" aria-expanded="false" title="Menu (Ctrl+.)" class="menu-btn" tabindex="0">⋮</button>
      <div id="appMenu" class="app-menu" hidden>
        <ul>
          <li data-action="topic-editor"><span class="label">Topic Editor</span><span class="hint">Ctrl+E</span></li>
          <li data-action="settings"><span class="label">Settings</span><span class="hint">Ctrl+,</span></li>
          <li data-action="api-keys"><span class="label">API Keys</span><span class="hint">Ctrl+K</span></li>
          <li data-action="help"><span class="label">Help</span><span class="hint">F1</span></li>
        </ul>
      </div>
      <span id="commandError"></span>
    </div>
  </div>
  <div id="historyPane" class="zone">
  <div id="history" class="history"></div>
  </div>
  <div id="inputBar" class="zone">
    <div class="inputBar-inner">
      <div class="row first">
        <input id="inputField" placeholder="Type message... (Enter to send)" autocomplete="off" />
      </div>
      <div class="row second">
        <div class="input-meta-left">
          <div id="modeIndicator" class="mode-label"></div>
          <span id="pendingModel" title="Model"></span>
          <span id="pendingTopic" title="Topic"></span>
        </div>
        <button id="sendBtn" disabled>Send</button>
      </div>
    </div>
  </div>
`

// Loading guard overlay (removed after bootstrap)
const loadingEl = document.createElement('div')
loadingEl.id = 'appLoading'
loadingEl.style.position = 'fixed'
loadingEl.style.inset = '0'
loadingEl.style.display = 'flex'
loadingEl.style.alignItems = 'center'
loadingEl.style.justifyContent = 'center'
loadingEl.style.background = 'rgba(0,0,0,0.4)'
loadingEl.style.fontSize = '0.9rem'
loadingEl.style.letterSpacing = '0.05em'
loadingEl.style.fontFamily = 'inherit'
loadingEl.textContent = 'Loading…'
document.body.appendChild(loadingEl)

// (layoutHistoryPane now provided by historyRuntime after runtime init)

// (Removed duplicate layoutHistoryPane & resize listeners – historyRuntime owns them)

// Debug HUD container
const hudEl = document.createElement('div')
hudEl.id = 'hud'
document.body.appendChild(hudEl)

// Runtime context (Phase 1 minimal extraction)
const __runtime = initRuntime()
const { store, persistence, activeParts, historyView, scrollController, boundaryMgr, lifecycle, pendingMessageMeta } = __runtime
// History runtime (Phase 1 Step 3 extraction)
const historyRuntime = createHistoryRuntime(__runtime)
const { layoutHistoryPane, applySpacingStyles, renderHistory, renderCurrentView, applyActivePart, updateFadeVisibility, updateMessageCount, applyOutOfContextStyling, jumpToBoundary, renderStatus } = historyRuntime
// Initial layout pass (deferred until after historyRuntime creation)
requestAnimationFrame(layoutHistoryPane)
let currentTopicId = store.rootTopicId
const historyPaneEl = document.getElementById('historyPane')
bindHistoryErrorActions(document.getElementById('history'), {
  onResend: (pairId)=>{
    const pair = store.pairs.get(pairId)
    if(!pair) return
    // Put text into input for editing
    inputField.value = pair.userText
    pendingMessageMeta.topicId = pair.topicId
    pendingMessageMeta.model = pair.model
    renderPendingMeta()
  // (Removed) editing lifecycle state no longer used; editing tracked via window.__editingPairId only.
    pair.errorMessage = undefined
  renderCurrentView({ preserveActive:true })
    modeManager.set(MODES.INPUT)
    inputField.focus()
    // Track editing target
    window.__editingPairId = pair.id
  },
  onDelete: (pairId)=>{
    store.removePair(pairId)
  renderCurrentView({ preserveActive:true })
    activeParts.last(); applyActivePart()
  }
})
// Preload settings
getSettings()
let __lastPF = getSettings().partFraction
let __lastPadding = getSettings().partPadding
subscribeSettings((s)=>{ 
  // Detect partFraction change to invalidate partition cache even if computed maxLines coincidentally unchanged
  if(s.partFraction !== __lastPF){
    __lastPF = s.partFraction
    invalidatePartitionCacheOnResize()
  }
  if(s.partPadding !== __lastPadding){
    __lastPadding = s.partPadding
    invalidatePartitionCacheOnResize()
  }
  applySpacingStyles(s); layoutHistoryPane(); renderCurrentView({ preserveActive:true }) 
})
let overlay = null // { type: 'topic', list:[], activeIndex:0 } (model selection now separate overlay component)
// pendingMessageMeta & lifecycle sourced from runtime setup now

function renderTopics(){ /* hidden for now */ }

let __requestDebugEnabled = false
let __lastSentRequest = null
// context stats & counts now sourced from historyRuntime getters
// Initialize request debug from URL (?reqdbg=1)
try {
  const usp = new URLSearchParams(window.location.search)
  if(usp.get('reqdbg') === '1'){ __requestDebugEnabled = true; requestAnimationFrame(()=> renderRequestDebug()) }
} catch{}

function ensureRequestDebugOverlay(){
  if(document.getElementById('requestDebugOverlay')) return
  const pane = document.createElement('div')
  pane.id = 'requestDebugOverlay'
  pane.style.position='fixed'
  pane.style.bottom='110px'
  pane.style.right='16px'
  pane.style.width='480px'
  pane.style.maxHeight='40vh'
  pane.style.overflow='auto'
  pane.style.background='rgba(10,20,30,0.92)'
  pane.style.border='1px solid #244'
  pane.style.font='11px/1.4 var(--font-mono, monospace)'
  pane.style.padding='8px 10px'
  pane.style.borderRadius='6px'
  pane.style.boxShadow='0 4px 18px rgba(0,0,0,0.5)'
  pane.style.zIndex='1600'
  pane.style.whiteSpace='pre-wrap'
  pane.style.letterSpacing='.3px'
  pane.style.display='none'
  pane.setAttribute('aria-live','polite')
  document.body.appendChild(pane)
}
function renderRequestDebug(){
  ensureRequestDebugOverlay()
  const pane = document.getElementById('requestDebugOverlay')
  if(!pane) return
  if(!__requestDebugEnabled){ pane.style.display='none'; return }
  pane.style.display='block'
  if(!__lastSentRequest){ pane.textContent = '[request debug] No request sent yet.'; return }
  const { model, budget, selection, AUT, attemptTotalTokens, attemptHistoryTokens, predictedHistoryTokens, remainingReserve, attemptsUsed, trimmedCount, predictedMessageCount, messages, lastErrorMessage, overflowMatched, stage, timing } = __lastSentRequest
  const settings = getSettings()
  const ctxStats = historyRuntime.getContextStats()
  const uraVal = (ctxStats && (('URA' in ctxStats)? ctxStats.URA : ctxStats.assumedUserTokens)) ?? settings.userRequestAllowance
  const cpt = settings.charsPerToken
  const nta = settings.maxTrimAttempts
  const ml = (budget.maxContext||budget.maxUsableRaw)
  const initialAttemptTotal = (predictedHistoryTokens!=null && AUT!=null) ? (predictedHistoryTokens + AUT) : null
  const finalAttemptTotal = (attemptHistoryTokens!=null && AUT!=null) ? (attemptHistoryTokens + AUT) : null
  const trimmedTok = (predictedHistoryTokens!=null && attemptHistoryTokens!=null) ? (predictedHistoryTokens - attemptHistoryTokens) : 0
  const lines = []
  lines.push(`MODEL: ${model}`)
  lines.push(`PARAMETERS: URA=${uraVal} CPT=${cpt} NTA=${nta} ML=${ml}`)
  lines.push(`PREDICTED_HISTORY_CONTEXT: n_of_messages=${predictedMessageCount} n_of_tokens=${predictedHistoryTokens!=null?predictedHistoryTokens:'-'}`)
  lines.push(`ACTUAL:`)
  lines.push(`  tokens_in_new_user_request=${AUT!=null?AUT:'-'}`)
  lines.push(`  tokens_in_initial_attempted_request=${initialAttemptTotal!=null?initialAttemptTotal:'-'}`)
  lines.push(`TRIMMING:`)
  lines.push(`  N_of_attempts=${attemptsUsed!=null?attemptsUsed:0}`)
  lines.push(`  N_of_tokens_trimmed=${trimmedTok}`)
  lines.push(`  tokens_in_final_attempted_request=${finalAttemptTotal!=null?finalAttemptTotal:'-'}`)
  lines.push(`  remaining_estimate=${remainingReserve!=null?remainingReserve:'-'}`)
  if(timing){
    const tPredict = timing.tAfterPrediction!=null ? (timing.tAfterPrediction - timing.t0).toFixed(1) : '-'
    lines.push(`TIMING:`)
    lines.push(`  prediction_ms=${tPredict}`)
    if(Array.isArray(timing.attempts)){
      timing.attempts.forEach(a=>{
        const dur = a.duration!=null? a.duration.toFixed(1):'-'
        let prov=''
        if(a.provider){
          prov = ` serialize=${a.provider.serialize_ms?.toFixed(1)||'-'} fetch=${a.provider.fetch_ms?.toFixed(1)||'-'} parse=${a.provider.parse_ms?.toFixed(1)||'-'}`
        }
        lines.push(`  attempt_${a.attempt}_ms=${dur} trimmedCountAtStart=${a.trimmedCount}${prov}`)
      })
    }
  }
  if(lastErrorMessage){
    lines.push(`ERROR: msg="${lastErrorMessage}" overflowMatched=${overflowMatched?'1':'0'} stage=${stage||'-'}`)
  }
  lines.push(`INCLUDED PAIRS (${selection.length}):`)
  selection.forEach(s=> lines.push(`  - ${s.id.slice(0,8)} m:${s.model} estTok:${s.tokens}`))
  lines.push('MESSAGES:')
  messages.forEach((m,i)=>{
    lines.push(`  [${i}] ${m.role}:`)
    const txt = (m.content||'').split(/\n/)
    txt.slice(0,20).forEach(l=> lines.push('      '+l))
    if(txt.length>20) lines.push('      ...')
  })
  // Raw JSON payload (without apiKey) exactly as passed to provider
  try {
    const raw = { model, messages }
    lines.push('RAW REQUEST JSON:')
    lines.push(JSON.stringify(raw, null, 2))
  } catch{}
  // Add copy button (lightweight) once
  if(!pane.__hasCopy){
    const btn = document.createElement('button')
    btn.textContent = 'Copy JSON'
    btn.style.position='absolute'; btn.style.top='4px'; btn.style.right='6px'; btn.style.font='10px var(--font-ui)'; btn.style.padding='2px 6px'; btn.style.background='#123a55'; btn.style.border='1px solid #25506f'; btn.style.color='#cce'; btn.style.cursor='pointer'; btn.style.borderRadius='4px'
    btn.addEventListener('click', ()=>{
      try { navigator.clipboard.writeText(JSON.stringify({ model, messages }, null, 2)) } catch{}
      btn.textContent = 'Copied'
      setTimeout(()=>{ btn.textContent='Copy JSON' }, 1400)
    })
    pane.appendChild(btn)
    pane.__hasCopy = true
  }
  // Replace (but preserve button) content region
  let pre = pane.querySelector('pre')
  if(!pre){ pre = document.createElement('pre'); pre.style.margin='0'; pre.style.padding='0 0 4px'; pre.style.font='11px/1.4 var(--font-mono, monospace)'; pane.appendChild(pre) }
  pre.textContent = lines.join('\n')
}
// renderHistory, renderCurrentView, applyActivePart now provided by historyRuntime

// ---------- Spacing Runtime Styles & Debug Toggles ----------
let __hudEnabled = false
let __maskDebug = true // reserved for future debug gradients
// applySpacingStyles now from historyRuntime

// Show/hide top mask based on anchor mode (only in 'top'). Keeps layout gap structural via padding while visually hiding any preceding slice.
// updateFadeVisibility now from historyRuntime (scroll listener attached there)

// escapeHtml centralized in ui/util.js

// renderStatus now from historyRuntime


async function bootstrap(){
  // Register providers
  registerProvider('openai', createOpenAIAdapter())
  await persistence.init()
  ensureCatalogLoaded()
  // (Removed temporary dev override of partFraction)
  applySpacingStyles(getSettings())
  // Restore persisted pending topic if available
  try {
    const savedPending = localStorage.getItem('maichat_pending_topic')
    if(savedPending && store.topics.has(savedPending)){
      pendingMessageMeta.topicId = savedPending
    }
  } catch{}
  if(store.getAllPairs().length === 0){
    seedDemoPairs(store)
  }
  renderCurrentView()
  renderTopics()
  renderStatus()
  applyActivePart()
  if(!pendingMessageMeta.topicId) pendingMessageMeta.topicId = store.rootTopicId
  // Persist initial topic selection
  try { localStorage.setItem('maichat_pending_topic', pendingMessageMeta.topicId) } catch{}
  // Ensure topic badge text reflects final topic id after store init
  renderPendingMeta()
  layoutHistoryPane()
  // Remove loading guard
  loadingEl.remove()
}
bootstrap()

// Ensure pending persistence queued writes flushed on tab close
window.addEventListener('beforeunload', ()=>{ if(persistence && persistence.flush) persistence.flush() })

// Inputs
const commandInput = document.getElementById('commandInput')
const commandErrEl = document.getElementById('commandError')
const inputField = document.getElementById('inputField')
const sendBtn = document.getElementById('sendBtn')

// ----- Command mode state (filter, history, selection memory) -----
let __lastAppliedFilter = '' // last successfully applied filter string
let __commandModeEntryActivePartId = null // active part id when entering command mode (for restoration if filter unchanged)
let __commandHistory = [] // array of past entered commands (non-empty)
let __commandHistoryPos = -1 // -1 means at fresh (after last)
try {
  const savedHist = localStorage.getItem('maichat_command_history')
  if(savedHist){ const arr = JSON.parse(savedHist); if(Array.isArray(arr)) __commandHistory = arr.slice(-100) }
} catch{}
function pushCommandHistory(q){
  if(!q) return
  if(__commandHistory[__commandHistory.length-1] === q) return
  __commandHistory.push(q)
  if(__commandHistory.length > 100) __commandHistory = __commandHistory.slice(-100)
  try { localStorage.setItem('maichat_command_history', JSON.stringify(__commandHistory)) } catch{}
}
function historyPrev(){
  if(!__commandHistory.length) return
  if(__commandHistoryPos === -1) __commandHistoryPos = __commandHistory.length
  if(__commandHistoryPos > 0){ __commandHistoryPos--; commandInput.value = __commandHistory[__commandHistoryPos] }
}
function historyNext(){
  if(!__commandHistory.length) return
  if(__commandHistoryPos === -1) return
  if(__commandHistoryPos < __commandHistory.length) __commandHistoryPos++
  if(__commandHistoryPos === __commandHistory.length){ commandInput.value=''; __commandHistoryPos = -1 }
  else { commandInput.value = __commandHistory[__commandHistoryPos] }
}

// Command input Enter handled inside commandHandler; Escape clears filter there.
// Input field Enter handled inside inputHandler (remain in input mode) .

// Mode key handlers
const viewHandler = (e)=>{
  if(modalIsActive && modalIsActive()) return false
  window.__lastKey = e.key
  if(e.key === 'Enter'){ modeManager.set(MODES.INPUT); return true }
  if(e.key === 'Escape'){ modeManager.set(MODES.COMMAND); return true }
  // Primary navigation j/k; secondary ArrowDown/ArrowUp
  if(e.key === 'j' || e.key === 'ArrowDown'){ activeParts.next(); applyActivePart(); return true }
  if(e.key === 'k' || e.key === 'ArrowUp'){ activeParts.prev(); applyActivePart(); return true }
  if(e.key === 'g'){ activeParts.first(); applyActivePart(); return true }
  if(e.key === 'G'){ activeParts.last(); applyActivePart(); return true }
  if(e.key === 'R'){ cycleAnchorMode(); return true } // Shift+R cycles reading position
  if(e.key === 'O' && e.shiftKey){ jumpToBoundary(); return true }
  // 'n' previously jumped to new reply; now unused
  if(e.key === '*'){ cycleStar(); return true }
  if(e.key === 'a'){ toggleFlag(); return true }
  if(e.key === '1'){ setStarRating(1); return true }
  if(e.key === '2'){ setStarRating(2); return true }
  if(e.key === '3'){ setStarRating(3); return true }
  if(e.key === ' '){ setStarRating(0); return true }
}
const commandHandler = (e)=>{
  if(modalIsActive && modalIsActive()) return false
  // History navigation (Ctrl+P / Ctrl+N) akin to shell
  if(e.ctrlKey && (e.key === 'p' || e.key === 'P')){ historyPrev(); return true }
  if(e.ctrlKey && (e.key === 'n' || e.key === 'N')){ historyNext(); return true }
  if(e.key === 'Enter'){
    const q = commandInput.value.trim()
  // Debug toggles
  if(q === ':hud' || q === ':hud on'){ __hudEnabled = true; commandInput.value=''; commandErrEl.textContent=''; return true }
  if(q === ':hud off'){ __hudEnabled = false; commandInput.value=''; commandErrEl.textContent=''; return true }
  if(q === ':maskdebug' || q === ':maskdebug on'){ __maskDebug = true; commandInput.value=''; commandErrEl.textContent=''; applySpacingStyles(getSettings()); updateFadeVisibility(); return true }
  if(q === ':maskdebug off'){ __maskDebug = false; commandInput.value=''; commandErrEl.textContent=''; applySpacingStyles(getSettings()); updateFadeVisibility(); return true }
  if(q === ':anim off' || q === ':noanim' || q === ':noanim on') { scrollController.setAnimationEnabled(false); console.log('Scroll animation disabled'); commandInput.value=''; commandErrEl.textContent=''; return true }
  if(q === ':anim on' || q === ':noanim off') { scrollController.setAnimationEnabled(true); console.log('Scroll animation enabled'); commandInput.value=''; commandErrEl.textContent=''; return true }
  if(q === ':scrolllog on'){ window.__scrollLog = true; console.log('Scroll log ON'); commandInput.value=''; commandErrEl.textContent=''; return true }
  if(q === ':scrolllog off'){ window.__scrollLog = false; console.log('Scroll log OFF'); commandInput.value=''; commandErrEl.textContent=''; return true }
  updateFadeVisibility()
    const prevFilter = __lastAppliedFilter
    const prevActiveId = __commandModeEntryActivePartId || (activeParts.active() && activeParts.active().id)
    lifecycle.setFilterQuery(q)
    if(!q){
      if(prevFilter === '' ){ // clearing (or unchanged empty)
        if(prevFilter === '' && prevActiveId){
          // Filter unchanged (empty) -> keep selection
          if(__lastAppliedFilter === '' && __lastAppliedFilter === q){
            commandErrEl.textContent=''
            modeManager.set(MODES.VIEW)
            // Restore active part (no re-render needed)
            activeParts.setActiveById(prevActiveId); applyActivePart()
            return true
          }
        }
      }
      // Filter changed from something to empty OR no previous active stored
      commandErrEl.textContent=''
      renderCurrentView()
      activeParts.last(); applyActivePart()
      __lastAppliedFilter = ''
      pushCommandHistory(q)
      __commandHistoryPos = -1
      modeManager.set(MODES.VIEW)
      return true
    }
    try {
  const ast = parse(q)
  const basePairs = store.getAllPairs().slice().sort((a,b)=> a.createdAt - b.createdAt)
  const res = evaluate(ast, basePairs)
      const changed = q !== prevFilter
      lifecycle.setFilterQuery(q)
      renderHistory(res) // direct since we already have filtered list
      commandErrEl.textContent=''
      modeManager.set(MODES.VIEW)
      if(!changed && prevActiveId){
        // restore previous selection after re-render
        activeParts.setActiveById(prevActiveId); applyActivePart()
      }
      if(changed){ __lastAppliedFilter = q; pushCommandHistory(q); __commandHistoryPos = -1 }
    } catch(ex){ commandErrEl.textContent = ex.message }
    return true
  }
  if(e.key === 'Escape'){
    // Clear filter but remain in command mode
    if(commandInput.value){ commandInput.value=''; lifecycle.setFilterQuery(''); __lastAppliedFilter=''; renderCurrentView(); activeParts.last(); applyActivePart(); commandErrEl.textContent='' }
    return true
  }
}
const inputHandler = (e)=>{
  if(modalIsActive && modalIsActive()) return false
  if(e.key === 'Enter'){
    const text = inputField.value.trim()
    if(text){
  const editingId = window.__editingPairId
  const topicId = pendingMessageMeta.topicId || currentTopicId
  const model = pendingMessageMeta.model || 'gpt'
  if(lifecycle.isPending()) return true
      // Recompute boundary with actual user text (may drop additional pairs if larger than allowance)
      const settings = getSettings()
  // Snapshot boundary before send (for trim diff logging)
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
    __lastTrimmedCount = 0
    ;(async()=>{
        try {
          // Use currently visible (filtered) chronological list for context WYSIWYG
          const currentPairs = activeParts.parts.map(pt=> store.pairs.get(pt.pairId)).filter(Boolean)
          const chrono = [...new Set(currentPairs)].sort((a,b)=> a.createdAt - b.createdAt)
          // Ensure boundary manager up-to-date with current filtered visible chronological list
          boundaryMgr.updateVisiblePairs(chrono)
          boundaryMgr.setModel(model)
          boundaryMgr.applySettings(getSettings())
          const boundarySnapshot = boundaryMgr.getBoundary()
          const { content } = await executeSend({ store, model, userText: text, signal: undefined, visiblePairs: chrono, boundarySnapshot, onDebugPayload: (payload)=>{ __lastSentRequest = payload; historyRuntime.setSendDebug(payload.predictedMessageCount, payload.trimmedCount); renderRequestDebug(); historyRuntime.updateMessageCount(historyRuntime.getPredictedCount(), chrono.length) } })
          store.updatePair(id, { assistantText: content, lifecycleState:'complete', errorMessage:undefined })
          lifecycle.completeSend(); updateSendDisabled()
          renderCurrentView({ preserveActive:true })
          lifecycle.handleNewAssistantReply(id)
        } catch(ex){
          let errMsg = (ex && ex.message) ? ex.message : 'error'
          if(errMsg === 'missing_api_key' || errMsg === 'api_key_auth_failed'){
            const hasKey = !!getApiKey('openai')
            if(errMsg === 'missing_api_key') {
              errMsg = 'OpenAI key missing (Ctrl+.)'
            } else if(errMsg === 'api_key_auth_failed') {
              errMsg = 'OpenAI key rejected (Ctrl+.)'
            }
            // Auto-open keys overlay (debounced to next frame so pair renders error state first)
            requestAnimationFrame(()=>{
              openApiKeysOverlay({ onClose: ()=>{ /* after overlay close we could retry if still editing */ } })
            })
          }
          store.updatePair(id, { assistantText: '', lifecycleState:'error', errorMessage: errMsg })
          lifecycle.completeSend(); updateSendDisabled()
          renderCurrentView({ preserveActive:true })
          // no new reply badge on error
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
  renderCurrentView({ preserveActive:true })
      activeParts.last(); applyActivePart()
  updateSendDisabled()
    }
    return true // remain in input mode
  }
  if(e.key === 'Escape'){ modeManager.set(MODES.VIEW); return true }
}
modeManager.onChange((m)=>{
  renderStatus()
  if(m === MODES.VIEW){ commandInput.blur(); inputField.blur() }
  else if(m === MODES.INPUT){ inputField.focus() }
  else if(m === MODES.COMMAND){
    // entering command mode
    __commandModeEntryActivePartId = activeParts.active() ? activeParts.active().id : null
    commandInput.focus()
  }
})

// Removed gg sequence; single 'g' now handled in viewHandler.

function cycleStar(){
  const act = activeParts.active(); if(!act) return
  const pair = store.pairs.get(act.pairId); if(!pair) return
  store.updatePair(pair.id, { star: (pair.star+1)%4 })
  renderCurrentView({ preserveActive:true })
}
function setStarRating(star){
  const act = activeParts.active(); if(!act) return
  const pair = store.pairs.get(act.pairId); if(!pair) return
  if(pair.star === star) return
  store.updatePair(pair.id, { star })
  renderCurrentView({ preserveActive:true })
}
function toggleFlag(){
  const act = activeParts.active(); if(!act) return
  const pair = store.pairs.get(act.pairId); if(!pair) return
  const next = pair.colorFlag === 'b' ? 'g' : 'b'
  store.updatePair(pair.id, { colorFlag: next })
  renderCurrentView({ preserveActive:true })
}

const keyRouter = createKeyRouter({ modeManager, handlers:{ view:viewHandler, command:commandHandler, input:inputHandler } })
keyRouter.attach()

// Debug
window.__modeManager = modeManager
window.__keyRouter = keyRouter
window.__store = store
window.__setActiveIndex = function(i){ activeParts.activeIndex = i; applyActivePart() }

// Click activation
document.addEventListener('click', e=>{
  const el = e.target.closest('.part'); if(!el) return
  activeParts.setActiveById(el.getAttribute('data-part-id'))
  applyActivePart()
})

// Ctrl-based direct mode activation
window.addEventListener('keydown', e=>{
  if(!e.ctrlKey) return
  const k = e.key.toLowerCase()
  if(modalIsActive && modalIsActive()) return
  if(k==='i'){ e.preventDefault(); modeManager.set(MODES.INPUT) }
  else if(k==='d'){ e.preventDefault(); modeManager.set(MODES.COMMAND) }
  else if(k==='v'){ e.preventDefault(); modeManager.set(MODES.VIEW) }
  else if(k==='t'){ if(!document.getElementById('appLoading')){ e.preventDefault(); const prevMode = modeManager.mode; openQuickTopicPicker({ prevMode }) } }
  else if(k==='e'){ if(!document.getElementById('appLoading')){ e.preventDefault(); const prevMode = modeManager.mode; openTopicEditor({ store, onClose:()=>{ modeManager.set(prevMode) } }) } }
  else if(k==='m'){
    // Selector only in INPUT; editor (shift) allowed always
    if(e.shiftKey){
      e.preventDefault();
      const prevMode = modeManager.mode
  openModelEditor({ onClose: ()=>{ pendingMessageMeta.model = getActiveModel(); renderPendingMeta(); renderCurrentView({ preserveActive:true }); modeManager.set(prevMode) } })
    } else {
      if(modeManager.mode !== MODES.INPUT) return
      e.preventDefault();
      const prevMode = modeManager.mode
  openModelSelector({ onClose: ()=>{ pendingMessageMeta.model = getActiveModel(); renderPendingMeta(); renderCurrentView({ preserveActive:true }); modeManager.set(prevMode) } })
    }
  }
  else if(k==='k'){
    // Ctrl+K opens API Keys overlay (any mode)
    e.preventDefault();
    const prevMode = modeManager.mode
    openApiKeysOverlay({ modeManager, onClose: ()=>{ modeManager.set(prevMode) } })
  }
  else if(k===','){ e.preventDefault(); const prevMode = modeManager.mode; openSettingsOverlay({ onClose:()=>{ modeManager.set(prevMode) } }) }
  else if(e.key === '.' || e.code === 'Period'){ e.preventDefault(); toggleMenu(); }
  else if(e.shiftKey && k==='r'){ // Ctrl+Shift+R toggles request debug overlay
    e.preventDefault(); __requestDebugEnabled = !__requestDebugEnabled; renderRequestDebug();
  }
  // Developer shortcut: Ctrl+Shift+S to reseed long test messages
  if(e.shiftKey && k==='s'){ e.preventDefault(); window.seedTestMessages && window.seedTestMessages() }
})

window.addEventListener('keydown', e=>{ if(e.key==='F1'){ e.preventDefault(); openHelpOverlay({ modeManager, onClose:()=>{} }) } })

// Overlay selectors

function openQuickTopicPicker({ prevMode }){
  const openMode = prevMode || modeManager.mode
  createTopicPicker({
    store,
    modeManager,
    onSelect: (topicId)=>{
      // Use the mode at time of opening for semantics, not any interim change
      if(openMode === MODES.INPUT){
        pendingMessageMeta.topicId = topicId
        renderPendingMeta()
        try { localStorage.setItem('maichat_pending_topic', pendingMessageMeta.topicId) } catch{}
      } else if(openMode === MODES.VIEW){
        const act = activeParts.active(); if(act){
          const pair = store.pairs.get(act.pairId); if(pair){ store.updatePair(pair.id, { topicId }); renderCurrentView({ preserveActive:true }); activeParts.setActiveById(act.id); applyActivePart() }
        }
      }
      if(prevMode) modeManager.set(prevMode)
    },
    onCancel: ()=>{ if(prevMode) modeManager.set(prevMode) }
  })
}

// (Legacy overlay selection handlers removed; model selection/editor now separate modules.)

// HUD updater & shared timestamp formatting
function formatTimestamp(ts){
  const d = new Date(ts)
  const yy = String(d.getFullYear()).slice(-2)
  const dd = String(d.getDate()).padStart(2,'0')
  const mm = String(d.getMonth()+1).padStart(2,'0')
  const hh = String(d.getHours()).padStart(2,'0')
  const mi = String(d.getMinutes()).padStart(2,'0')
  const ss = String(d.getSeconds()).padStart(2,'0')
  // Order per request: yy-dd-mm hh:mm:ss (note day precedes month)
  return `${yy}-${dd}-${mm} ${hh}:${mi}:${ss}`
}
// HUD section collapse state
const __hudState = { layout:true, visibility:true, partition:true, meta:true }
if(!hudEl.__hudClickBound){
  hudEl.addEventListener('click', (e)=>{
    const target = e.target.closest('[data-hud-section-header]')
    if(!target) return
    const key = target.getAttribute('data-section')
    if(key && __hudState.hasOwnProperty(key)){ __hudState[key] = !__hudState[key] }
  })
  hudEl.__hudClickBound = true
}
function updateHud(){
  hudEl.style.display = __hudEnabled ? 'block' : 'none'
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
  // Collect numbered parameters following spec order
  let n=1
  const layoutParams = []
  // A. General
  // 1 Mode
  layoutParams.push(`${n++}. Mode: ${modeManager.mode}`)
  // 2 Reading position mode
  layoutParams.push(`${n++}. Reading position mode: ${dbg?dbg.mode:'?'}`)
  // Compute active/total parts
  const totalParts = activeParts.parts.length
  const activeIdx1 = dbg && dbg.activeIndex!=null ? (dbg.activeIndex+1) : (act? activeParts.parts.indexOf(act)+1 : 0)
  // 3 Active part / total parts
  layoutParams.push(`${n++}. Active part / total parts: ${activeIdx1}/${totalParts}`)
  // start_part_k (active)
  let start_part_k = '?'
  if(act){
    const el = document.querySelector(`[data-part-id="${act.id}"]`)
    if(el) start_part_k = el.offsetTop
  }
  // Total history length T
  const T = historyPaneEl ? historyPaneEl.scrollHeight : '?'
  // 4 Active part position / Total history length
  layoutParams.push(`${n++}. Active part position / Total history length: ${start_part_k}/${T}`)
  // Active part visual top inside pane: start_part_k - scrollTop
  if(start_part_k !== '?' && dbg){
    const S = dbg.scrollTop||0
    const vTop = (typeof start_part_k === 'number'? start_part_k : parseFloat(start_part_k)) - S
    layoutParams.push(`${n++}. Active part visual top (start_part_k - S): ${vTop}`)
  }
  // First visible part index and count of visible fully
  const firstVisibleIndex = dbg? dbg.currentFirst : '?'
  const visibleCount = dbg? dbg.shouldVisibleCount : '?'
  layoutParams.push(`${n++}. First visible part index / total visible parts: ${firstVisibleIndex}/${visibleCount}`)
  // start_part_k2 for first visible
  let start_part_k2 = '?'
  if(firstVisibleIndex != null && firstVisibleIndex !== '?' && firstVisibleIndex >=0){
    const el2 = document.querySelector(`[data-part-index="${firstVisibleIndex}"]`) || historyPaneEl.querySelectorAll('[data-part-id]')[firstVisibleIndex]
    if(el2) start_part_k2 = el2.offsetTop
  }
  layoutParams.push(`${n++}. First visible position / Total history length: ${start_part_k2}/${T}`)
  // scrollTop S
  const scrollVal = dbg? Math.round(dbg.scrollTop):0
  layoutParams.push(`${n++}. scrollTop: ${scrollVal}`)
  // H_total
  const H_total = historyPaneEl? historyPaneEl.clientHeight : '?'
  layoutParams.push(`${n++}. historyPane (H_total): ${H_total}`)
  // G outer gap (assume symmetric paddingTop)
  let Gval='?'; let H_usable='?'
  if(historyPaneEl){
    const csPane = getComputedStyle(historyPaneEl)
    const padTop = parseFloat(csPane.paddingTop)||0
    const padBottom = parseFloat(csPane.paddingBottom)||0
    Gval = padTop // spec single G value
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
    // B. Partitioning (continuing numbering)
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
  // Structured budgeting groups
  try {
    const settings = getSettings()
  const ctxStats = historyRuntime.getContextStats()
  const ura = (ctxStats && (('URA' in ctxStats)? ctxStats.URA : ctxStats.assumedUserTokens)) ?? settings.userRequestAllowance
    const cpt = settings.charsPerToken
    const nta = settings.maxTrimAttempts
  const ml = ctxStats ? ctxStats.maxContext : null
  const predictedHistoryTokens = (__lastSentRequest && typeof __lastSentRequest.predictedHistoryTokens==='number') ? __lastSentRequest.predictedHistoryTokens : (ctxStats ? ctxStats.totalIncludedTokens : null)
    // Count predicted messages
  const predictedMessages = historyRuntime.getPredictedCount()
    // Character count
    let predictedChars = 0
    const includedIds = historyRuntime.getIncludedIds()
    if(includedIds && includedIds.size){
      for(const p of __store.getAllPairs()){
        if(includedIds.has(p.id)) predictedChars += (p.userText?p.userText.length:0) + (p.assistantText?p.assistantText.length:0)
      }
    }
    const userTok = (__lastSentRequest && typeof __lastSentRequest.userTokens==='number') ? __lastSentRequest.userTokens : null
    const historyTokens = (__lastSentRequest && typeof __lastSentRequest.historyTokens==='number') ? __lastSentRequest.historyTokens : predictedHistoryTokens
    const initialAttemptTotal = (predictedHistoryTokens!=null && userTok!=null) ? (predictedHistoryTokens + userTok) : null
    const finalAttemptTotal = (historyTokens!=null && userTok!=null) ? (historyTokens + userTok) : null
  const trimmedTok = (predictedHistoryTokens!=null && historyTokens!=null) ? (predictedHistoryTokens - historyTokens) : 0
    const attempts = (__lastSentRequest && typeof __lastSentRequest.attemptsUsed==='number') ? __lastSentRequest.attemptsUsed : 0
    // PARAMETERS
    metaParams.push(`PARAMETERS: URA=${ura!=null?ura:'-'} CPT=${cpt!=null?cpt:'-'} NTA=${nta!=null?nta:'-'} ML=${ml!=null?ml:'-'}`)
    // PREDICTED HISTORY CONTEXT
    metaParams.push(`PREDICTED_HISTORY_CONTEXT: n_of_messages=${predictedMessages} n_of_characters=${predictedChars} n_of_tokens=${predictedHistoryTokens!=null?predictedHistoryTokens:'-'}`)
    // ACTUAL
  metaParams.push(`ACTUAL:`)
  metaParams.push(`  tokens_in_new_user_request=${userTok!=null?userTok:'-'}`)
  metaParams.push(`  tokens_in_initial_attempted_request=${initialAttemptTotal!=null?initialAttemptTotal:'-'}`)
  // TRIMMING
  metaParams.push(`TRIMMING:`)
  metaParams.push(`  N_of_attempts=${attempts}`)
  metaParams.push(`  N_of_tokens_trimmed=${trimmedTok}`)
  metaParams.push(`  tokens_in_final_attempted_request=${finalAttemptTotal!=null?finalAttemptTotal:'-'}`)
  } catch{}
  // Build HTML with sections
  function sectionHTML(key, title, arr){
    const open = __hudState[key]
    const indicator = open ? '-' : '+'
    const header = `<div data-hud-section-header data-section="${key}" style="cursor:pointer; font-weight:bold;">[${indicator}] ${title}</div>`
    if(!open) return header
    return header + `<pre style="margin:0; white-space:pre;">${arr.join('\n')}</pre>`
  }
  hudEl.innerHTML = [
    sectionHTML('layout','Layout', layoutParams),
  sectionHTML('visibility','Visibility', maskParams),
    sectionHTML('partition','Partition', partitionParams),
    sectionHTML('meta','Meta', metaParams),
    `<div class='pairInfo'>${pairInfo}</div>`
  ].join('\n')
  requestAnimationFrame(updateHud)
}
requestAnimationFrame(updateHud)

// ---------- Message Counter ----------
// updateMessageCount now from historyRuntime

// applyOutOfContextStyling now from historyRuntime

// jumpToBoundary now from historyRuntime

// ---------- App Menu (Hamburger) ----------
const menuBtn = () => document.getElementById('appMenuBtn')
const menuEl = () => document.getElementById('appMenu')
let __menuTrap = null
let __menuKeyHandlerBound = false
function toggleMenu(force){
  const btn = menuBtn(); const m = menuEl(); if(!btn || !m) return
  let show = force
  if(show == null) show = m.hasAttribute('hidden')
  if(show){
    m.removeAttribute('hidden')
    btn.setAttribute('aria-expanded','true')
  document.body.setAttribute('data-menu-open','1')
  // Clear any prior active states to avoid duplicates
    m.querySelectorAll('li.active').forEach(li=> li.classList.remove('active'))
    const first = m.querySelector('li'); if(first) first.classList.add('active')
    // Focus management: trap inside menu
    __menuTrap = createFocusTrap(m, ()=> first)
    // Attach capture key handler once (global) if not already
    if(!__menuKeyHandlerBound){
      window.addEventListener('keydown', menuGlobalKeyHandler, true)
      __menuKeyHandlerBound = true
    }
  } else {
  m.setAttribute('hidden','')
  document.body.removeAttribute('data-menu-open')
    btn.setAttribute('aria-expanded','false')
    if(__menuTrap){ __menuTrap.release(); __menuTrap = null }
  }
}
function menuGlobalKeyHandler(e){
  const m = menuEl(); if(!m || m.hasAttribute('hidden')) return
  // Hard stop for any key that could affect background navigation
  const navKeys = ['j','k','ArrowDown','ArrowUp','Enter','Escape']
  if(navKeys.includes(e.key)){
    e.preventDefault()
    e.stopImmediatePropagation()
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
  // click outside
  if(!btn.contains(e.target)) closeMenu()
})
// (Previous bubbling menu key handler removed – now unified in capture-phase menuGlobalKeyHandler.)

function renderPendingMeta(){
  const pm = document.getElementById('pendingModel')
  const pt = document.getElementById('pendingTopic')
  if(pm){
  pm.textContent = pendingMessageMeta.model || getActiveModel() || 'gpt-4o'
  if(!pm.textContent) pm.textContent = 'gpt-4o'
  }
  if(pt){
    const topic = store.topics.get(pendingMessageMeta.topicId || currentTopicId)
    if(topic){
      const path = formatTopicPath(topic.id)
      pt.textContent = middleTruncate(path, 90)
      pt.title = `Topic: ${path} (Ctrl+T pick, Ctrl+E edit)`
    } else {
      // Fallback to root topic name (mandatory display)
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
  if(pm){
  pm.title = `Model: ${pendingMessageMeta.model || getActiveModel() || 'gpt-4o'} (Ctrl+M select (Input mode) · Ctrl+Shift+M manage (any mode))`
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
      // Build fixed structure once
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
if(sendBtn){
  sendBtn.addEventListener('click', ()=>{
    if(modeManager.mode !== MODES.INPUT) modeManager.set(MODES.INPUT)
    const text = inputField.value.trim(); if(!text) return
    const topicId = pendingMessageMeta.topicId || currentTopicId
    const model = pendingMessageMeta.model || 'gpt'
  if(lifecycle.isPending()) return
  lifecycle.beginSend()
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
  const { content } = await executeSend({ store, model, userText: text, signal: undefined, visiblePairs: chrono, onDebugPayload: (payload)=>{ __lastSentRequest = payload; renderRequestDebug() } })
  store.updatePair(id, { assistantText: content, lifecycleState:'complete', errorMessage:undefined })
  lifecycle.completeSend(); updateSendDisabled()
    renderCurrentView({ preserveActive:true })
        lifecycle.handleNewAssistantReply(id)
      } catch(ex){
        let errMsg = (ex && ex.message) ? ex.message : 'error'
        if(errMsg === 'missing_api_key') errMsg = 'API key missing (Ctrl+.) -> API Keys'
        store.updatePair(id, { assistantText: '', lifecycleState:'error', errorMessage: errMsg })
  lifecycle.completeSend(); updateSendDisabled()
    renderCurrentView({ preserveActive:true })
      } finally {
        updateSendDisabled()
      }
    })()
  inputField.value=''; renderCurrentView({ preserveActive:true }); activeParts.last(); applyActivePart(); updateSendDisabled()
  })
  inputField.addEventListener('input', updateSendDisabled)
  renderPendingMeta(); updateSendDisabled()
}

// End main.js

// Seeding helpers now provided by demoSeeding.js
exposeSeedingHelpers(store, ()=> renderCurrentView(), activeParts, ()=> applyActivePart())

function cycleAnchorMode(){
  const settings = getSettings()
  const order = ['bottom','center','top']
  const idx = order.indexOf(settings.anchorMode || 'bottom')
  const next = order[(idx+1)%order.length]
  saveSettings({ anchorMode: next })
  // Re-apply current active part to reflect new positioning
  applyActivePart()
  console.log('Anchor mode ->', next)
}

// ---------- Word-count dataset generator ----------
// (Removed local buildWordCountDataset/baseLoremWords/generateWordCountDataset definitions – centralized in demoSeeding.js)
