import './styles/index.css'
// Boot diagnostics injected (temporary) to investigate blank page issue.
console.log('[MaiChat] boot script loaded (pre-imports)')

import { initRuntime } from './runtime/runtimeSetup.js'
import { createModeManager, MODES } from './features/interaction/modes.js'
import { bindHistoryErrorActions } from './features/history/historyView.js'
import { createHistoryRuntime } from './features/history/historyRuntime.js'
import { getSettings, subscribeSettings } from './core/settings/index.js'
import { decideRenderAction } from './runtime/renderPolicy.js'
import { createInteraction } from './features/interaction/interaction.js'
import { bootstrap } from './runtime/bootstrap.js'
import { installPointerModeSwitcher } from './features/interaction/pointerModeSwitcher.js'

window.addEventListener('error', (e)=>{ try { console.error('[MaiChat] window error', e.error || e.message || e) } catch{} })
window.addEventListener('unhandledrejection', (e)=>{ try { console.error('[MaiChat] unhandled rejection', e.reason) } catch{} })
window.__BOOT_STAGE = 'imports-complete'

console.log('[MaiChat] imports complete')

// Mode management
console.log('[MaiChat] constructing mode manager')
const modeManager = createModeManager()
window.__modeManager = modeManager
window.__MODES = MODES

