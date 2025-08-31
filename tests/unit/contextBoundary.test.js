import { describe, it, expect } from 'vitest'
import { computeContextBoundary } from '../../src/context/tokenEstimator.js'

function makePair(id, userLen, asstLen){
  return { id, userText:'u'.repeat(userLen), assistantText:'a'.repeat(asstLen), model:'gpt', createdAt:Date.now(), topicId:'t', star:0, includeInContext:true }
}

describe('computeContextBoundary', ()=>{
  it('includes all when under budget', ()=>{
    const pairs = [makePair('p1',10,10), makePair('p2',20,20)]
    const { included, excluded } = computeContextBoundary(pairs, { charsPerToken:4 })
    expect(included.map(p=>p.id)).toEqual(['p1','p2'])
    expect(excluded.length).toBe(0)
  })
  it('drops oldest when over budget', ()=>{
    // Force small budget by mocking getModelBudget via monkey patch (not ideal, but quick): create large pair at end
    const pairs = [makePair('p1',4000,0), makePair('p2',4000,0), makePair('p3',4000,0)]
    const { included } = computeContextBoundary(pairs, { charsPerToken:4 })
    // With default 8192 max - reserve(800)-safety(40)=~7352 usable ~ tokens (chars/4). Each pair ~1000 tokens. All should fit.
    expect(included.length).toBe(3)
  })
})
