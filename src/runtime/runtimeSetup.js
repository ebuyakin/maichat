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
import { ActivePartController } from '../features/history/parts.js'
import { createScrollController } from '../features/history/scrollControllerV3.js'
import { createNewMessageLifecycle } from '../features/history/newMessageLifecycle.js'
import { createBoundaryManager } from '../core/context/boundaryManager.js'
import { evaluate } from '../features/command/evaluator.js' // used indirectly via lifecycle callbacks
export function initRuntime() {
  const store = createStore()
  attachIndexes(store)
  const persistence = attachContentPersistence(store, createIndexedDbAdapter())
  const historyPaneEl = document.getElementById('historyPane')
  const activeParts = new ActivePartController()
  const scrollController = createScrollController({ container: historyPaneEl })
  const historyView = createHistoryView({ store, onActivePartRendered: ()=> applyActivePart(ctx) })
  const boundaryMgr = createBoundaryManager()

  // Pending message metadata (topic + model) initially set after catalog load; fallback model default.
  const pendingMessageMeta = { topicId: null, model: getActiveModel() || 'gpt-4o' }

  // Lifecycle handles send state & new reply focus heuristics.
  const lifecycle = createNewMessageLifecycle({
    store,
    activeParts,
    commandInput: null, // assigned later by interaction module
    renderHistory: (pairs)=> renderHistoryInternal(ctx, pairs),
    applyActivePart: ()=> applyActivePart(ctx)
  })

  const ctx = {
    store,
    persistence,
    activeParts,
    historyView,
    scrollController,
    boundaryMgr,
    lifecycle,
    pendingMessageMeta,
    getSettings,
    getActiveModel
  }

  // Expose for diagnostics (mirrors previous main.js behavior partially; full exposure remains in main during Phase 1)
  window.__scrollController = scrollController
  window.__store = store
  return ctx
}

// Internal helper used by lifecycle callback before modules fully extracted.
function renderHistoryInternal(ctx, pairs){
  // Placeholder: real implementation still lives in main.js (historyRuntime extraction later).
  // This function keeps lifecycle contract intact during step 1.
  // It will be removed once historyRuntime.js is introduced.
  if(!pairs) return
  const sorted = [...pairs].sort((a,b)=> a.createdAt - b.createdAt)
  const parts = ctx.activeParts ? ctx.activeParts.setParts && ctx.activeParts.setParts([]) : null
  // No-op; full render pipeline still in main.js.
}

function applyActivePart(ctx){
  // No-op placeholder (actual logic resides in main.js until step 3 extraction)
  return
}
