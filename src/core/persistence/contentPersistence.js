// Moved from src/persistence/contentPersistence.js (Phase 5 core move)
const SCHEMA_VERSION = 1
export class ContentPersistence {
  constructor(store, { adapter, debounceMs = 200 } = {}) {
    this.store = store
    this.adapter = adapter
    this.debounceMs = debounceMs
    this._pairQueue = new Set()
    this._topicQueue = new Set()
    this._timer = null
    this._wired = false
  }
  async init() {
    await this.adapter.init()
    await this._ensureSchema()
    const topics = await this.adapter.getAllTopics()
    const pairs = await this.adapter.getAllPairs()
    const stableRootId = this.store.rootTopicId
    const legacyRootIds = new Set()
    for (const t of topics) {
      if (t.id === stableRootId) continue
      if (t.parentId === null && t.name === 'Root') {
        legacyRootIds.add(t.id)
        continue
      }
      this.store._importTopic(t)
    }
    if (legacyRootIds.size) {
      for (const t of this.store.topics.values()) {
        if (legacyRootIds.has(t.parentId)) t.parentId = stableRootId
      }
      this.store.children = new Map()
      for (const topic of this.store.topics.values()) {
        const pid = topic.parentId
        if (!this.store.children.has(pid)) this.store.children.set(pid, new Set())
        this.store.children.get(pid).add(topic.id)
      }
    }
    for (const p of pairs) {
      if (!('colorFlag' in p)) {
        const legacy = p.includeInContext !== undefined ? p.includeInContext : p.includeContext
        p.colorFlag = legacy ? 'b' : 'g'
      }
      if ('includeInContext' in p) delete p.includeInContext
      if ('includeContext' in p) delete p.includeContext
      this.store._importPair(p)
    }
    // Post-load aggregate rebuilds (counts now; lastActiveAt to follow when implemented)
    if (typeof this.store.recalculateTopicCounts === 'function') {
      try {
        this.store.recalculateTopicCounts()
      } catch {}
    }
    if (typeof this.store.rebuildLastActiveAt === 'function') {
      try {
        this.store.rebuildLastActiveAt()
      } catch {}
    }
    this._wire()
    for (const t of this.store.topics.values()) this._topicQueue.add(t.id)
    for (const p of this.store.pairs.values()) this._pairQueue.add(p.id)
    this._schedule()
  }
  async _ensureSchema() {
    const existing = await this.adapter.getMeta('schemaVersion')
    if (!existing) await this.adapter.saveMeta({ name: 'schemaVersion', value: SCHEMA_VERSION })
  }
  _wire() {
    if (this._wired) return
    this._wired = true
    this.store.on('pair:add', (p) => {
      this._pairQueue.add(p.id)
      this._schedule()
    })
    this.store.on('pair:update', (p) => {
      this._pairQueue.add(p.id)
      this._schedule()
    })
    this.store.on('pairs:bulk-update', async (pairs) => {
      await this.adapter.savePairsBulk(pairs)
    })
    this.store.on('pair:delete', (id) => {
      this.adapter.deletePair(id)
    })
    this.store.on('topic:add', (t) => {
      this._topicQueue.add(t.id)
      this._schedule()
    })
    this.store.on('topic:update', (t) => {
      this._topicQueue.add(t.id)
      this._schedule()
    })
    this.store.on('topic:delete', (id) => {
      this.adapter.deleteTopic(id)
    })
  }
  _schedule() {
    if (this.debounceMs === 0) {
      this.flush()
      return
    }
    if (this._timer) return
    this._timer = setTimeout(() => {
      this._timer = null
      this.flush()
    }, this.debounceMs)
  }
  async flush() {
    const pairIds = [...this._pairQueue]
    const topicIds = [...this._topicQueue]
    this._pairQueue.clear()
    this._topicQueue.clear()
    for (const id of topicIds) {
      const topic = this.store.topics.get(id)
      if (topic) await this.adapter.saveTopic(topic)
    }
    for (const id of pairIds) {
      const pair = this.store.pairs.get(id)
      if (pair) await this.adapter.savePair(pair)
    }
  }
}
export function attachContentPersistence(store, adapter, opts) {
  return new ContentPersistence(store, { adapter, ...(opts || {}) })
}
