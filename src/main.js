import './style.css'
import { createStore } from './store/memoryStore.js'
import { attachIndexes } from './store/indexes.js'
import { parse } from './filter/parser.js'
import { evaluate } from './filter/evaluator.js'
import { createModeManager, MODES } from './ui/modes.js'
import { createKeyRouter } from './ui/keyRouter.js'
import { buildParts, ActivePartController } from './ui/parts.js'
import { createHistoryView, bindHistoryErrorActions } from './ui/history/historyView.js'
import { createAnchorManager } from './ui/anchorManager.js'
import { createScrollController } from './ui/scrollControllerV3.js'
import { getSettings, subscribeSettings, saveSettings } from './settings/index.js'
import { invalidatePartitionCacheOnResize } from './partition/partitioner.js'
import { createIndexedDbAdapter } from './store/indexedDbAdapter.js'
import { attachContentPersistence } from './persistence/contentPersistence.js'
import { createTopicPicker } from './ui/topicPicker.js'
import { openTopicEditor } from './ui/topicEditor.js'
import { modalIsActive } from './ui/focusTrap.js'
import { escapeHtml } from './ui/util.js'
import { createNewMessageLifecycle } from './ui/newMessageLifecycle.js'
import { openSettingsOverlay } from './ui/settingsOverlay.js'
import { openApiKeysOverlay } from './ui/apiKeysOverlay.js'
import { openHelpOverlay } from './ui/helpOverlay.js'
import { gatherContext } from './context/gatherContext.js'
import { registerProvider } from './provider/adapter.js'
import { createOpenAIAdapter } from './provider/openaiAdapter.js'
import { executeSend } from './send/pipeline.js'
// Mask system removed; using fade-based visibility.

// Mode management
const modeManager = createModeManager()

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
          <li data-action="api-keys"><span class="label">API Keys</span></li>
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

// Initial layout pass
requestAnimationFrame(layoutHistoryPane)

// Dynamic layout sizing to avoid hidden first/last messages when bar heights change
function layoutHistoryPane(){
  const topBar = document.getElementById('topBar')
  const inputBar = document.getElementById('inputBar')
  const histPane = document.getElementById('historyPane')
  if(!topBar || !inputBar || !histPane) return
  // Outer gap now implemented as internal padding; pane spans bars directly
  const topH = topBar.getBoundingClientRect().height
  const botH = inputBar.getBoundingClientRect().height
  histPane.style.top = topH + 'px'
  histPane.style.bottom = botH + 'px'
}
window.addEventListener('resize', layoutHistoryPane)
// Partition resize threshold handling (≥10% viewport height change)
let __lastViewportH = window.innerHeight
window.addEventListener('resize', ()=>{
  const h = window.innerHeight
  if(!h || !__lastViewportH) { __lastViewportH = h; return }
  const delta = Math.abs(h - __lastViewportH) / __lastViewportH
  if(delta >= 0.10){
    __lastViewportH = h
    invalidatePartitionCacheOnResize()
    renderHistory(store.getAllPairs())
  }
})

// Debug HUD container
const hudEl = document.createElement('div')
hudEl.id = 'hud'
document.body.appendChild(hudEl)

