import './styles/index.css'

// Bundle syntax highlighting and math rendering libraries
import 'katex/dist/katex.min.css'
import katex from 'katex'
import Prism from 'prismjs'

// Import common Prism language grammars
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-markdown'

// Expose globally for enhancement functions
window.katex = katex
window.Prism = Prism

import { initRuntimeCore, attachDomBindings } from './runtime/runtimeSetup.js'
import { createModeManager, MODES } from './features/interaction/modes.js'
import { bindHistoryErrorActions, bindSourcesActions, bindImageBadgeActions } from './features/history/historyView.js'
import { openSourcesOverlay } from './features/history/sourcesOverlay.js'
import { openImageOverlay } from './features/images/imageOverlay.js'
import { createHistoryRuntime } from './features/history/historyRuntime.js'
import { getSettings, subscribeSettings } from './core/settings/index.js'
import { decideRenderAction } from './runtime/renderPolicy.js'
import { createInteraction } from './features/interaction/interaction.js'
import { bootstrap } from './runtime/bootstrap.js'
import { installPointerModeSwitcher } from './features/interaction/pointerModeSwitcher.js'
import { init as initImageStore } from './features/images/imageStore.js'
import { preloadState } from './runtime/preloadState.js'
import { buildAppHTML } from './runtime/appTemplate.js'

window.addEventListener('error', (e) => {
  try {
    console.error('[MaiChat] window error', e.error || e.message || e)
  } catch {}
})
window.addEventListener('unhandledrejection', (e) => {
  try {
    console.error('[MaiChat] unhandled rejection', e.reason)
  } catch {}
})

// Initialize storage subsystems that must be ready before interaction wiring
try {
  await initImageStore()
} catch (e) {
  console.error('[MaiChat] imageStore init failed', e)
}

// Mode management
const modeManager = createModeManager()
window.__modeManager = modeManager
window.__MODES = MODES

// ──────────────────────────────────────────────────────────────────────────
// SINGLE-PAINT RENDERING: Load all state, then render once
// ──────────────────────────────────────────────────────────────────────────

// Initialize runtime core (no DOM access yet)
const __core = initRuntimeCore()
const { store, persistence, activeParts, pendingMessageMeta } = __core

// Ensure persistence is initialized before preloading so store has topics/pairs
try {
  await __core.persistence.init()
} catch (e) {
  console.warn('[MaiChat] persistence init failed (continuing)', e)
}
// Preload all state needed for complete initial render
const __preloadedState = await preloadState(store, { loadHistoryCount: true })

// Hydrate runtime with preloaded metadata (for later use by interaction layer)
pendingMessageMeta.topicId = __preloadedState.pendingTopicId
if (Array.isArray(__preloadedState.attachmentIds)) {
  pendingMessageMeta.attachments = __preloadedState.attachmentIds.slice()
}

// Build and inject complete HTML with all values populated
const appEl = document.querySelector('#app')
if (!appEl) {
  console.error('[MaiChat] #app element missing')
}
appEl.innerHTML = buildAppHTML(__preloadedState)

// Create loading overlay for bootstrap to remove (keeps bootstrap API unchanged)
const loadingEl = document.createElement('div')
loadingEl.id = 'appLoading'
loadingEl.style.display = 'none' // Hidden since we already painted
document.body.appendChild(loadingEl)

// ──────────────────────────────────────────────────────────────────────────
// Attach DOM-dependent pieces & wire runtime components
// ──────────────────────────────────────────────────────────────────────────
const __runtime = attachDomBindings(__core)
const historyRuntime = createHistoryRuntime(__runtime)

const {
  layoutHistoryPane,
  applySpacingStyles,
  renderCurrentView,
  applyActiveMessage,
  renderStatus,
} = historyRuntime

// Do initial history render synchronously to avoid extra paints later
renderCurrentView({ preserveActive: false })
requestAnimationFrame(layoutHistoryPane)
// (currentTopicId handled inside interaction module now)

const historyPaneEl = document.getElementById('historyPane')
// DOM inputs (needed before interaction creation)

const commandInput = document.getElementById('commandInput')
const commandErrEl = document.getElementById('commandError')
const inputField = document.getElementById('inputField')
const sendBtn = document.getElementById('sendBtn')

// Debug overlays (dev-only, unified activation via ?hud=...)
let requestDebug = {
  enable: () => {},
  toggle: () => {},
  isEnabled: () => false,
  setPayload: () => {},
}
let hudRuntime = { enable: () => {}, toggle: () => {}, isEnabled: () => false }
// Always expose stubs so console calls won't throw even if dev gating prevents activation
try {
  window.__hud = { runtime: hudRuntime, req: requestDebug }
} catch {}
try {
  const isDev =
    (typeof import.meta !== 'undefined' && import.meta?.env && import.meta.env.DEV === true) ||
    /^(localhost|127\.|0\.0\.0\.0)/.test(window.location.hostname)
  if (isDev) {
    const usp = new URLSearchParams(window.location.search)
    const hudParam = (usp.get('hud') || '').replace(/\s+/g, '').trim()
    const wantReq = /(^|,)(req|request)(,|$)/i.test(hudParam) || /(^|,)(all)(,|$)/i.test(hudParam)
    const wantRuntime =
      /(^|,)(runtime|rt)(,|$)/i.test(hudParam) || /(^|,)(all)(,|$)/i.test(hudParam)
    if (wantReq) {
      const mod = await import('./instrumentation/requestDebugOverlay.js')
      requestDebug = mod.createRequestDebugOverlay({ historyRuntime })
      requestDebug.enable(true)
    }
    if (wantRuntime) {
      const mod2 = await import('./instrumentation/hudRuntime.js')
      hudRuntime = mod2.createHudRuntime({
        store,
        activeParts,
        scrollController: __runtime.scrollController,
        historyPaneEl,
        historyRuntime,
        modeManager,
      })
      hudRuntime.enable(true)
    }
    // Expose console toggles in dev
    window.__hud = { runtime: hudRuntime, req: requestDebug }
  }
} catch (e) {
  console.warn('[MaiChat] HUD setup skipped', e)
}

