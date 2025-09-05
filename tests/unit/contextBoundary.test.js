import { describe, it, expect } from 'vitest'
import { computeContextBoundary } from '../../src/core/context/tokenEstimator.js'

function makePair(id, userLen, asstLen){
  return { id, userText:'u'.repeat(userLen), assistantText:'a'.repeat(asstLen), model:'gpt', createdAt:Date.now(), topicId:'t', star:0, colorFlag:'b' }
}

describe('computeContextBoundary', ()=>{
  it('includes all when comfortably under budget', ()=>{
    const pairs = [makePair('p1',100,50), makePair('p2',120,40)]
    const { included, excluded } = computeContextBoundary(pairs, { charsPerToken:4 })
    expect(included.map(p=>p.id)).toEqual(['p1','p2'])
    expect(excluded.length).toBe(0)
  })
  it('excludes oldest when cumulative would exceed usable window', ()=>{
    // Craft pairs such that adding p1 pushes over maxUsable (simulate by very large strings)
    const big = 20000 // chars -> 5000 tokens approx
    const pairs = [makePair('p1',big,0), makePair('p2',big,0)]
    const { included, excluded, stats } = computeContextBoundary(pairs, { charsPerToken:4 })
    expect(stats.totalIncludedTokens).toBeLessThan(stats.maxUsable + 1)
    expect(included.length).toBe(1)
    expect(excluded.length).toBe(1)
    expect(included[0].id).toBe('p2') // newest kept
  })
  it('zero included when single newest exceeds budget', ()=>{
    const huge = 40000 // > usable
    const pairs = [makePair('p1',huge,0)]
    const { included } = computeContextBoundary(pairs, { charsPerToken:4 })
    expect(included.length).toBe(0)
  })
})
