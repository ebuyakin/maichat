import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createStore } from '../../src/core/store/memoryStore.js'
import { runInitialSeeding, shouldRunInitialSeeding } from '../../src/runtime/initialSeeding.js'

function resetSeedFlag(){ try { localStorage.removeItem('maichat.seed.version') } catch {} }

describe('initial seeding', ()=>{
  beforeEach(()=>{
    // Minimal localStorage mock for Node test env
    if(typeof globalThis.localStorage === 'undefined'){
      globalThis.localStorage = {
        _s: new Map(),
        getItem: vi.fn((k)=> globalThis.localStorage._s.has(k) ? globalThis.localStorage._s.get(k) : null),
        setItem: vi.fn((k,v)=>{ globalThis.localStorage._s.set(k, String(v)) }),
        removeItem: vi.fn((k)=>{ globalThis.localStorage._s.delete(k) })
      }
    }
    resetSeedFlag()
  })

  it('runs only when no pairs and seed version not set', ()=>{
    const store = createStore()
    expect(shouldRunInitialSeeding(store)).toBe(true)
    const ran = runInitialSeeding({ store })
    expect(ran).toBe(true)
    expect(store.getAllPairs().length).toBe(1)
    expect(store.getAllTopics().length).toBeGreaterThan(1)
    // second run should be skipped
    expect(shouldRunInitialSeeding(store)).toBe(false)
  })

  it('does not run when pairs exist', ()=>{
    const store = createStore()
    store.addMessagePair({ topicId: store.rootTopicId, model:'gpt-4o-mini', userText:'u', assistantText:'a' })
    expect(shouldRunInitialSeeding(store)).toBe(false)
    const ran = runInitialSeeding({ store })
    expect(ran).toBe(false)
  })
})
