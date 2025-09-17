import { describe, it, expect } from 'vitest'
import { orderPairs } from '../../../src/features/export/exportOrdering.js'

function iso(n){
  // 2025-01-01T00:00:0nZ
  return `2025-01-01T00:00:0${n}Z`
}

describe('orderPairs topic mode', ()=>{
  const topicIndex = {
    rootId: 'root',
    _children: new Map([
      ['root', ['t1','t2']],
      ['t1', ['c1']],
      ['c1', []],
      ['t2', []]
    ]),
    getChildren(id){ return this._children.get(id) || [] },
  }

  function p(id, topicId, t){ return { id, topicId, createdAt: iso(t) } }

  it('DFS pre-order with within-topic chronological', ()=>{
    const pairs = [
      p('r2','root',2), p('r1','root',1),
      p('t1b','t1',2), p('t1a','t1',1),
      p('c1b','c1',2), p('c1a','c1',1),
      p('t2b','t2',2), p('t2a','t2',1)
    ]
    const out = orderPairs(pairs, { mode:'topic', topicIndex })
    expect(out.map(x=>x.id)).toEqual(['r1','r2','t1a','t1b','c1a','c1b','t2a','t2b'])
  })

  it('falls back to time ordering if topicIndex missing', ()=>{
    const pairs = [p('b','x',2), p('a','x',1)]
    const out = orderPairs(pairs, { mode:'topic' })
    expect(out.map(x=>x.id)).toEqual(['a','b'])
  })

  it('stable tie-break by id when equal createdAt', ()=>{
    const pairs = [p('a','root',1), p('b','root',1)]
    const out = orderPairs(pairs, { mode:'time' })
    expect(out.map(x=>x.id)).toEqual(['a','b'])
  })
})
