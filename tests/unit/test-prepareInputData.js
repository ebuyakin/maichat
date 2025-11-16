// Test for prepareInputData

import { describe, it, expect, beforeEach } from 'vitest'
import { prepareInputData } from '../../src/features/newMessage/prepareInputData.js'

describe('prepareInputData', () => {
  let mockStore
  
  beforeEach(() => {
    mockStore = {
      topics: new Map([
        ['topic1', { id: 'topic1', systemMessage: '  You are helpful  ' }],
        ['topic2', { id: 'topic2', systemMessage: '' }],
      ]),
      pairs: new Map([
        ['pair1', { id: 'pair1', createdAt: 100, userText: 'Hello', assistantText: 'Hi' }],
        ['pair2', { id: 'pair2', createdAt: 200, userText: 'How are you?', assistantText: 'Good' }],
        ['pair3', { id: 'pair3', createdAt: 150, userText: 'What?', assistantText: 'Yes' }],
      ])
    }
  })
  
  it('should get system message and trim it', () => {
    const result = prepareInputData({
      topicId: 'topic1',
      visiblePairIds: [],
      model: 'gpt-4',
      store: mockStore,
    })
    
    expect(result.systemMessage).toBe('You are helpful')
  })
  
  it('should handle missing system message', () => {
    const result = prepareInputData({
      topicId: 'topic2',
      visiblePairIds: [],
      model: 'gpt-4',
      store: mockStore,
    })
    
    expect(result.systemMessage).toBe('')
  })
  
  it('should convert pair IDs to pairs and sort chronologically', () => {
    const result = prepareInputData({
      topicId: 'topic1',
      visiblePairIds: ['pair2', 'pair1', 'pair3'],
      model: 'gpt-4',
      store: mockStore,
    })
    
    expect(result.visiblePairs).toHaveLength(3)
    expect(result.visiblePairs[0].id).toBe('pair1') // createdAt: 100
    expect(result.visiblePairs[1].id).toBe('pair3') // createdAt: 150
    expect(result.visiblePairs[2].id).toBe('pair2') // createdAt: 200
  })
  
  it('should filter out invalid pair IDs', () => {
    const result = prepareInputData({
      topicId: 'topic1',
      visiblePairIds: ['pair1', 'invalid', 'pair2'],
      model: 'gpt-4',
      store: mockStore,
    })
    
    expect(result.visiblePairs).toHaveLength(2)
    expect(result.visiblePairs[0].id).toBe('pair1')
    expect(result.visiblePairs[1].id).toBe('pair2')
  })
  
  it('should deduplicate pair IDs', () => {
    const result = prepareInputData({
      topicId: 'topic1',
      visiblePairIds: ['pair1', 'pair2', 'pair1', 'pair2'],
      model: 'gpt-4',
      store: mockStore,
    })
    
    expect(result.visiblePairs).toHaveLength(2)
  })
  
  it('should return settings and provider', () => {
    const result = prepareInputData({
      topicId: 'topic1',
      visiblePairIds: [],
      model: 'gpt-4',
      store: mockStore,
    })
    
    expect(result.settings).toBeDefined()
    expect(result.provider).toBeDefined()
  })
})