// Store & persistence
const store = createStore()
attachIndexes(store)
const persistence = attachContentPersistence(store, createIndexedDbAdapter())
let currentTopicId = store.rootTopicId
const activeParts = new ActivePartController()
const historyPaneEl = document.getElementById('historyPane')
const anchorManager = null // legacy removed
const scrollController = createScrollController({ container: historyPaneEl })
// Expose for diagnostics
window.__scrollController = scrollController
const historyView = createHistoryView({ store, onActivePartRendered: ()=> applyActivePart() })
bindHistoryErrorActions(document.getElementById('history'), {
  onResend: (pairId)=>{
    const pair = store.pairs.get(pairId)
    if(!pair) return
    // Put text into input for editing
    inputField.value = pair.userText
    pendingMessageMeta.topicId = pair.topicId
    pendingMessageMeta.model = pair.model
    renderPendingMeta()
    pair.lifecycleState = 'editing'
    pair.errorMessage = undefined
    renderHistory(store.getAllPairs())
    modeManager.set(MODES.INPUT)
    inputField.focus()
    // Track editing target
    window.__editingPairId = pair.id
  },
  onDelete: (pairId)=>{
    store.removePair(pairId)
    renderHistory(store.getAllPairs())
    activeParts.last(); applyActivePart()
  }
})
// Preload settings (future partition logic will use them)
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
  applySpacingStyles(s); layoutHistoryPane(); renderHistory(store.getAllPairs()) 
})
let overlay = null // { type: 'topic'|'model', list:[], activeIndex:0 }
let pendingMessageMeta = { topicId: null, model: 'gpt' }
// New message lifecycle module
const lifecycle = createNewMessageLifecycle({
  store,
  activeParts,
  commandInput: null, // assigned after element retrieval
  renderHistory: (pairs)=> renderHistory(pairs),
  applyActivePart: ()=> applyActivePart()
})

function renderTopics(){ /* hidden for now */ }

