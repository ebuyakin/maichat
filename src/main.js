import './style.css'
import { createStore } from './store/memoryStore.js'
import { attachIndexes } from './store/indexes.js'
import { parse } from './filter/parser.js'
import { evaluate } from './filter/evaluator.js'
import { createModeManager, MODES } from './ui/modes.js'
import { createKeyRouter } from './ui/keyRouter.js'
import { buildParts, ActivePartController } from './ui/parts.js'
import { createHistoryView } from './ui/history/historyView.js'
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

// Mode management
const modeManager = createModeManager()

// Root layout
const appEl = document.querySelector('#app')
appEl.innerHTML = `
  <div id="topBar" class="zone">
    <div id="commandWrapper">
      <input id="commandInput" placeholder=": command / filter" autocomplete="off" />
    </div>
    <div id="statusRight"><span id="commandError"></span></div>
  </div>
  <div id="historyPane" class="zone">
  <div id="historyTopMask" aria-hidden="true"></div>
  <div id="history" class="history"></div>
  <div id="historyBottomMask" aria-hidden="true"></div>
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
const historyView = createHistoryView({ store, onActivePartRendered: ()=> applyActivePart() })
// Preload settings (future partition logic will use them)
getSettings()
subscribeSettings((s)=>{ applySpacingStyles(s); layoutHistoryPane(); renderHistory(store.getAllPairs()) })
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

function renderHistory(pairs){
  pairs = [...pairs].sort((a,b)=> a.createdAt - b.createdAt)
  const parts = buildParts(pairs)
  activeParts.setParts(parts)
  historyView.render(parts)
  // After DOM update we need to re-measure for scroll controller
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
  updateMasksVisibility()
  }
}

// ---------- Spacing Runtime Styles ----------
function applySpacingStyles(settings){
  if(!settings) return
  const { partPadding=4, gapOuterPx=6, gapMetaPx=6, gapIntraPx=6, gapBetweenPx=10 } = settings
  let styleEl = document.getElementById('runtimeSpacing')
  if(!styleEl){ styleEl = document.createElement('style'); styleEl.id='runtimeSpacing'; document.head.appendChild(styleEl) }
  styleEl.textContent = `#historyPane{padding-top:${gapOuterPx}px; padding-bottom:${gapOuterPx}px;}
  /* DEBUG: show both masks in translucent red */
  #historyTopMask{position:sticky; top:0; left:0; right:0; height:${gapOuterPx}px; pointer-events:none; z-index:10; display:block; 
    transform:translateY(-${gapOuterPx}px);
    background:rgba(255,0,0,0.25); border-bottom:1px solid rgba(255,0,0,0.6);
  }
  #historyBottomMask{position:absolute; left:0; right:0; pointer-events:none; z-index:10; display:none; 
    background:rgba(255,0,0,0.25); border-top:1px solid rgba(255,0,0,0.6); box-sizing:border-box; /* width governed by left/right like top mask */
  }
  .history{gap:0;}
  /* Gaps now explicit elements */
  .gap{width:100%; flex:none;}
  .gap-between{height:${gapBetweenPx}px;}
  .gap-meta{height:${gapMetaPx}px;}
  .gap-intra{height:${gapIntraPx}px;}
  /* Base part reset */
  .part{margin:0;box-shadow:none;background:transparent;}
  /* Uniform padding only for user/assistant; meta intentionally minimal */
  .part.user .part-inner, .part.assistant .part-inner{padding:${partPadding}px;}
  .part.meta .part-inner{padding:0; display:flex; flex-direction:row; align-items:center; gap:0; min-height:1.6em;}
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
function updateMasksVisibility(){
  const topMask = document.getElementById('historyTopMask')
  const bottomMask = document.getElementById('historyBottomMask')
  if(!topMask || !bottomMask) return
  const s = getSettings()
  const mode = s.anchorMode || 'bottom'
  const G = s.gapOuterPx || 0
  const pane = historyPaneEl
  const S = pane.scrollTop
  const H = pane.clientHeight
  const viewportBottom = S + H
  const parts = Array.from(pane.querySelectorAll('#history > .part')) // includes meta
  const padLeft = parseFloat(getComputedStyle(pane).paddingLeft)||0
  const padRight = parseFloat(getComputedStyle(pane).paddingRight)||0
  const innerWidth = pane.clientWidth - padLeft - padRight

  // Helpers ----------------------------------------------------
  function findBottomClipped(){
    for(const p of parts){
      const partTop = p.offsetTop
      const partBottom = partTop + p.offsetHeight
      if(partTop < viewportBottom && partBottom > viewportBottom) return { part:p, partTop, partBottom }
    }
    return null
  }
  function findTopClipped(){
    for(const p of parts){
      const partTop = p.offsetTop
      const partBottom = partTop + p.offsetHeight
      if(partTop < S && partBottom > S) return { part:p, partTop, partBottom }
    }
    return null
  }
  function applyFixedTopOuterGapMask(){
    // Top reading position: mask exactly the structural outer gap always.
    topMask.style.display = 'block'
    topMask.style.position = 'sticky'
    topMask.style.top = '0px'
    topMask.style.left = '0'
    topMask.style.right = '0'
    topMask.style.height = G + 'px'
    topMask.style.transform = `translateY(-${G}px)`
  }
  function applyFixedBottomOuterGapMask(){
    // Bottom reading position: mask the bottom outer gap (content-space coordinates).
    bottomMask.style.display = 'block'
    bottomMask.style.position = 'absolute'
  bottomMask.style.left = padLeft + 'px'
  bottomMask.style.right = 'auto'
  bottomMask.style.width = innerWidth + 'px'
    // Bottom gap occupies [viewportBottom-G, viewportBottom) in content coordinates.
    bottomMask.style.top = (S + H - G) + 'px'
    bottomMask.style.height = G + 'px'
  }
  function hideTopMask(){
    topMask.style.display = 'none'
    topMask.style.height = '0px'
    topMask.style.transform = ''
  }
  function hideBottomMask(){
    bottomMask.style.display = 'none'
    bottomMask.style.height = '0px'
  }
  function applyDynamicBottomClipped(){
    const hit = findBottomClipped()
    if(hit){
      bottomMask.style.display = 'block'
      bottomMask.style.position = 'absolute'
  bottomMask.style.left = padLeft + 'px'
  bottomMask.style.right = 'auto'
  bottomMask.style.width = innerWidth + 'px'
      bottomMask.style.top = hit.partTop + 'px'
      bottomMask.style.height = (viewportBottom - hit.partTop) + 'px'
    } else hideBottomMask()
  }
  function applyDynamicTopClipped(){
    const hit = findTopClipped()
    if(hit){
      const coverHeight = S - hit.partTop // portion hidden above viewport top
      topMask.style.display = 'block'
      topMask.style.position = 'absolute'
  topMask.style.left = padLeft + 'px'
  topMask.style.right = 'auto'
  topMask.style.width = innerWidth + 'px'
      topMask.style.top = hit.partTop + 'px'
      topMask.style.height = coverHeight + 'px'
      topMask.style.transform = '' // ensure no leftover from top-mode
    } else hideTopMask()
  }

  // Mode-specific application ----------------------------------
  if(mode === 'top'){
    applyFixedTopOuterGapMask()
    applyDynamicBottomClipped()
  } else if(mode === 'bottom'){
    // Invert roles: fixed bottom outer-gap mask, dynamic top clipped-part mask.
    applyFixedBottomOuterGapMask()
    applyDynamicTopClipped()
  } else { // center: both edges potentially clipped; both dynamic.
    applyDynamicTopClipped()
    applyDynamicBottomClipped()
  }
}

