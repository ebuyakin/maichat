import { describe, it, expect } from 'vitest'
import { evaluate } from '../../src/filter/evaluator.js'

function makePair(id, star, includeInContext=true, model='gpt', topicId='topic'){
  return { id, createdAt: Date.now(), topicId, model, star, includeInContext, userText:'hello', assistantText:'world' }
}

describe('evaluator basic', () => {
  const pairs = [
    makePair('a',0,true,'gpt','t1'),
    makePair('b',2,true,'gpt','t1'),
    makePair('c',3,false,'claude','t2')
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
  it('AND star & include', () => {
    const ast = { type:'AND', left:{ type:'FILTER', kind:'s', args:{ op:'>=', value:'2' } }, right:{ type:'FILTER', kind:'a', args:{} } }
    const res = evaluate(ast, pairs)
    expect(res.map(p=>p.id)).toEqual(['b'])
  })
})