let __lastContextStats = null
let __lastContextIncludedIds = new Set()
function renderHistory(pairs){
  pairs = [...pairs].sort((a,b)=> a.createdAt - b.createdAt)
  const settings = getSettings()
  const ctx = gatherContext(pairs, { charsPerToken: 4, pendingUserText: undefined })
  __lastContextStats = ctx.stats
  __lastContextIncludedIds = new Set(ctx.included.map(p=>p.id))
  const parts = buildParts(pairs)
  activeParts.setParts(parts)
  historyView.render(parts)
  applyOutOfContextStyling()
  updateMessageCount(ctx.included.length, pairs.length)
  requestAnimationFrame(()=>{ scrollController.remeasure(); applyActivePart() })
  lifecycle.updateNewReplyBadgeVisibility()
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

// ---------- Spacing Runtime Styles & Debug Toggles ----------
let __hudEnabled = false
let __maskDebug = true // reserved for future debug gradients
function applySpacingStyles(settings){
  if(!settings) return
  const { partPadding=4, gapOuterPx=6, gapMetaPx=6, gapIntraPx=6, gapBetweenPx=10, fadeInMs=120, fadeOutMs=120, fadeTransitionMs=120 } = settings
  // Use max of in/out for baseline CSS transition; per-change override applied inline based on direction.
  const baseFadeMs = Math.max(fadeInMs||0, fadeOutMs||0, fadeTransitionMs||0)
  let styleEl = document.getElementById('runtimeSpacing')
  if(!styleEl){ styleEl = document.createElement('style'); styleEl.id='runtimeSpacing'; document.head.appendChild(styleEl) }
  styleEl.textContent = `#historyPane{padding-top:${gapOuterPx}px; padding-bottom:${gapOuterPx}px;}
  .history{gap:0;}
  /* Gaps now explicit elements */
  .gap{width:100%; flex:none;}
  .gap-between{height:${gapBetweenPx}px;}
  .gap-meta{height:${gapMetaPx}px;}
  .gap-intra{height:${gapIntraPx}px;}
  /* Base part reset */
  .part{margin:0;box-shadow:none;background:transparent;opacity:1;transition:opacity ${baseFadeMs}ms linear;}
  /* Uniform padding only for user/assistant; meta intentionally minimal */
  .part.user .part-inner, .part.assistant .part-inner{padding:${partPadding}px;}
  /* Meta part horizontally aligns its content with text padding of user/assistant parts */
  .part.meta .part-inner{padding:0 ${partPadding}px; display:flex; flex-direction:row; align-items:center; gap:12px; min-height:1.6em; width:100%; box-sizing:border-box;}
  .part.meta .badge.model{color:#aaa;}
  .part.meta{white-space:nowrap;}
  .part.meta .meta-left{display:flex; gap:10px; align-items:center; white-space:nowrap;}
  .part.meta .meta-right{display:flex; gap:10px; align-items:center; margin-left:auto; white-space:nowrap;}
  /* Prevent wrapping inside badges */
  .part.meta .badge{white-space:nowrap;}
  /* Backgrounds */
  .part.user .part-inner{background:#0d2233; border-radius:3px; position:relative;}
  .part.assistant .part-inner{background:transparent;}
  .part.meta .part-inner{background:transparent; position:relative;}
  .part.assistant .part-inner, .part.meta .part-inner{position:relative;}
  /* Active state: inset highlight border (1px) to avoid occasional top-line clipping due to scroll alignment / container inset shadow */
  .part.active .part-inner::after{content:''; position:absolute; top:1px; left:1px; right:1px; bottom:1px; border:1px solid var(--focus-ring); border-radius:3px; pointer-events:none;}
  .part.active.assistant .part-inner{background:rgba(40,80,120,0.10);} 
  .part.active{box-shadow:none; background:transparent;}`
}

// Show/hide top mask based on anchor mode (only in 'top'). Keeps layout gap structural via padding while visually hiding any preceding slice.
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
    } else { // binary
  // Part intrudes if ANY portion overlaps top gap (relTop < fadeZone) or bottom gap (H - relBottom < fadeZone)
  const topIntrudes = relTop < fadeZone
  const bottomIntrudes = (H - relBottom) < fadeZone
  if(topIntrudes || bottomIntrudes) op = hiddenOp
    }
    if(isActive) op = 1 // active always fully visible
    const prev = p.__lastOpacity != null ? p.__lastOpacity : parseFloat(p.style.opacity||'1')
    if(prev !== op){
      // Directional transition control
      const dirIn = op > prev
      const dur = dirIn ? fadeInMs : fadeOutMs
      // Only set if different to avoid layout thrash
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

historyPaneEl.addEventListener('scroll', ()=>{ updateFadeVisibility() })

// escapeHtml centralized in ui/util.js

function renderStatus(){ const modeEl = document.getElementById('modeIndicator'); if(modeEl) modeEl.textContent = `[${modeManager.mode.toUpperCase()}]` }


async function bootstrap(){
  // Register providers
  registerProvider('openai', createOpenAIAdapter())
  await persistence.init()
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
    seedDemoPairs()
  }
  renderHistory(store.getAllPairs())
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
  if(e.key === 'G'){
    // If there's a new reply badge (any state), treat Shift+G as jump to LAST part of newest reply; else normal last part navigation
    const badgeState = lifecycle.getBadgeState()
    if(badgeState.visible){
      const jumped = lifecycle.jumpToNewReply('last')
      if(jumped) return true
    }
  activeParts.last(); applyActivePart(); return true
  }
  if(e.key === 'R'){ cycleAnchorMode(); return true } // Shift+R cycles reading position
  if(e.key === 'O' && e.shiftKey){ jumpToBoundary(); return true }
  if(e.key === 'n'){ lifecycle.jumpToNewReply('first'); return true }
  if(e.key === '*'){ cycleStar(); return true }
  if(e.key === 'a'){ toggleFlag(); return true }
  if(e.key === '1'){ setStarRating(1); return true }
  if(e.key === '2'){ setStarRating(2); return true }
  if(e.key === '3'){ setStarRating(3); return true }
  if(e.key === ' '){ setStarRating(0); return true }
}
const commandHandler = (e)=>{
  if(modalIsActive && modalIsActive()) return false
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
  lifecycle.setFilterQuery(q)
    if(!q){ commandErrEl.textContent=''; renderHistory(store.getAllPairs()); activeParts.last(); applyActivePart(); modeManager.set(MODES.VIEW); return true }
    try {
      const ast = parse(q)
      const res = evaluate(ast, store.getAllPairs())
      renderHistory(res)
      commandErrEl.textContent=''
      modeManager.set(MODES.VIEW)
    } catch(ex){ commandErrEl.textContent = ex.message }
    return true
  }
  if(e.key === 'Escape'){
    // Clear filter but remain in command mode
    if(commandInput.value){ commandInput.value=''; renderHistory(store.getAllPairs()); activeParts.last(); applyActivePart(); commandErrEl.textContent='' }
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
      const preCtx = gatherContext(store.getAllPairs().sort((a,b)=>a.createdAt-b.createdAt), { charsPerToken:4 })
      const beforeIncludedIds = new Set(preCtx.included.map(p=>p.id))
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
          const { content } = await executeSend({ store, model, userText: text, signal: undefined })
          store.updatePair(id, { assistantText: content, lifecycleState:'complete', errorMessage:undefined })
          lifecycle.completeSend()
          renderHistory(store.getAllPairs())
          lifecycle.handleNewAssistantReply(id)
        } catch(ex){
          let errMsg = (ex && ex.message) ? ex.message : 'error'
          if(errMsg === 'missing_api_key') errMsg = 'API key missing (Ctrl+.) -> API Keys'
          store.updatePair(id, { assistantText: '', lifecycleState:'error', errorMessage: errMsg })
          lifecycle.completeSend()
          renderHistory(store.getAllPairs())
          // no new reply badge on error
        } finally {
          if(getSettings().showTrimNotice){
            const postCtx = gatherContext(store.getAllPairs().sort((a,b)=>a.createdAt-b.createdAt), { charsPerToken:4 })
            const afterIncludedIds = new Set(postCtx.included.map(p=>p.id))
            let trimmed=0
            beforeIncludedIds.forEach(pid=>{ if(!afterIncludedIds.has(pid)) trimmed++ })
            if(trimmed>0){ console.log(`[context] large prompt trimmed ${trimmed} older pair(s)`) }
          }
        }
      })()
      inputField.value=''
      renderHistory(store.getAllPairs())
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
  else if(m === MODES.COMMAND){ commandInput.focus() }
})

