// Moved from src/store/memoryStore.js (Phase 5 core move)
import { createMessagePair } from '../models/messagePair.js'
import { createTopic } from '../models/topic.js'
import { detach as detachImage } from '../../features/images/imageStore.js'
class Emitter {
  constructor() {
    this.listeners = {}
  }
  on(e, f) {
    ;(this.listeners[e] ||= []).push(f)
    return () => this.off(e, f)
  }
  off(e, f) {
    this.listeners[e] = (this.listeners[e] || []).filter((x) => x !== f)
  }
  emit(e, p) {
    ;(this.listeners[e] || []).forEach((fn) => fn(p))
  }
}
export class MemoryStore {
  constructor() {
    this.pairs = new Map()
    this.topics = new Map()
    this.children = new Map()
    this.emitter = new Emitter()
    this.rootTopicId = 'root'
    const root = createTopic({ id: this.rootTopicId, name: 'Root', parentId: null })
    root.directCount = 0
    root.totalCount = 0
    this.topics.set(this.rootTopicId, root)
    if (!this.children.has(null)) this.children.set(null, new Set())
    this.children.get(null).add(this.rootTopicId)
    this.emitter.emit('topic:add', root)
  }
  on(e, f) {
    return this.emitter.on(e, f)
  }
  addTopic(name, parentId, createdAt) {
    const id = crypto.randomUUID()
    const topic = createTopic({ id, name, parentId, createdAt: createdAt || Date.now() })
    // Copy-on-create system message inheritance: if parent has a custom systemMessage, inherit it.
    try {
      if (parentId) {
        const parent = this.topics.get(parentId)
        if (
          parent &&
          typeof parent.systemMessage === 'string' &&
          parent.systemMessage.trim().length > 0
        ) {
          topic.systemMessage = parent.systemMessage
        }
      }
    } catch {
      // Fail-safe: ignore inheritance errors silently.
    }
    topic.directCount = 0
    topic.totalCount = 0
    this.topics.set(id, topic)
    if (!this.children.has(parentId)) this.children.set(parentId, new Set())
    this.children.get(parentId).add(id)
    this.emitter.emit('topic:add', topic)
    return id
  }
  renameTopic(id, newName) {
    const t = this.topics.get(id)
    if (!t) return false
    t.name = newName
    this.emitter.emit('topic:update', t)
    return true
  }
  updateTopic(id, patch) {
    const t = this.topics.get(id)
    if (!t) return false
    const beforeParent = t.parentId
    Object.assign(t, patch)
    this.emitter.emit('topic:update', t)
    if (patch.parentId && patch.parentId !== beforeParent) {
      // keep children map in sync if parentId changed via patch
      const oldSet = this.children.get(beforeParent)
      if (oldSet) oldSet.delete(id)
      if (!this.children.has(patch.parentId)) this.children.set(patch.parentId, new Set())
      this.children.get(patch.parentId).add(id)
      this.emitter.emit('topic:move', { id, from: beforeParent, to: patch.parentId })
    }
    return true
  }
  deleteTopic(id) {
    if (id === this.rootTopicId) return false
    if (this.children.get(id)?.size) return false
    for (const p of this.pairs.values()) if (p.topicId === id) return false
    const topic = this.topics.get(id)
    if (!topic) return false
    const parentId = topic.parentId
    const existed = this.topics.delete(id)
    if (existed) {
      const set = this.children.get(parentId)
      if (set) set.delete(id)
      this.children.delete(id)
      this.emitter.emit('topic:delete', id)
      this.recalculateTopicCounts()
    }
    return !!existed
  }

