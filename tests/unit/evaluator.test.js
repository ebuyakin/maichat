import { describe, it, expect } from 'vitest'
import { evaluate } from '../../src/features/command/evaluator.js'

function makePair(id, star, colorFlag='b', model='gpt', topicId='topic'){
  return { id, createdAt: Date.now(), topicId, model, star, colorFlag, userText:'hello', assistantText:'world' }
}

describe('evaluator basic', () => {
  const pairs = [
  makePair('a',0,'b','gpt','t1'),
  makePair('b',2,'b','gpt','t1'),
  makePair('c',3,'g','claude','t2')
  ]
  it('filters star >=2', () => {
    const ast = { type:'FILTER', kind:'s', args:{ op:'>=', value:'2' } }
    const res = evaluate(ast, pairs)
    expect(res.map(p=>p.id)).toEqual(['b','c'])
  })
  it('recent r2', () => {
    const ast = { type:'FILTER', kind:'r', args:{ value:'2' } }
    const res = evaluate(ast, pairs)
    expect(res.map(p=>p.id)).toEqual(['b','c'])
  })
  it('AND star & blue flag (b)', () => {
    const ast = { type:'AND', left:{ type:'FILTER', kind:'s', args:{ op:'>=', value:'2' } }, right:{ type:'FILTER', kind:'b', args:{} } }
    const res = evaluate(ast, pairs)
    expect(res.map(p=>p.id)).toEqual(['b'])
  })
})