// Removed gg sequence; single 'g' now handled in viewHandler.

function cycleStar(){
  const act = activeParts.active(); if(!act) return
  const pair = store.pairs.get(act.pairId); if(!pair) return
  store.updatePair(pair.id, { star: (pair.star+1)%4 })
  renderHistory(store.getAllPairs())
}
function setStarRating(star){
  const act = activeParts.active(); if(!act) return
  const pair = store.pairs.get(act.pairId); if(!pair) return
  if(pair.star === star) return
  store.updatePair(pair.id, { star })
  renderHistory(store.getAllPairs())
}
function toggleFlag(){
  const act = activeParts.active(); if(!act) return
  const pair = store.pairs.get(act.pairId); if(!pair) return
  const next = pair.colorFlag === 'b' ? 'g' : 'b'
  store.updatePair(pair.id, { colorFlag: next })
  renderHistory(store.getAllPairs())
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
  else if(k==='t'){ if(!document.getElementById('appLoading')){ e.preventDefault(); openQuickTopicPicker() } }
  else if(k==='e'){ if(!document.getElementById('appLoading')){ e.preventDefault(); openTopicEditorOverlay() } }
  else if(k==='m'){ if(modeManager.mode===MODES.INPUT){ e.preventDefault(); openSelector('model') } }
  else if(k===','){ e.preventDefault(); openSettingsOverlay({ onClose:()=>{} }) }
  else if(k==='.' ){ e.preventDefault(); toggleMenu(); }
  // Developer shortcut: Ctrl+Shift+S to reseed long test messages
  if(e.shiftKey && k==='s'){ e.preventDefault(); window.seedTestMessages && window.seedTestMessages() }
})

window.addEventListener('keydown', e=>{ if(e.key==='F1'){ e.preventDefault(); openHelpOverlay({ onClose:()=>{} }) } })

// Overlay selectors
function openSelector(type){
  if(overlay){ closeSelector(); }
  const list = type==='topic' ? store.getAllTopics() : getModelList()
  overlay = { type, list, activeIndex: 0 }
  renderOverlay()
}

