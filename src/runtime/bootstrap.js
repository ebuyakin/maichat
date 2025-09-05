// runtime/bootstrap.js (Step 7)
// Orchestrates startup sequence: provider registration, persistence init, model catalog load,
// spacing styles, optional seeding, first render, loading overlay removal, and beforeunload flush.
// ZERO behavioral changes.

import { registerProvider } from '../infrastructure/provider/adapter.js'
import { createOpenAIAdapter } from '../infrastructure/provider/openaiAdapter.js'
import { ensureCatalogLoaded } from '../core/models/modelCatalog.js'
import { seedDemoPairs } from '../store/demoSeeding.js'
import { getSettings } from '../core/settings/index.js'

/**
 * Bootstrap the application.
 * @param {Object} opts
 * @param {Object} opts.ctx runtime context from initRuntime()
 * @param {Object} opts.historyRuntime history runtime API
 * @param {Object} opts.interaction interaction module API
 * @param {HTMLElement} opts.loadingEl overlay element to remove when ready
 */
export async function bootstrap({ ctx, historyRuntime, interaction, loadingEl }){
  const { store, persistence, pendingMessageMeta } = ctx
  const { applySpacingStyles, renderCurrentView, applyActivePart, renderStatus, layoutHistoryPane } = historyRuntime

  registerProvider('openai', createOpenAIAdapter())
  await persistence.init()
  ensureCatalogLoaded()
  applySpacingStyles(getSettings())

  // Restore persisted pending topic if available
  try {
    const savedPending = localStorage.getItem('maichat_pending_topic')
    if(savedPending && store.topics.has(savedPending)) pendingMessageMeta.topicId = savedPending
  } catch{}

  if(store.getAllPairs().length === 0) {
    seedDemoPairs(store)
  }

  renderCurrentView()
  renderStatus()
  applyActivePart()

  if(!pendingMessageMeta.topicId) pendingMessageMeta.topicId = store.rootTopicId
  try { localStorage.setItem('maichat_pending_topic', pendingMessageMeta.topicId) } catch{}

  interaction.renderPendingMeta()
  layoutHistoryPane()

  if(loadingEl) loadingEl.remove()

  // Flush pending writes on unload (moved from main.js)
  window.addEventListener('beforeunload', ()=>{ if(persistence && persistence.flush) persistence.flush() })
}
