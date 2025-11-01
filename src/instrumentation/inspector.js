// instrumentation/inspector.js

// Console-only helpers to inspect message records directly from IndexedDB.
// Non-intrusive: no event listeners, no app state changes.

import { getMany as getImagesByIds } from '../features/images/imageStore.js'

function safeImageMeta(rec) {
  if (!rec) return null
  return {
    id: rec.id,
    w: rec.w,
    h: rec.h,
    bytes: rec.bytes || (rec.blob ? rec.blob.size : undefined),
    format: rec.format || (rec.blob ? rec.blob.type : undefined),
    // blob intentionally omitted by default to avoid spamming the console
  }
}

export function registerInspector(ctx) {
  if (!ctx || !ctx.persistence) return
  const adapter = ctx.persistence && ctx.persistence.adapter
  if (!adapter) return

  async function fetchPairById(pairId) {
    await adapter.init?.()
    const pairs = await adapter.getAllPairs()
    return pairs.find((p) => p && p.id === pairId) || null
  }
  async function fetchTopicById(topicId) {
    await adapter.init?.()
    const topics = await adapter.getAllTopics()
    return topics.find((t) => t && t.id === topicId) || null
  }

  async function inspectByPairId(pairId, opts = {}) {
    const { includeBlobs = false } = opts
    const pair = await fetchPairById(pairId)
    if (!pair) return { pairId, error: 'pair_not_found' }
    const topic = pair.topicId ? await fetchTopicById(pair.topicId) : null
    let attachments = null
    try {
      if (Array.isArray(pair.attachments) && pair.attachments.length) {
        const recs = await getImagesByIds(pair.attachments)
        attachments = includeBlobs ? recs : recs.map(safeImageMeta)
      }
    } catch (e) {
      attachments = { error: String(e && e.message || e) }
    }
    return { pairId, pair, topic, attachments }
  }

  async function inspectActive(opts = {}) {
    const act = ctx.activeParts && ctx.activeParts.active && ctx.activeParts.active()
    const pid = act && act.pairId
    if (!pid) return { error: 'no_active_message' }
    return inspectByPairId(pid, opts)
  }

  // Expose small, documented surface on window (non-enumerable to stay out of the way)
  try {
    Object.defineProperty(window, 'inspectActiveMessage', {
      value: inspectActive,
      configurable: true,
      writable: false,
      enumerable: false,
    })
    Object.defineProperty(window, 'inspectPair', {
      value: inspectByPairId,
      configurable: true,
      writable: false,
      enumerable: false,
    })
  } catch {}

  return { inspectActiveMessage: inspectActive, inspectPair: inspectByPairId }
}
