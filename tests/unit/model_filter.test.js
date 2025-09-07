import { describe, it, expect } from 'vitest'
import { evaluate } from '../../src/features/command/evaluator.js'

function makePair(id, model){
  return { id, createdAt: Date.now(), topicId:'t', model, star:0, colorFlag:'b', userText:'u', assistantText:'a' }
}

describe('model filter (m)', () => {
  const pairs = [
    makePair('a','gpt-4o'),
    makePair('b','gpt-4o-mini'),
    makePair('c','claude-3-opus'),
    makePair('d','mixtral-8x7b'),
  ]
  it('exact match m\'gpt-4o\'', () => {
    const ast = { type:'FILTER', kind:'m', args:{ value:"gpt-4o" } }
    const res = evaluate(ast, pairs)
    expect(res.map(p=>p.id)).toEqual(['a'])
  })
  it('wildcard m\'gpt*\'', () => {
    const ast = { type:'FILTER', kind:'m', args:{ value:"gpt*" } }
    const res = evaluate(ast, pairs)
    expect(res.map(p=>p.id)).toEqual(['a','b'])
  })
  it('bare m uses current model from opts', () => {
    const ast = { type:'FILTER', kind:'m', args:{ } }
    const res = evaluate(ast, pairs, { currentModel:'claude-3-opus' })
    expect(res.map(p=>p.id)).toEqual(['c'])
  })
  it('case-insensitive matching', () => {
    const ast = { type:'FILTER', kind:'m', args:{ value:"GPT*" } }
    const res = evaluate(ast, pairs)
    expect(res.map(p=>p.id)).toEqual(['a','b'])
  })
})
