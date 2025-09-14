import { describe, it, expect } from 'vitest'
import { createStore } from '../../src/core/store/memoryStore.js'
import { attachIndexes } from '../../src/core/store/indexes.js'

describe('indexes', () => {
  it('builds and updates indexes', () => {
    const store = createStore()
    const idx = attachIndexes(store)
    const t = store.rootTopicId
    const id1 = store.addMessagePair({ topicId:t, model:'gpt', userText:'u1', assistantText:'a1' })
    const id2 = store.addMessagePair({ topicId:t, model:'claude', userText:'u2', assistantText:'a2' })
    expect(idx.getByModel('gpt').length).toBeGreaterThan(0)
  store.updatePair(id1, { star:2, colorFlag:'g' })
    expect(idx.getByStar(2).some(p=>p.id===id1)).toBe(true)
  expect(idx.getGrey().some(p=>p.id===id1)).toBe(true)
  })
})