function openQuickTopicPicker(){
  // selection context differs by mode
  createTopicPicker({
    store,
    onSelect: (topicId)=>{
      if(modeManager.mode === MODES.INPUT){
        pendingMessageMeta.topicId = topicId
        renderPendingMeta()
  try { localStorage.setItem('maichat_pending_topic', pendingMessageMeta.topicId) } catch{}
      } else if(modeManager.mode === MODES.VIEW){
        const act = activeParts.active(); if(act){
          const pair = store.pairs.get(act.pairId); if(pair){ store.updatePair(pair.id, { topicId }); renderHistory(store.getAllPairs()); activeParts.setActiveById(act.id); applyActivePart() }
        }
      }
    },
    onCancel: ()=>{}
  })
}

function openTopicEditorOverlay(){
  openTopicEditor({
    store,
    onSelect: (topicId)=>{
      // Treat selecting in editor same as quick picker selection context
      if(modeManager.mode === MODES.INPUT){
        pendingMessageMeta.topicId = topicId
        renderPendingMeta()
  try { localStorage.setItem('maichat_pending_topic', pendingMessageMeta.topicId) } catch{}
      } else if(modeManager.mode === MODES.VIEW){
        const act = activeParts.active(); if(act){
          const pair = store.pairs.get(act.pairId); if(pair){ store.updatePair(pair.id, { topicId }); renderHistory(store.getAllPairs()); activeParts.setActiveById(act.id); applyActivePart() }
        }
      }
    },
    onClose: ()=>{}
  })
}
function closeSelector(){
  if(!overlay) return
  const el = document.getElementById('overlayRoot')
  if(el) el.remove()
  overlay = null
}
function getModelList(){
  // Placeholder static list; later can load dynamically / config
  return [ { id:'gpt', name:'gpt' }, { id:'claude', name:'claude' }, { id:'mixtral', name:'mixtral' } ]
}
function renderOverlay(){
  if(!overlay) return
  const root = document.createElement('div')
  root.id = 'overlayRoot'
  root.className = 'overlay-backdrop'
  const listItems = overlay.list.map((item,i)=>{
    const id = item.id || item.topicId || item.id
    const label = item.name || item.model || item.id || item
    const active = i===overlay.activeIndex ? ' class="active"' : ''
    return `<li data-index="${i}"${active}>${escapeHtml(label)}</li>`
  }).join('')
  root.innerHTML = `<div class="overlay-panel" data-type="${overlay.type}">
    <header>${overlay.type === 'topic' ? 'Select Topic' : 'Select Model'}</header>
    <div class="list"><ul>${listItems}</ul></div>
    <footer><span style="flex:1;opacity:.6">Enter=accept  Esc=cancel  j/k=move</span></footer>
  </div>`
  document.body.appendChild(root)
}
function applyOverlaySelection(){
  if(!overlay) return
  const item = overlay.list[overlay.activeIndex]
  if(overlay.type==='topic'){
    if(modeManager.mode === MODES.VIEW){ // update active pair topic
      const act = activeParts.active(); if(act){
        const pair = store.pairs.get(act.pairId); if(pair){ store.updatePair(pair.id, { topicId: item.id }); renderHistory(store.getAllPairs()); activeParts.setActiveById(act.id); applyActivePart() }
      }
      currentTopicId = item.id
    } else if(modeManager.mode === MODES.INPUT){
      pendingMessageMeta.topicId = item.id
      renderPendingMeta()
    }
  } else if(overlay.type==='model'){
    pendingMessageMeta.model = item.id
    renderPendingMeta()
  }
  closeSelector()
}

