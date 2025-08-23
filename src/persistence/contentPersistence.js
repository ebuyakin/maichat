// Content persistence orchestration: loads from adapter and persists incremental mutations.

/** Adapter interface expectations:
 * init()
 * getAllPairs() -> Promise<array>
 * getAllTopics() -> Promise<array>
 * savePair(pair)
 * saveTopic(topic)
 * deleteTopic(id)
 * saveMeta(record) { name, value }
 * getMeta(name)
 */

const SCHEMA_VERSION = 1

export class ContentPersistence {
  /**
   * @param {import('../store/memoryStore.js').MemoryStore} store
   * @param {object} opts
   * @param {any} opts.adapter IndexedDB adapter
   * @param {number} [opts.debounceMs=200]
   */
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
    // load topics & pairs into store (skip if already have user-added beyond root?)
    const topics = await this.adapter.getAllTopics()
    const pairs = await this.adapter.getAllPairs()
    // Add topics except existing root; we assume root always present in store.
    const rootId = this.store.rootTopicId
    for (const t of topics) {
      if (t.id === rootId) continue
      this.store._importTopic(t) // internal import bypassing new id generation
    }
    for (const p of pairs) {
      this.store._importPair(p)
    }
    this._wire()
  }

  async _ensureSchema(){
    const existing = await this.adapter.getMeta('schemaVersion')
    if(!existing){
      await this.adapter.saveMeta({ name:'schemaVersion', value: SCHEMA_VERSION })
    } else if(existing.value !== SCHEMA_VERSION){
      // future migrations here
    }
  }

  _wire(){
    if(this._wired) return
    this._wired = true
    this.store.on('pair:add', p=> { this._pairQueue.add(p.id); this._schedule() })
    this.store.on('pair:update', p=> { this._pairQueue.add(p.id); this._schedule() })
    this.store.on('topic:add', t=> { this._topicQueue.add(t.id); this._schedule() })
    this.store.on('topic:update', t=> { this._topicQueue.add(t.id); this._schedule() })
    this.store.on('topic:delete', id=> { this.adapter.deleteTopic(id) })
  }

  _schedule(){
    if(this.debounceMs === 0){ this.flush(); return }
    if(this._timer) return
    this._timer = setTimeout(()=>{ this._timer = null; this.flush() }, this.debounceMs)
  }

  async flush(){
    const pairIds = Array.from(this._pairQueue)
    const topicIds = Array.from(this._topicQueue)
    this._pairQueue.clear(); this._topicQueue.clear()
    for(const id of topicIds){
      const topic = this.store.topics.get(id)
      if(topic) await this.adapter.saveTopic(topic)
    }
    for(const id of pairIds){
      const pair = this.store.pairs.get(id)
      if(pair) await this.adapter.savePair(pair)
    }
  }
}

export function attachContentPersistence(store, adapter, opts){
  const cp = new ContentPersistence(store, { adapter, ...(opts||{}) })
  return cp
}