// Root layout
const appEl = document.querySelector('#app')
if(!appEl){ console.error('[MaiChat] #app element missing'); }
appEl.innerHTML = `
  <div id="topBar" class="zone" data-mode="command">
    <div id="commandWrapper">
  <input id="commandInput" placeholder="filter:command" autocomplete="off"
             spellcheck="false" autocorrect="off" autocapitalize="off"
             data-gramm="false" data-gramm_editor="false" data-lt-active="false" />
    </div>
    <div id="statusRight">
  <span id="commandError"></span>
      <span id="messageCount" title="Visible message pairs" class="mc">0</span>
      <button id="appMenuBtn" aria-haspopup="true" aria-expanded="false" title="Menu (Ctrl+.)" class="menu-btn" tabindex="0">⋮</button>
      <div id="appMenu" class="app-menu" hidden>
        <ul>
          <li data-action="topic-editor"><span class="label">Topic Editor</span><span class="hint">Ctrl+E</span></li>
          <li data-action="model-editor"><span class="label">Model Editor</span><span class="hint">Ctrl+Shift+M</span></li>
          <li data-action="daily-stats"><span class="label">Daily Stats</span><span class="hint">Ctrl+Shift+D</span></li>
          <li data-action="settings"><span class="label">Settings</span><span class="hint">Ctrl+,</span></li>
          <li data-action="api-keys"><span class="label">API Keys</span><span class="hint">Ctrl+K</span></li>
          <li data-action="tutorial"><span class="label">Tutorial</span><span class="hint">Ctrl+Shift+H</span></li>
          <li data-action="help"><span class="label">Help</span><span class="hint">F1</span></li>
        </ul>
      </div>
    </div>
  </div>
  <div id="historyPane" class="zone" data-mode="view">
    <div class="gradientOverlayTop"></div>
    <div id="history" class="history"></div>
    <div class="gradientOverlayBottom"></div>
  </div>
  <div id="inputBar" class="zone" data-mode="input">
    <div class="inputBar-inner">
      <div class="row first">
        <textarea id="inputField" placeholder="Type message... (Enter to send)" autocomplete="off" rows="2"></textarea>
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
console.log('[MaiChat] initRuntime start')

const __runtime = initRuntime() // create runtime NB!

console.log('[MaiChat] initRuntime done')
const { store, persistence, activeParts, pendingMessageMeta } = __runtime
console.log('[MaiChat] createHistoryRuntime start')
const historyRuntime = createHistoryRuntime(__runtime)
console.log('[MaiChat] createHistoryRuntime done')
const { layoutHistoryPane, applySpacingStyles, renderCurrentView, applyActiveMessage, renderStatus } = historyRuntime
requestAnimationFrame(layoutHistoryPane)
// (currentTopicId handled inside interaction module now)
const historyPaneEl = document.getElementById('historyPane')
// DOM inputs (needed before interaction creation)
const commandInput = document.getElementById('commandInput')
const commandErrEl = document.getElementById('commandError')
const inputField = document.getElementById('inputField')
const sendBtn = document.getElementById('sendBtn')

// Debug overlays (dev-only, unified activation via ?hud=...)
let requestDebug = { enable: ()=>{}, toggle: ()=>{}, isEnabled: ()=>false, setPayload: ()=>{} }
let hudRuntime = { enable: ()=>{}, toggle: ()=>{}, isEnabled: ()=>false }
// Always expose stubs so console calls won't throw even if dev gating prevents activation
try { window.__hud = { runtime: hudRuntime, req: requestDebug } } catch {}
try {
  const isDev = (typeof import.meta !== 'undefined' && import.meta?.env && import.meta.env.DEV === true) || /^(localhost|127\.|0\.0\.0\.0)/.test(window.location.hostname)
  console.log('[MaiChat] dev detect:', { isDev, host: window.location.hostname })
  if (isDev) {
    const usp = new URLSearchParams(window.location.search)
    const hudParam = (usp.get('hud')||'').replace(/\s+/g,'').trim()
    const wantReq = /(^|,)(req|request)(,|$)/i.test(hudParam) || /(^|,)(all)(,|$)/i.test(hudParam)
    const wantRuntime = /(^|,)(runtime|rt)(,|$)/i.test(hudParam) || /(^|,)(all)(,|$)/i.test(hudParam)
  console.log('[MaiChat] HUD param:', hudParam || '(none)')
  if (wantReq) {
      const mod = await import('./instrumentation/requestDebugOverlay.js')
      requestDebug = mod.createRequestDebugOverlay({ historyRuntime })
      requestDebug.enable(true)
    }
    if (wantRuntime) {
      const mod2 = await import('./instrumentation/hudRuntime.js')
      hudRuntime = mod2.createHudRuntime({ store, activeParts, scrollController: __runtime.scrollController, historyPaneEl, historyRuntime, modeManager })
      hudRuntime.enable(true)
    }
  // Expose console toggles in dev
  window.__hud = { runtime: hudRuntime, req: requestDebug }
  }
} catch (e) {
  console.warn('[MaiChat] HUD setup skipped', e)
}

// Interaction layer (Step 6 extraction)
console.log('[MaiChat] createInteraction start')
const interaction = createInteraction({
  ctx: __runtime,
  dom: { commandInput, commandErrEl, inputField, sendBtn, historyPaneEl },
  historyRuntime,
  requestDebug,
  hudRuntime
})
console.log('[MaiChat] createInteraction done')

bindHistoryErrorActions(document.getElementById('history'), {
  onResend: (pairId)=>{
    interaction.prepareEditResend(pairId)
  },
  onDelete: (pairId)=>{
    interaction.deletePairWithFocus(pairId)
  }
})
// Preload settings
const __initialSettings = getSettings()
let __prevSettings = { ...__initialSettings }
let __lastPF = __prevSettings.partFraction
let __lastPadding = __prevSettings.partPadding
subscribeSettings((s)=>{
  const action = decideRenderAction(__prevSettings, s)
  // Maintain previous snapshot for next diff
  __prevSettings = { ...s }
  // Partition cache invalidation for line budget changes
  // Partition cache invalidation removed in message-based rendering
  if(s.partFraction !== __lastPF){ __lastPF = s.partFraction }
  if(s.partPadding !== __lastPadding){ __lastPadding = s.partPadding }
  if(action === 'rebuild'){
    applySpacingStyles(s)
    layoutHistoryPane()
    // Rebuild while preserving active
  renderCurrentView({ preserveActive:true })
    // After rebuild completes and parts are measured, bottom-align the focused part once
    try {
      const act = __runtime.activeParts && __runtime.activeParts.active && __runtime.activeParts.active()
      const id = act && act.id
      if(id){
        // Wait for remeasure in renderHistory's rAF, then align
        requestAnimationFrame(()=>{ requestAnimationFrame(()=>{ __runtime.scrollController && __runtime.scrollController.alignTo(id, 'bottom', false) }) })
      }
    } catch {}
  } else if(action === 'restyle'){
    applySpacingStyles(s)
    layoutHistoryPane()
    // Note: no history rebuild; fade/visibility will update on scroll or next render
  } else {
    // no-op for view; still allow other subscribers to react
  }
})
function renderTopics(){ /* hidden for now */ }


console.log('[MaiChat] bootstrap start')
bootstrap({ ctx: __runtime, historyRuntime, interaction, loadingEl })
  .then(()=>{
    try {
      // Restore last filter if it was active
      interaction.restoreLastFilter()
      // Default to Input Mode on startup for immediate typing
      window.__modeManager && window.__modeManager.set(MODES.INPUT)
      console.log('[MaiChat] default mode set to INPUT')
    } catch {}
  })
console.log('[MaiChat] bootstrap invoked')

console.log('[MaiChat] boot complete')

// Pointer-mode switching (mouse/touch): switch app mode before pointer focus lands (excludes overlays)
installPointerModeSwitcher({ modeManager, isModalActiveFn: ()=> (window.modalIsActive && window.modalIsActive()) })

// Hang detector (5s) – if not complete, show diagnostic overlay
setTimeout(()=>{
  if(!window.__modeManager){
    const el = document.getElementById('app')
    if(el){
      el.innerHTML = '<div style="font:12px monospace;color:#c00;padding:1rem;">MaiChat boot hang – mode manager not initialized. Check network tab for missing modules. <br/>If opened via file:// try running dev server: npm run dev</div>'
    }
    console.warn('[MaiChat] boot hang detected (mode manager missing)')
  }
}, 5000)

// End slim main.js after Step 7