window.addEventListener('keydown', e=>{
  if(!overlay) return
  if(e.key === 'Escape'){ e.preventDefault(); closeSelector(); return }
  if(e.key === 'Enter'){ e.preventDefault(); applyOverlaySelection(); return }
  if(e.key === 'j' || e.key === 'ArrowDown'){ e.preventDefault(); overlay.activeIndex = Math.min(overlay.list.length-1, overlay.activeIndex+1); refreshOverlaySelection(); }
  if(e.key === 'k' || e.key === 'ArrowUp'){ e.preventDefault(); overlay.activeIndex = Math.max(0, overlay.activeIndex-1); refreshOverlaySelection(); }
})
function refreshOverlaySelection(){
  if(!overlay) return
  const root = document.getElementById('overlayRoot'); if(!root) return
  root.querySelectorAll('li').forEach(li=>{
    const idx = Number(li.getAttribute('data-index'))
    li.classList.toggle('active', idx===overlay.activeIndex)
  })
}

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
  // D. Meta
  metaParams.push(`${n++}. focus: ${focusDesc}`)
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
function updateMessageCount(included, visible){
  const el = document.getElementById('messageCount')
  if(!el) return
  el.textContent = `${included}/${visible}`
  if(__lastContextStats){
    const allowance = getSettings().assumedUserTokens
    el.title = `Included (with reserved allowance) / Visible. Included tokens: ${__lastContextStats.totalIncludedTokens} / usable after allowance ${__lastContextStats.maxUsable}. Allowance reserved.`
  } else {
    el.title = 'Included/Visible pairs'
  }
}

function applyOutOfContextStyling(){
  const partEls = document.querySelectorAll('#history .part')
  partEls.forEach(el=>{
    const partId = el.getAttribute('data-part-id')
    if(!partId) return
    const partObj = activeParts.parts.find(p=> p.id === partId)
    if(!partObj) return
    const included = __lastContextIncludedIds.has(partObj.pairId)
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
  if(!__lastContextIncludedIds || __lastContextIncludedIds.size === 0) return
  const idx = activeParts.parts.findIndex(pt=> __lastContextIncludedIds.has(pt.pairId))
  if(idx >= 0){ activeParts.activeIndex = idx; applyActivePart() }
}

// ---------- App Menu (Hamburger) ----------
const menuBtn = () => document.getElementById('appMenuBtn')
const menuEl = () => document.getElementById('appMenu')
function toggleMenu(force){
  const btn = menuBtn(); const m = menuEl(); if(!btn || !m) return
  let show = force
  if(show == null) show = m.hasAttribute('hidden')
  if(show){
    m.removeAttribute('hidden')
    btn.setAttribute('aria-expanded','true')
    // focus first item
    const first = m.querySelector('li'); if(first) first.classList.add('active')
  } else {
    m.setAttribute('hidden','')
    btn.setAttribute('aria-expanded','false')
  }
}
function closeMenu(){ toggleMenu(false) }
function activateMenuItem(li){ if(!li) return; const act = li.getAttribute('data-action'); closeMenu(); runMenuAction(act) }
function runMenuAction(action){
  if(action === 'topic-editor'){ openTopicEditorOverlay() }
  else if(action === 'settings'){ openSettingsOverlay({ onClose:()=>{} }) }
  else if(action === 'api-keys'){ openApiKeysOverlay({ onClose:()=>{} }) }
  else if(action === 'help'){ openHelpOverlay({ onClose:()=>{} }) }
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
window.addEventListener('keydown', e=>{
  const m = menuEl(); if(!m) return
  if(e.ctrlKey && e.key === '.') { e.preventDefault(); toggleMenu(); return }
  if(m.hasAttribute('hidden')) return
  if(e.key === 'Escape'){ closeMenu(); return }
  const items = Array.from(m.querySelectorAll('li'))
  let idx = items.findIndex(li=> li.classList.contains('active'))
  if(e.key === 'j' || e.key === 'ArrowDown'){ e.preventDefault(); idx = (idx+1+items.length)%items.length; items.forEach(li=>li.classList.remove('active')); items[idx].classList.add('active'); return }
  if(e.key === 'k' || e.key === 'ArrowUp'){ e.preventDefault(); idx = (idx-1+items.length)%items.length; items.forEach(li=>li.classList.remove('active')); items[idx].classList.add('active'); return }
  if(e.key === 'Enter'){ e.preventDefault(); activateMenuItem(items[idx] || items[0]); return }
})

function renderPendingMeta(){
  const pm = document.getElementById('pendingModel')
  const pt = document.getElementById('pendingTopic')
  if(pm){
    pm.textContent = pendingMessageMeta.model || 'gpt'
    if(!pm.textContent) pm.textContent = 'gpt'
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
    pm.title = `Model: ${pendingMessageMeta.model || 'gpt'} (Ctrl+M change)`
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
  const zeroIncluded = (__lastContextStats && __lastContextStats.includedCount === 0)
  sendBtn.disabled = empty || lifecycle.isPending() || zeroIncluded
  if(lifecycle.isPending()){
    sendBtn.textContent = 'AI is thinking'
  } else {
    sendBtn.textContent = 'Send'
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
        const { content } = await executeSend({ store, model, userText: text, signal: undefined })
        store.updatePair(id, { assistantText: content, lifecycleState:'complete', errorMessage:undefined })
        lifecycle.completeSend()
        renderHistory(store.getAllPairs())
        lifecycle.handleNewAssistantReply(id)
      } catch(ex){
        let errMsg = (ex && ex.message) ? ex.message : 'error'
        if(errMsg === 'missing_api_key') errMsg = 'API key missing (Ctrl+.) -> API Keys'
        store.updatePair(id, { assistantText: '', lifecycleState:'error', errorMessage: errMsg })
        lifecycle.completeSend()
        renderHistory(store.getAllPairs())
      } finally {
        updateSendDisabled()
      }
    })()
  inputField.value=''; renderHistory(store.getAllPairs()); activeParts.last(); applyActivePart(); updateSendDisabled()
  })
  inputField.addEventListener('input', updateSendDisabled)
  renderPendingMeta(); updateSendDisabled()
}

