import { describe, it, expect } from 'vitest'
import { createStore } from '../../src/store/memoryStore.js'
import { createIndexedDbAdapter } from '../../src/store/indexedDbAdapter.js'
import { attachContentPersistence } from '../../src/core/persistence/contentPersistence.js'

// NOTE: IndexedDB not available in Vitest node env by default; this test will be a placeholder until jsdom or polyfill.
// For now we assert the persistence object wires without throwing when adapter mocked.

class MockAdapter {
  constructor(){ this.pairs=[]; this.topics=[]; this.meta=new Map(); }
  async init(){}
  async getAllPairs(){ return this.pairs }
  async getAllTopics(){ return this.topics }
  async savePair(p){ const i=this.pairs.findIndex(x=>x.id===p.id); if(i<0) this.pairs.push(p); else this.pairs[i]=p }
  async saveTopic(t){ const i=this.topics.findIndex(x=>x.id===t.id); if(i<0) this.topics.push(t); else this.topics[i]=t }
  async deleteTopic(id){ this.topics = this.topics.filter(t=>t.id!==id) }
  async saveMeta(r){ this.meta.set(r.name, r) }
  async getMeta(name){ return this.meta.get(name) }
}

describe('content persistence wiring', () => {
  it('loads and flushes', async () => {
    const store = createStore()
    const adapter = new MockAdapter()
    const persist = attachContentPersistence(store, adapter)
    await persist.init()
    // add pair -> flush
    const id = store.addMessagePair({ topicId: store.rootTopicId, model:'gpt', userText:'u', assistantText:'a' })
    await persist.flush()
    expect(adapter.pairs.some(p=>p.id===id)).toBe(true)
  })
})