// Interaction layer (Step 6 extraction)
const interaction = createInteraction({
  ctx: __runtime,
  dom: { commandInput, commandErrEl, inputField, sendBtn, historyPaneEl },
  historyRuntime,
  requestDebug,
  hudRuntime,
})

bindHistoryErrorActions(document.getElementById('history'), {
  onResend: (pairId) => {
    interaction.prepareEditResend(pairId)
  },
  onDelete: (pairId) => {
    interaction.deletePairWithFocus(pairId)
  },
})
bindSourcesActions(document.getElementById('history'), {
  onOpen: (pairId) => {
    openSourcesOverlay({ store, pairId, modeManager })
  },
})
bindImageBadgeActions(document.getElementById('history'), {
  onOpen: (pairId) => {
    const pair = store.pairs.get(pairId)
    if (pair && Array.isArray(pair.attachments) && pair.attachments.length) {
      openImageOverlay({ modeManager, mode: 'view', pair, startIndex: 0 })
    }
  },
})
// Preload settings
const __initialSettings = getSettings()
let __prevSettings = { ...__initialSettings }
let __lastPF = __prevSettings.partFraction
let __lastPadding = __prevSettings.partPadding

subscribeSettings((s) => {
  const action = decideRenderAction(__prevSettings, s)
  // Maintain previous snapshot for next diff
  __prevSettings = { ...s }
  // Partition cache invalidation for line budget changes
  // Partition cache invalidation removed in message-based rendering
  if (s.partFraction !== __lastPF) {
    __lastPF = s.partFraction
  }
  if (s.partPadding !== __lastPadding) {
    __lastPadding = s.partPadding
  }
  if (action === 'rebuild') {
    applySpacingStyles(s)
    layoutHistoryPane()
    // Rebuild while preserving active
    renderCurrentView({ preserveActive: true })
    // Align active message to top (like filter survival - predictable position after layout change)
    try {
      const act =
        __runtime.activeParts && __runtime.activeParts.active && __runtime.activeParts.active()
      if (act && act.id && __runtime.scrollController && __runtime.scrollController.alignTo) {
        setTimeout(() => {
          __runtime.scrollController.alignTo(act.id, 'top', false)
        }, 0)
      }
    } catch {}
  } else if (action === 'restyle') {
    applySpacingStyles(s)
    layoutHistoryPane()
    // Remeasure after CSS changes, then align active message to top
    try {
      const act =
        __runtime.activeParts && __runtime.activeParts.active && __runtime.activeParts.active()
      if (act && act.id && __runtime.scrollController) {
        // Remeasure with new spacing (no render = no automatic remeasure)
        if (__runtime.scrollController.remeasure) {
          __runtime.scrollController.remeasure()
        }
        // Now align with fresh metrics
        if (__runtime.scrollController.alignTo) {
          __runtime.scrollController.alignTo(act.id, 'top', false)
        }
      }
    } catch {}
  } else {
    // no-op for view; still allow other subscribers to react
  }
})

function renderTopics() {
  /* hidden for now */
}

// App starter.
bootstrap({ ctx: __runtime, historyRuntime, interaction, loadingEl, skipPersistenceInit: true, skipInitialRender: true }).then(() => {
  try {
    // Filter restoration now handled by bootstrap for cleaner initial load
    // (restoreLastFilter() still available for user actions)
    
    // Default to Input Mode on startup for immediate typing
    window.__modeManager && window.__modeManager.set(MODES.INPUT)
  } catch {}
})

// Pointer-mode switching (mouse/touch): switch app mode before pointer focus lands (excludes overlays)
installPointerModeSwitcher({
  modeManager,
  isModalActiveFn: () => window.modalIsActive && window.modalIsActive(),
})

// Hang detector (5s) – if not complete, show diagnostic overlay
setTimeout(() => {
  if (!window.__modeManager) {
    const el = document.getElementById('app')
    if (el) {
      el.innerHTML =
        '<div style="font:12px monospace;color:#c00;padding:1rem;">MaiChat boot hang – mode manager not initialized. Check network tab for missing modules. <br/>If opened via file:// try running dev server: npm run dev</div>'
    }
    console.warn('[MaiChat] boot hang detected (mode manager missing)')
  }
}, 5000)

// End slim main.js after Step 7