// End main.js

// ---------------- Demo Seeding Utilities (testing partitioning) ----------------
function seedDemoPairs(){
  const topicId = store.rootTopicId
  const data = buildWordCountDataset()
  const starCycle = [0,1,2,3]
  data.forEach((d,i)=>{
    const id = store.addMessagePair({ topicId, model:d.model, userText:d.user, assistantText:d.assistant })
    const pair = store.pairs.get(id)
    pair.star = starCycle[i % starCycle.length]
  if(i===2) pair.colorFlag = 'g' // one grey example
  })
}
window.seedTestMessages = function(){
  // Clear existing pairs then reseed
  store.pairs.clear()
  seedDemoPairs()
  renderHistory(store.getAllPairs())
  activeParts.first(); applyActivePart()
  console.log('Test messages reseeded.')
}

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
function buildWordCountDataset(){
  const sizes = []
  for(let w=100; w<=1000; w+=50){ sizes.push(w) }
  const loremWords = baseLoremWords()
  function makeText(wordCount){
    const words = []
    while(words.length < wordCount){
      words.push(loremWords[words.length % loremWords.length])
    }
    const textBody = words.join(' ')
    const chars = textBody.length
    return `[${wordCount} words | ${chars} chars]\n` + textBody
  }
  const dataset = []
  sizes.forEach(sz=>{
    for(let i=0;i<2;i++){
      dataset.push({ model: (sz%2?'gpt':'claude'), user: makeText(sz), assistant: makeText(sz) })
    }
  })
  return dataset
}
function baseLoremWords(){
  return `lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum professional workflow architecture partition anchor context management hierarchical topics adaptive strict token estimation performance optimization deterministic stable id navigation focus management experimental feature toggle granular measurement responsive viewport fraction test dataset generation`.split(/\s+/)
}
window.generateWordCountDataset = function(){
  console.time('generateWordCountDataset')
  const topicId = store.rootTopicId
  store.pairs.clear()
  const data = buildWordCountDataset()
  data.forEach(d=> store.addMessagePair({ topicId, model:d.model, userText:d.user, assistantText:d.assistant }))
  renderHistory(store.getAllPairs())
  activeParts.first(); applyActivePart()
  console.timeEnd('generateWordCountDataset')
  console.log('Generated', data.length, 'pairs for sizes 100..1000 (x2 each).')
}