// Update masks on scroll (user free scroll) to maintain correct clipped coverage
historyPaneEl.addEventListener('scroll', ()=>{ updateMasksVisibility() })

// escapeHtml centralized in ui/util.js

function renderStatus(){ const modeEl = document.getElementById('modeIndicator'); if(modeEl) modeEl.textContent = `[${modeManager.mode.toUpperCase()}]` }


async function bootstrap(){
  await persistence.init()
  // Always reduce part size for current partition testing session (idempotent)
  saveSettings({ partFraction: 0.30 })
  applySpacingStyles(getSettings())
  if(store.getAllPairs().length === 0){
    seedDemoPairs()
  }
  renderHistory(store.getAllPairs())
  renderTopics()
  renderStatus()
  applyActivePart()
  if(!pendingMessageMeta.topicId) pendingMessageMeta.topicId = store.rootTopicId
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
  if(e.key === 'n'){ lifecycle.jumpToNewReply('first'); return true }
  if(e.key === '*'){ cycleStar(); return true }
  if(e.key === 'a'){ toggleInclude(); return true }
  if(e.key === '1'){ setStarRating(1); return true }
  if(e.key === '2'){ setStarRating(2); return true }
  if(e.key === '3'){ setStarRating(3); return true }
  if(e.key === ' '){ setStarRating(0); return true }
}
const commandHandler = (e)=>{
  if(modalIsActive && modalIsActive()) return false
  if(e.key === 'Enter'){
    const q = commandInput.value.trim()
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
  const topicId = pendingMessageMeta.topicId || currentTopicId
  const model = pendingMessageMeta.model || 'gpt'
  if(lifecycle.isPending()) return true
  lifecycle.beginSend()
  const id = store.addMessagePair({ topicId, model, userText: text, assistantText: '(placeholder response)' })
  // Simulate async assistant reply after short delay (placeholder)
  setTimeout(()=>{
    const pair = store.pairs.get(id)
    if(pair){
      pair.assistantText = 'Assistant reply to: '+text
      store.updatePair(id, { assistantText: pair.assistantText })
  lifecycle.completeSend()
      renderHistory(store.getAllPairs())
  lifecycle.handleNewAssistantReply(id)
    }
  }, 400) // simulated latency
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
function toggleInclude(){
  const act = activeParts.active(); if(!act) return
  const pair = store.pairs.get(act.pairId); if(!pair) return
  store.updatePair(pair.id, { includeInContext: !pair.includeInContext })
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
  // Developer shortcut: Ctrl+Shift+S to reseed long test messages
  if(e.shiftKey && k==='s'){ e.preventDefault(); window.seedTestMessages && window.seedTestMessages() }
})

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
function updateHud(){
  const act = activeParts.active()
  let pairInfo='(none)'
  if(act){
    const pair = store.pairs.get(act.pairId)
    if(pair){
      const topic = store.topics.get(pair.topicId)
  pairInfo = `${pair.id.slice(0,8)} t:${topic?topic.name:''}\n★:${pair.star} include:${pair.includeInContext?'Y':'N'} model:${pair.model}\n@${formatTimestamp(pair.createdAt)}`
    }
  }
  const idx = act? `${activeParts.parts.indexOf(act)+1}/${activeParts.parts.length}` : '0/0'
  const focusEl = document.activeElement
  const focusDesc = focusEl ? `${focusEl.tagName.toLowerCase()}${focusEl.id?('#'+focusEl.id):''}` : 'none'
  const dbg = scrollController.debugInfo && scrollController.debugInfo()
  const lines = []
  lines.push(`mode: ${modeManager.mode}`)
  lines.push(`lastKey: ${window.__lastKey||'-'}`)
  if(dbg){
    lines.push(`rp: ${dbg.mode}`)
    lines.push(`first: ${dbg.currentFirst}`)
    lines.push(`activeIndex: ${dbg.activeIndex}`)
    lines.push(`visCount(expected): ${dbg.shouldVisibleCount}`)
    lines.push(`firstTopPx: ${dbg.firstTopPx}`)
    if(dbg.visualGap != null) lines.push(`visualGap: ${dbg.visualGap}`)
    // Mask metrics (top mode)
    const paneR = historyPaneEl.getBoundingClientRect()
    const tMask = document.getElementById('historyTopMask')
    if(tMask){
      const rT = tMask.getBoundingClientRect()
      lines.push(`topMaskY:${Math.round(rT.top - paneR.top)} topMaskH:${rT.height}`)
    }
    const bMask = document.getElementById('historyBottomMask')
    if(bMask){
      const rB = bMask.getBoundingClientRect()
      lines.push(`botMaskY:${Math.round(rB.top - paneR.top)} botMaskH:${rB.height}`)
    }
    if(dbg.mode === 'top'){
      // compute target vs actual if possible
      if(dbg.activeIndex === dbg.currentFirst){
        // expected scrollTop = first element offsetTop - paddingTop; we approximate via firstTopPx - paddingTop already visualGap
        lines.push(`scrollTop: ${Math.round(dbg.scrollTop)}`)
      }
    }
    lines.push(`visibleIndices: [${dbg.visibleIndices}]`)
    lines.push(`tops: [${dbg.tops}]`)
    lines.push(`heights: [${dbg.heights}]`)
  }
  lines.push(`active: ${idx}`)
  lines.push(`focus: ${focusDesc}`)
  lines.push(pairInfo)
  hudEl.textContent = lines.join('\n')
  requestAnimationFrame(updateHud)
}
requestAnimationFrame(updateHud)

function renderPendingMeta(){
  const pm = document.getElementById('pendingModel')
  const pt = document.getElementById('pendingTopic')
  if(pm) pm.textContent = pendingMessageMeta.model || 'gpt'
  if(pt){
    const topic = store.topics.get(pendingMessageMeta.topicId || currentTopicId)
    if(topic){
      const path = formatTopicPath(topic.id)
      pt.textContent = middleTruncate(path, 90)
      pt.title = path
    } else {
      pt.textContent = ''
      pt.title = ''
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
  sendBtn.disabled = empty || lifecycle.isPending()
  if(lifecycle.isPending()){
    sendBtn.textContent = 'AI is thinking'
  } else {
    sendBtn.textContent = 'Send'
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
    const id = store.addMessagePair({ topicId, model, userText: text, assistantText: '(placeholder response)' })
    setTimeout(()=>{
      const pair = store.pairs.get(id)
      if(pair){
        pair.assistantText = 'Assistant reply to: '+text
        store.updatePair(id, { assistantText: pair.assistantText })
  lifecycle.completeSend()
        renderHistory(store.getAllPairs())
  lifecycle.handleNewAssistantReply(id)
      }
      updateSendDisabled()
    }, 400)
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
    if(i===2) pair.includeInContext = false // one excluded example
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
