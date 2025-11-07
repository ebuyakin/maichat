// runtime/bootstrap.js (Step 7)
// Orchestrates startup sequence: provider registration, persistence init, model catalog load,
// spacing styles, optional seeding, first render, loading overlay removal, and beforeunload flush.
// ZERO behavioral changes.

import { registerProvider } from '../infrastructure/provider/adapter.js'
import { createOpenAIAdapter } from '../infrastructure/provider/openaiAdapter.js'
import { createAnthropicAdapter } from '../infrastructure/provider/anthropicAdapter.js'
import { createGeminiAdapter } from '../infrastructure/provider/geminiAdapter.js'
import { createGrokAdapter } from '../infrastructure/provider/grokAdapter.js'
import { ensureCatalogLoaded } from '../core/models/modelCatalog.js'
import { runInitialSeeding, shouldRunInitialSeeding } from './initialSeeding.js'
import { loadCommandHistory, getFilterActive } from '../features/interaction/userPrefs.js'
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

export async function bootstrap({ ctx, historyRuntime, interaction, loadingEl, skipPersistenceInit = false, skipInitialRender = false }) {
  const { store, persistence, pendingMessageMeta, lifecycle } = ctx
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
  registerProvider('grok', createGrokAdapter())
  if (!skipPersistenceInit) {
    await persistence.init()
  }
  ensureCatalogLoaded()
  applySpacingStyles(getSettings())

  // Restore persisted pending topic if available
  try {
    const savedPending = localStorage.getItem('maichat_pending_topic')
    if (savedPending && store.topics.has(savedPending)) pendingMessageMeta.topicId = savedPending
  } catch {}

  // One-time onboarding seeding (replaces demo seeding)
  let __seeded = false
  try {
    if (shouldRunInitialSeeding(store)) __seeded = !!runInitialSeeding({ store })
  } catch {}

  // Check for stored filter - if exists, set it BEFORE rendering
  const filterActive = getFilterActive()
  const commandHistory = loadCommandHistory()
  const storedFilter = filterActive && commandHistory.length > 0 
    ? commandHistory[commandHistory.length - 1] 
    : null

  if (!skipInitialRender) {
    if (storedFilter) {
      // Restore filter BEFORE rendering (single render with filter applied)
      lifecycle.setFilterQuery(storedFilter)
      const commandInput = document.getElementById('commandInput')
      if (commandInput) commandInput.value = storedFilter
      renderCurrentView({ preserveActive: false })
    } else {
      // No filter - normal render
      renderCurrentView()
    }
  } else if (storedFilter || __seeded) {
    // We performed an initial render already. If a stored filter exists, apply it;
    // if we just seeded, ensure a single render so the welcome pair appears on first load.
    if (storedFilter) {
      lifecycle.setFilterQuery(storedFilter)
      const commandInput = document.getElementById('commandInput')
      if (commandInput) commandInput.value = storedFilter
    }
    renderCurrentView({ preserveActive: false })
  }

  renderStatus()
  
  // Set active to last message (both cases)
  try {
    ctx.activeParts && ctx.activeParts.last && ctx.activeParts.last()
  } catch {}
  applyActiveMessage()

  if (!pendingMessageMeta.topicId) {
    // Prefer 'General' if present on first load; else root
    try {
      const match = Array.from(store.topics.values()).find(
        (t) => t.parentId === store.rootTopicId && t.name === 'General'
      )
      pendingMessageMeta.topicId = match ? match.id : store.rootTopicId
    } catch {
      pendingMessageMeta.topicId = store.rootTopicId
    }
  }
    if (!pendingMessageMeta.topicId) {
      // Pre-seed: try to pick General if it already exists (rare on first paint)
      try {
        const match = Array.from(store.topics.values()).find(
          (t) => t.parentId === store.rootTopicId && t.name === 'General'
        )
        if (match) pendingMessageMeta.topicId = match.id
      } catch {}
    }
    // After seeding, ensure pending topic is a valid top-level topic (never Root)
    try {
      const id = pendingMessageMeta.topicId
      const invalid = !id || id === store.rootTopicId || !store.topics.has(id)
      if (invalid) {
        // Prefer 'General'; else first top-level topic
        const all = Array.from(store.topics.values())
        const general = all.find((t) => t.parentId === store.rootTopicId && t.name === 'General')
        const firstTop = general || all.find((t) => t.parentId === store.rootTopicId)
        if (firstTop) pendingMessageMeta.topicId = firstTop.id
      }
    } catch {}
  try {
    localStorage.setItem('maichat_pending_topic', pendingMessageMeta.topicId)
  } catch {}

  interaction.renderPendingMeta()
  layoutHistoryPane()

  // Scroll to bottom AFTER layout completes (both cases)
  try {
    const sc = ctx.scrollController
    if (sc && sc.scrollToBottom) {
      requestAnimationFrame(() => {
        sc.scrollToBottom(false)
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
