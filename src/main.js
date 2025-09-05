import './style.css'
import { initRuntime } from './runtime/runtimeSetup.js'
import { createModeManager, MODES } from './ui/modes.js'
import { bindHistoryErrorActions } from './ui/history/historyView.js'
import { createHistoryRuntime } from './ui/history/historyRuntime.js'
import { getSettings, subscribeSettings } from './settings/index.js'
import { invalidatePartitionCacheOnResize } from './partition/partitioner.js'
import { exposeSeedingHelpers } from './store/demoSeeding.js'
import { createRequestDebugOverlay } from './instrumentation/requestDebugOverlay.js'
import { createHudRuntime } from './instrumentation/hudRuntime.js'
import { createInteraction } from './ui/interaction/interaction.js'
import { bootstrap } from './runtime/bootstrap.js'

// Mode management
const modeManager = createModeManager()
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

// Runtime context
const __runtime = initRuntime()
const { store, persistence, activeParts, pendingMessageMeta } = __runtime
const historyRuntime = createHistoryRuntime(__runtime)
const { layoutHistoryPane, applySpacingStyles, renderCurrentView, applyActivePart, renderStatus } = historyRuntime
requestAnimationFrame(layoutHistoryPane)
// (currentTopicId handled inside interaction module now)
const historyPaneEl = document.getElementById('historyPane')
// DOM inputs (needed before interaction creation)
const commandInput = document.getElementById('commandInput')
const commandErrEl = document.getElementById('commandError')
const inputField = document.getElementById('inputField')
const sendBtn = document.getElementById('sendBtn')

// Debug overlays
const requestDebug = createRequestDebugOverlay({ historyRuntime })
const hudRuntime = createHudRuntime({ store, activeParts, scrollController: __runtime.scrollController, historyPaneEl, historyRuntime, modeManager })

// Interaction layer (Step 6 extraction)
const interaction = createInteraction({
  ctx: __runtime,
  dom: { commandInput, commandErrEl, inputField, sendBtn, historyPaneEl },
  historyRuntime,
  requestDebug,
  hudRuntime
})

bindHistoryErrorActions(document.getElementById('history'), {
  onResend: (pairId)=>{
    const pair = store.pairs.get(pairId)
    if(!pair) return
    inputField.value = pair.userText
    pendingMessageMeta.topicId = pair.topicId
    pendingMessageMeta.model = pair.model
    interaction.renderPendingMeta()
    pair.errorMessage = undefined
    renderCurrentView({ preserveActive:true })
    modeManager.set(MODES.INPUT)
    inputField.focus()
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
function renderTopics(){ /* hidden for now */ }


bootstrap({ ctx: __runtime, historyRuntime, interaction, loadingEl })

// Seeding helpers
exposeSeedingHelpers(store, ()=> renderCurrentView(), activeParts, ()=> applyActivePart())

// End slim main.js after Step 7
