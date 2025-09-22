import { describe, it, expect } from 'vitest'
import { predictHistory, finalizeHistory } from '../../src/core/context/budgetMath.js'

function makePair(u,a){
  return { id: Math.random().toString(36).slice(2), userText:u, assistantText:a, createdAt: Date.now() }
}

describe('budgetMath', () => {
  it('predicts history within HLP', () => {
    const pairs = [makePair('u1','a1'), makePair('u2 longer','a2'), makePair('u3','a3 longer part')]
    const res = predictHistory({ pairs, model: 'gpt-4o', systemText:'', provider:'openai', charsPerToken:4, URA:50, ARA:100 })
    expect(res.C).toBeGreaterThan(0)
    expect(res.predicted.length).toBeLessThanOrEqual(pairs.length)
    // HLP should be C - URA - PARA (ARA included as PARA for openai)
    expect(res.HLP).toBe(res.C - 50 - 100)
  })

  it('finalizes without trimming when H0 <= HLA', () => {
    const pairs = [makePair('short','short'), makePair('tiny','tiny')]
    const pred = { predicted:pairs, systemTokens:0, C:1000, PARA:0, HLP:800 }
    const fin = finalizeHistory({ predicted: pred.predicted, userText:'hello', systemTokens:0, C:1000, PARA:0, URA:100, charsPerToken:4 })
    expect(fin.error).toBeUndefined()
    expect(fin.H0).toBe(fin.H)
    expect(fin.remainingContext).toBeGreaterThan(0)
  })

  it('trims when H0 > HLA', () => {
    // Force H0 close to C then make userText consume additional space so trimming needed.
    const chunk = 'x'.repeat(800) // 800 chars -> 200 tokens at cpt=4 per text fragment
    const p1 = makePair(chunk, chunk) // ~400 tokens
    const p2 = makePair(chunk, chunk) // another ~400 tokens (H0≈800)
    const predicted = [p1,p2]
    const C = 900 // total context
    const PARA = 0
    // userText adds ~250 tokens (1000 chars /4) triggering overflow relative to HLA
    const userText = 'u'.repeat(1000)
    const fin = finalizeHistory({ predicted, userText, systemTokens:0, C, PARA, URA:100, charsPerToken:4 })
    expect(fin.error).toBeUndefined()
    expect(fin.H0).toBeGreaterThan(fin.H)
    expect(fin.included.length).toBeLessThan(predicted.length)
  })

  it('errors when user + system exceed C', () => {
    const fin = finalizeHistory({ predicted:[], userText:'x'.repeat(600), systemTokens:0, C:100, PARA:0, URA:50, charsPerToken:4 })
    expect(fin.error).toBe('user_prompt_too_large')
  })
})
