import { describe, it, expect } from 'vitest'
import { buildMessages } from '../../src/features/compose/pipeline.js'

function makePair(id,u,a){ return { id, userText:u, assistantText:a } }

describe('buildMessages with empty new user text', () => {
  it('still returns prior history messages', () => {
    const pairs = [
      makePair(1,'Hello','World'),
      makePair(2,'How are','You')
    ]
    const msgs = buildMessages({ includedPairs: pairs, newUserText:'' })
    // Should contain 4 messages (user, assistant, user, assistant)
    expect(msgs.length).toBe(4)
    expect(msgs[0].role).toBe('user')
    expect(msgs[1].role).toBe('assistant')
  })
})
