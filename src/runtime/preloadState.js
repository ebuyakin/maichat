// preloadState.js
// Loads all state needed for first paint (settings, draft, metadata, history).
// Extracted from main.js to isolate data loading logic from orchestration.

import { getSettings } from '../core/settings/index.js'
import { getActiveModel } from '../core/models/modelCatalog.js'

/**
 * Read draft state from localStorage
 * @returns {Object} Draft text and attachment IDs
 */
function readDraftState() {
  let text = ''
  let attachments = []
  try {
    const t = localStorage.getItem('maichat_draft_text')
    if (typeof t === 'string') text = t
  } catch {}
  try {
    const a = localStorage.getItem('maichat_draft_attachments')
    if (a) {
      const parsed = JSON.parse(a)
      if (Array.isArray(parsed)) attachments = parsed.filter((x) => typeof x === 'string')
    }
  } catch {}
  return { text, attachments }
}

/**
 * Read pending metadata (topic, model) from localStorage
 * @param {Object} store - Memory store instance
 * @returns {Object} Pending topic ID, model, and formatted topic path
 */
function readPendingMeta(store) {
  let topicId = null
  let model = null

  // Read persisted values
  try {
    const saved = localStorage.getItem('maichat_pending_topic')
    if (saved && store.topics.has(saved)) topicId = saved
  } catch {}

  try {
    const saved = localStorage.getItem('maichat_pending_model')
    if (saved) model = saved
  } catch {}

  // Fallback to defaults if not found
  if (!topicId) {
    // Prefer 'General talk' if present; else root
    try {
      const match = Array.from(store.topics.values()).find(
        (t) => t.parentId === store.rootTopicId && t.name === 'General talk'
      )
      topicId = match ? match.id : store.rootTopicId
    } catch {
      topicId = store.rootTopicId
    }
  }

  if (!model) {
    model = getActiveModel() || 'gpt-5-mini'
  }

  // Format topic path for display
  let topicPath = ''
  try {
    const topic = store.topics.get(topicId)
    if (topic) {
      const parts = store.getTopicPath(topicId)
      if (parts[0] === 'Root') parts.shift()
      topicPath = parts.join(' > ')
    }
  } catch {}

  return { topicId, model, topicPath }
}

/**
 * Apply spacing CSS variables from settings to prevent layout shift
 * @param {Object} settings - Settings object from getSettings()
 */
function applySpacingVars(settings) {
  if (!settings) return
  try {
    const root = document.documentElement.style
    const s = settings
    
    // Set all spacing vars that affect layout
    if (typeof s.gutterLPx === 'number') root.setProperty('--gutter-l', s.gutterLPx + 'px')
    if (typeof s.gutterRPx === 'number') root.setProperty('--gutter-r', s.gutterRPx + 'px')
    if (typeof s.historyBgLightness === 'number') {
      root.setProperty('--history-bg', `hsl(0, 0%, ${s.historyBgLightness}%)`)
    }
    if (typeof s.messagePaddingPx === 'number') root.setProperty('--message-padding', s.messagePaddingPx + 'px')
    if (typeof s.fadeZonePx === 'number') root.setProperty('--fade-zone', s.fadeZonePx + 'px')
    if (typeof s.messageGapPx === 'number') root.setProperty('--message-gap', s.messageGapPx + 'px')
    if (typeof s.assistantGapPx === 'number') root.setProperty('--assistant-gap', s.assistantGapPx + 'px')
    if (typeof s.metaGapPx === 'number') root.setProperty('--meta-gap', s.metaGapPx + 'px')
    
    const baseFadeMs = Math.max(s.fadeInMs || 0, s.fadeOutMs || 0, s.fadeTransitionMs || 0)
    if (baseFadeMs > 0) root.setProperty('--fade-transition-ms', baseFadeMs + 'ms')
  } catch (e) {
    console.warn('[preloadState] Failed to apply spacing vars:', e)
  }
}

/**
 * Preload all state needed for single-paint rendering
 * Reads settings, draft, pending metadata, and optionally history count
 * 
 * @param {Object} store - Memory store instance (from initRuntime)
 * @param {Object} options - Preload options
 * @param {boolean} options.loadHistoryCount - Whether to count messages (requires async IndexedDB read)
 * @returns {Promise<Object>} Complete state for buildAppHTML
 */
export async function preloadState(store, { loadHistoryCount = false } = {}) {
  // 1. Load and apply settings (prevents layout shift)
  const settings = getSettings()
  applySpacingVars(settings)

  // 2. Read draft state
  const draft = readDraftState()

  // 3. Read pending metadata (topic, model)
  const pendingMeta = readPendingMeta(store)

  // 4. Message count (synchronous from store if already loaded, or 0 as placeholder)
  let messageCount = 0
  let messagePosition = '-'
  
  if (loadHistoryCount && store.pairs) {
    messageCount = store.pairs.size
    // Position will be updated after active message is set (post-render)
  }

  return {
    draftText: draft.text,
    attachCount: draft.attachments.length,
    attachmentIds: draft.attachments, // For runtime hydration
    pendingModel: pendingMeta.model,
    pendingTopic: pendingMeta.topicPath,
    pendingTopicId: pendingMeta.topicId, // For runtime hydration
    messageCount,
    messagePosition,
  }
}
