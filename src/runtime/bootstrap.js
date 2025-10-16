// runtime/bootstrap.js (Step 7)
// Orchestrates startup sequence: provider registration, persistence init, model catalog load,
// spacing styles, optional seeding, first render, loading overlay removal, and beforeunload flush.
// ZERO behavioral changes.

import { registerProvider } from '../infrastructure/provider/adapter.js'
import { createOpenAIAdapter } from '../infrastructure/provider/openaiAdapter.js'
import { createAnthropicAdapter } from '../infrastructure/provider/anthropicAdapter.js'
import { createGeminiAdapter } from '../infrastructure/provider/geminiAdapter.js'
import { ensureCatalogLoaded } from '../core/models/modelCatalog.js'
import { runInitialSeeding, shouldRunInitialSeeding } from './initialSeeding.js'
import { getSettings } from '../core/settings/index.js'
import { getApiKey } from '../infrastructure/api/keys.js'
import { openApiKeysOverlay } from '../features/config/apiKeysOverlay.js'

/**
 * Bootstrap the application.
 * @param {Object} opts
 * @param {Object} opts.ctx runtime context from initRuntime()
 * @param {Object} opts.historyRuntime history runtime API
 * @param {Object} opts.interaction interaction module API
 * @param {HTMLElement} opts.loadingEl overlay element to remove when ready
 */

export async function bootstrap({ ctx, historyRuntime, interaction, loadingEl }) {
  const { store, persistence, pendingMessageMeta } = ctx
  const {
    applySpacingStyles,
    renderCurrentView,
    applyActiveMessage,
    renderStatus,
    layoutHistoryPane,
  } = historyRuntime

  // Disable browser scroll restoration - we'll handle scroll position ourselves
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual'
  }

  registerProvider('openai', createOpenAIAdapter())
  registerProvider('anthropic', createAnthropicAdapter())
  registerProvider('gemini', createGeminiAdapter())
  await persistence.init()
  ensureCatalogLoaded()
  applySpacingStyles(getSettings())

  // Restore persisted pending topic if available
  try {
    const savedPending = localStorage.getItem('maichat_pending_topic')
    if (savedPending && store.topics.has(savedPending)) pendingMessageMeta.topicId = savedPending
  } catch {}

  // One-time onboarding seeding (replaces demo seeding)
  try {
    if (shouldRunInitialSeeding(store)) runInitialSeeding({ store })
  } catch {}

  renderCurrentView()
  renderStatus()
  // Start focused at the last (newest) part on first load
  try {
    ctx.activeParts && ctx.activeParts.last && ctx.activeParts.last()
  } catch {}
  applyActiveMessage()

  if (!pendingMessageMeta.topicId) {
    // Prefer 'General talk' if present on first load; else root
    try {
      const match = Array.from(store.topics.values()).find(
        (t) => t.parentId === store.rootTopicId && t.name === 'General talk'
      )
      pendingMessageMeta.topicId = match ? match.id : store.rootTopicId
    } catch {
      pendingMessageMeta.topicId = store.rootTopicId
    }
  }
  try {
    localStorage.setItem('maichat_pending_topic', pendingMessageMeta.topicId)
  } catch {}

  interaction.renderPendingMeta()
  layoutHistoryPane()

  // Scroll to bottom AFTER layout completes
  try {
    const sc = ctx.scrollController
    if (sc && sc.scrollToBottom) {
      requestAnimationFrame(() => {
        sc.scrollToBottom(false)
        // Additional delayed scroll to catch async KaTeX rendering
        setTimeout(() => {
          sc.scrollToBottom(false)
        }, 100)
      })
    }
  } catch {}

  if (loadingEl) loadingEl.remove()

  // Startup: if no OpenAI key present, open API Keys overlay automatically
  try {
    const hasOpenAI = typeof getApiKey === 'function' ? !!getApiKey('openai') : false
    if (!hasOpenAI) {
      setTimeout(() => {
        try {
          openApiKeysOverlay({ onClose: () => {} })
        } catch {}
      }, 80)
    }
  } catch {}

  // Flush pending writes on unload (moved from main.js)
  window.addEventListener('beforeunload', () => {
    if (persistence && persistence.flush) persistence.flush()
  })
}
