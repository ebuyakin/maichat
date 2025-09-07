import { describe, it, expect } from 'vitest'
import { evaluate } from '../../src/features/command/evaluator.js'

function p(id, daysAgo=0){
  const now = new Date(2025, 8, 7) // Sept 7, 2025
  const createdAt = new Date(now.getTime() - daysAgo*24*60*60*1000).getTime()
  return { id, createdAt, topicId:'t', model:'gpt', star:0, colorFlag:'b', userText:'', assistantText:'' }
}

describe('date filter (d)', () => {
  const now = new Date(2025, 8, 7) // local
  const pairs = [ p('a', 10), p('b', 3), p('c', 0) ]

  it('relative d<7d (newer than 7 days)', () => {
    const ast = { type:'FILTER', kind:'d', args:{ op:'<', value:'7d' } }
    const res = evaluate(ast, pairs, { now })
    expect(res.map(p=>p.id)).toEqual(['b','c'])
  })

  it('absolute d=YYYY-MM-DD matches local day', () => {
    const ast = { type:'FILTER', kind:'d', args:{ op:'=', value:'2025-09-07' } }
    const res = evaluate(ast, pairs, { now })
    expect(res.map(p=>p.id)).toEqual(['c'])
  })

  it('two-digit year d=YY-MM-DD maps to 2000+YY', () => {
    const ast = { type:'FILTER', kind:'d', args:{ op:'=', value:'25-09-04' } }
    // 2025-09-04 matches pair 'b' (3 days before 2025-09-07)
    const res = evaluate(ast, pairs, { now })
    expect(res.map(p=>p.id)).toEqual(['b'])
  })

  it('comparators on absolute dates', () => {
    const ast = { type:'FILTER', kind:'d', args:{ op:'>=', value:'2025-09-04' } }
    const res = evaluate(ast, pairs, { now })
    expect(res.map(p=>p.id)).toEqual(['b','c'])
  })
})
