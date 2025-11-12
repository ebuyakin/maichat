// Phase 1 extraction: runtimeSetup.js
// Responsibility: construct core runtime (store, indexes, persistence, boundaryMgr, activeParts, historyView, scrollController, lifecycle, pendingMessageMeta)
// NOTE: DOM queries limited to elements that already exist in main layout. No new behavior introduced.

import { createStore } from '../core/store/memoryStore.js'
import { attachIndexes } from '../core/store/indexes.js'
import { createIndexedDbAdapter } from '../core/store/indexedDbAdapter.js'
import { attachContentPersistence } from '../core/persistence/contentPersistence.js'
import { getSettings } from '../core/settings/index.js'
import { getActiveModel } from '../core/models/modelCatalog.js'
// History feature (post Phase 6.1 transplant)
import { createHistoryView, bindHistoryErrorActions } from '../features/history/historyView.js'

// Minimal active controller compatible with message ids (pairId:u / pairId:a)
class ActivePartController {
  constructor() {
    this.parts = []
    this.activeIndex = 0
  }
  setParts(parts) {
    const prev = this.active()
    this.parts = parts || []
    if (prev) {
      const idx = this.parts.findIndex((p) => p.id === prev.id)
      if (idx !== -1) this.activeIndex = idx
      else if (this.activeIndex >= this.parts.length)
        this.activeIndex = this.parts.length ? this.parts.length - 1 : 0
    } else {
      if (this.activeIndex >= this.parts.length)
        this.activeIndex = this.parts.length ? this.parts.length - 1 : 0
    }
  }
  setActiveById(id) {
    const i = this.parts.findIndex((p) => p.id === id)
    if (i !== -1) this.activeIndex = i
  }
  active() {
    return this.parts[this.activeIndex]
  }
  first() {
    if (this.parts.length) this.activeIndex = 0
  }
  last() {
    if (this.parts.length) this.activeIndex = this.parts.length - 1
  }
  next() {
    if (this.activeIndex < this.parts.length - 1) this.activeIndex++
  }
  prev() {
    if (this.activeIndex > 0) this.activeIndex--
  }
}

import { createScrollController } from '../features/history/scrollControllerV3.js'
import { createNewMessageLifecycle } from '../features/history/newMessageLifecycle.js'
import { createBoundaryManager } from '../core/context/boundaryManager.js'

// launch of the application NB!
// Phase 1: DOM-independent core setup
export function initRuntimeCore() {
  const store = createStore()
  attachIndexes(store)
  const persistence = attachContentPersistence(store, createIndexedDbAdapter())
  const activeParts = new ActivePartController()
  const boundaryMgr = createBoundaryManager()

  // Pending message metadata (topic + model) initially set after catalog load; fallback model default.
  const pendingMessageMeta = {
    topicId: null,
    model: getActiveModel() || 'gpt-5-mini',
    attachments: [],
  }

  // Stub scrollController; will be populated in attachDomBindings while keeping reference identity.
  const scrollController = {
    alignTo: () => {},
    scrollToBottom: () => {},
    isProgrammaticScroll: () => false,
    setActiveIndex: () => {},
    remeasure: () => {},
    ensureVisible: () => {},
  }

  const lifecycle = createNewMessageLifecycle({
    store,
    activeParts,
    commandInput: null,
    renderHistory: () => {},
    applyActiveMessage: () => {},
    alignTo: (id, pos, anim) => scrollController.alignTo && scrollController.alignTo(id, pos, anim),
    scrollController, // mutate methods later
  })

  const ctx = {
    store,
    persistence,
    activeParts,
    // historyView will be attached later
    scrollController,
    boundaryMgr,
    lifecycle,
    pendingMessageMeta,
    getSettings,
    getActiveModel,
  }

  // Dev diagnostics
  try {
    const isDev = typeof import.meta !== 'undefined' && import.meta?.env?.DEV
    const params = new URLSearchParams(window.location?.search || '')
    const debugOn = params.get('debug') === '1' || params.get('dbg') === '1'
    if (isDev && debugOn) {
      window.__store = store
    }
  } catch {}
  
  return ctx
}

// Phase 2: Attach DOM-dependent bindings (must be called after layout is rendered)
export function attachDomBindings(core) {
  const historyPaneEl = document.getElementById('historyPane')
  const historyEl = document.getElementById('history')
  if (!historyPaneEl || !historyEl) throw new Error('History DOM not ready')

  const realSC = createScrollController({ container: historyEl })
  // Mutate the stub to preserve reference identity used by lifecycle
  Object.assign(core.scrollController, realSC)

  const historyView = createHistoryView({ store: core.store, onActivePartRendered: () => {} })
  return { ...core, historyView }
}

// Back-compat wrapper: preserve initRuntime API for legacy callers
export function initRuntime() {
  const core = initRuntimeCore()
  return attachDomBindings(core)
}

// Note: history rendering and active-part application are owned by historyRuntime now.