  addMessagePair({ topicId, model, userText, assistantText }) {
    const id = crypto.randomUUID()
    const pair = createMessagePair({ id, topicId, model, userText, assistantText })

    // Note: Code processing now happens in interaction.js for new responses
    // Initial creation may not have assistantText yet, so no processing needed here

    this.pairs.set(id, pair)
    this.emitter.emit('pair:add', pair)
    this._incrementCountsForTopic(topicId)
    this._bumpLastActiveForTopic(topicId, pair.createdAt)
    return id
  }
  updatePair(id, patch) {
    const existing = this.pairs.get(id)
    if (!existing) return false
    const oldTopicId = existing.topicId
    const beforeCreatedAt = existing.createdAt
    // Track potential text changes to invalidate token cache
    const beforeUser = existing.userText
    const beforeAssistant = existing.assistantText
    Object.assign(existing, patch)

    // Note: Code processing now happens in interaction.js before sanitization

    this.emitter.emit('pair:update', existing)
    // Invalidate per-pair token cache if text changed
    try {
      if (
        (Object.prototype.hasOwnProperty.call(patch, 'userText') && patch.userText !== beforeUser) ||
        (Object.prototype.hasOwnProperty.call(patch, 'assistantText') && patch.assistantText !== beforeAssistant)
      ) {
        if (existing._tokenCache) delete existing._tokenCache
      }
    } catch {}
    if (patch.topicId && patch.topicId !== oldTopicId) {
      this._decrementCountsForTopic(oldTopicId)
      this._incrementCountsForTopic(existing.topicId)
      this._bumpLastActiveForTopic(existing.topicId, existing.createdAt)
      this._recalcLastActiveForTopicSubtree(oldTopicId)
    } else if (patch.createdAt && patch.createdAt !== beforeCreatedAt) {
      this._bumpLastActiveForTopic(existing.topicId, existing.createdAt)
    }
    return true
  }
  removePair(id, skipImageCleanup = false) {
    const pair = this.pairs.get(id)
    if (!pair) return false

    // Clean up image attachments (direct delete, no refCount) unless skipped (edit-resend transfer)
    if (!skipImageCleanup && Array.isArray(pair.attachments) && pair.attachments.length > 0) {
      for (const imageId of pair.attachments) {
        detachImage(imageId).catch((e) => {
          console.warn('[store] failed to detach image on pair removal', imageId, e)
        })
      }
    }

    this.pairs.delete(id)
    this._decrementCountsForTopic(pair.topicId)
    this._recalcLastActiveForTopicSubtree(pair.topicId)
    this.emitter.emit('pair:delete', id)
    return true
  }
  getAllPairs() {
    return Array.from(this.pairs.values())
  }
  getAllTopics() {
    return Array.from(this.topics.values())
  }
  _importTopic(topic) {
    if (!this.topics.has(topic.id)) {
      if (typeof topic.directCount !== 'number') topic.directCount = 0
      if (typeof topic.totalCount !== 'number') topic.totalCount = 0
      // Backfill ordering/aggregate fields
      if (typeof topic.sortIndex !== 'number') topic.sortIndex = topic.createdAt || Date.now()
      if (typeof topic.lastActiveAt !== 'number') topic.lastActiveAt = 0
      // Backfill new fields for legacy topics
      if (typeof topic.systemMessage !== 'string')
        topic.systemMessage =
          'You are MaiChat Assistant for this topic. Be concise and ask clarifying questions when needed.'
      if (typeof topic.requestParams !== 'object' || !topic.requestParams) topic.requestParams = {}
      if (typeof topic.requestParams.temperature === 'number') {
        topic.requestParams.temperature = Math.max(0, Math.min(2, topic.requestParams.temperature))
      }
      if (typeof topic.requestParams.maxOutputTokens === 'number') {
        const v = Math.floor(topic.requestParams.maxOutputTokens)
        topic.requestParams.maxOutputTokens = v > 0 ? v : undefined
      }
      this.topics.set(topic.id, topic)
      if (!this.children.has(topic.parentId)) this.children.set(topic.parentId, new Set())
      this.children.get(topic.parentId).add(topic.id)
      this.emitter.emit('topic:add', topic)
    }
  }
  _importPair(pair) {
    if (!this.pairs.has(pair.id)) {
      // Backfill new fields for legacy pairs
      if (!Array.isArray(pair.attachments)) pair.attachments = []
      this.pairs.set(pair.id, pair)
      this.emitter.emit('pair:add', pair)
    }
  }
  moveTopic(topicId, newParentId) {
    if (topicId === this.rootTopicId) return false
    const topic = this.topics.get(topicId)
    if (!topic) return false
    if (newParentId && this._isDescendant(newParentId, topicId)) return false
    const oldParent = topic.parentId
    if (oldParent === newParentId) return true
    const oldSet = this.children.get(oldParent)
    if (oldSet) oldSet.delete(topicId)
    if (!this.children.has(newParentId)) this.children.set(newParentId, new Set())
    this.children.get(newParentId).add(topicId)
    topic.parentId = newParentId
    this.emitter.emit('topic:move', { id: topicId, from: oldParent, to: newParentId })
    this.recalculateTopicCounts()
    return true
  }
  _isDescendant(maybeChildId, ancestorId) {
    let cur = this.topics.get(maybeChildId)
    while (cur) {
      if (cur.id === ancestorId) return true
      cur = cur.parentId ? this.topics.get(cur.parentId) : null
    }
    return false
  }
  recalculateTopicCounts() {
    for (const t of this.topics.values()) {
      t.directCount = 0
      t.totalCount = 0
    }
    for (const p of this.pairs.values()) {
      const topic = this.topics.get(p.topicId)
      if (!topic) continue
      topic.directCount++
    }
    for (const t of this.topics.values()) t.totalCount = t.directCount
    for (const t of this.topics.values()) {
      let cur = t.parentId ? this.topics.get(t.parentId) : null
      while (cur) {
        cur.totalCount += t.directCount
        cur = cur.parentId ? this.topics.get(cur.parentId) : null
      }
    }
    this.emitter.emit('topic:counts')
  }
  rebuildLastActiveAt() {
    for (const t of this.topics.values()) {
      t.lastActiveAt = 0
    }
    // For each pair, set topic's lastActiveAt to max of direct pairs
    for (const p of this.pairs.values()) {
      const t = this.topics.get(p.topicId)
      if (t) t.lastActiveAt = Math.max(t.lastActiveAt || 0, p.createdAt || 0)
    }
    // Propagate upward: parent gets max of children and its own
    // We do a simple multi-pass until convergence. Depth is small.
    let changed = true
    let guard = 0
    while (changed && guard++ < 20) {
      changed = false
      for (const t of this.topics.values()) {
        let maxVal = t.lastActiveAt || 0
        const kids = this.children.get(t.id)
        if (kids) {
          for (const cid of kids) {
            const ct = this.topics.get(cid)
            if (ct) maxVal = Math.max(maxVal, ct.lastActiveAt || 0)
          }
        }
        if (maxVal !== (t.lastActiveAt || 0)) {
          t.lastActiveAt = maxVal
          changed = true
        }
      }
    }
    this.emitter.emit('topic:lastActive')
  }
  _bumpLastActiveForTopic(topicId, ts) {
    if (!Number.isFinite(ts)) return
    let cur = this.topics.get(topicId)
    if (!cur) return
    if ((cur.lastActiveAt || 0) < ts) {
      cur.lastActiveAt = ts
    }
    while (cur.parentId) {
      cur = this.topics.get(cur.parentId)
      if (!cur) break
      if ((cur.lastActiveAt || 0) < ts) cur.lastActiveAt = ts
      else break
    }
  }
  _recalcLastActiveForTopicSubtree(topicId) {
    // when decreasing activity (delete or move away)
    // Recompute exact subtree max, then propagate upward exact max of children
    const t = this.topics.get(topicId)
    if (!t) return
    const subtreeMax = (id) => {
      const node = this.topics.get(id)
      if (!node) return 0
      let maxv = 0 // own direct pairs
      for (const p of this.pairs.values()) {
        if (p.topicId === id) maxv = Math.max(maxv, p.createdAt || 0)
      }
      const kids = this.children.get(id)
      if (kids) {
        for (const cid of kids) {
          maxv = Math.max(maxv, subtreeMax(cid))
        }
      }
      return maxv
    }
    const newVal = subtreeMax(topicId)
    const node = this.topics.get(topicId)
    if (node) node.lastActiveAt = newVal
    // propagate to ancestors: each is max of their children (and own direct)
    let cur = node && node.parentId ? this.topics.get(node.parentId) : null
    while (cur) {
      let maxv = 0
      const kids = this.children.get(cur.id)
      if (kids) {
        for (const cid of kids) {
          const ct = this.topics.get(cid)
          if (ct) maxv = Math.max(maxv, ct.lastActiveAt || 0)
        }
      }
      for (const p of this.pairs.values()) {
        if (p.topicId === cur.id) maxv = Math.max(maxv, p.createdAt || 0)
      }
      cur.lastActiveAt = maxv
      cur = cur.parentId ? this.topics.get(cur.parentId) : null
    }
    this.emitter.emit('topic:lastActive')
  }
  _incrementCountsForTopic(topicId) {
    let cur = this.topics.get(topicId)
    if (!cur) return
    cur.directCount++
    cur.totalCount++
    while (cur.parentId) {
      cur = this.topics.get(cur.parentId)
      if (!cur) break
      cur.totalCount++
    }
  }
  _decrementCountsForTopic(topicId) {
    let cur = this.topics.get(topicId)
    if (!cur) return
    cur.directCount = Math.max(0, cur.directCount - 1)
    cur.totalCount = Math.max(0, cur.totalCount - 1)
    while (cur.parentId) {
      cur = this.topics.get(cur.parentId)
      if (!cur) break
      cur.totalCount = Math.max(0, cur.totalCount - 1)
    }
  }
  getTopicPath(topicId) {
    const parts = []
    let cur = this.topics.get(topicId)
    while (cur) {
      parts.push(cur.name)
      cur = cur.parentId ? this.topics.get(cur.parentId) : null
    }
    return parts.reverse()
  }
}
export function createStore() {
  return new MemoryStore()
}
