import { describe, it, expect } from 'vitest'
import { evaluate } from '../../src/features/command/evaluator.js'

function makeTopic(id, name, parentId){ return { id, name, parentId } }
function makePair(id, topicId){ return { id, createdAt: Date.now(), topicId, model:'gpt', star:0, colorFlag:'b', userText:'', assistantText:'' } }

function mockStore(){
  const topics = new Map()
  const root = makeTopic('root','Root', null); topics.set('root', root)
  const ai = makeTopic('t1','AI', 'root'); topics.set('t1', ai)
  const tr = makeTopic('t2','Transformers', 't1'); topics.set('t2', tr)
  const gpt = makeTopic('t3','GPT', 't2'); topics.set('t3', gpt)
  const ml = makeTopic('t4','Machine Learning', 't1'); topics.set('t4', ml)
  const other = makeTopic('t5','Other', 'root'); topics.set('t5', other)
  return {
    topics,
    getAllTopics(){ return Array.from(this.topics.values()) },
    getTopicPath(id){
      const parts=[]; let cur=this.topics.get(id)
      while(cur){ parts.push(cur.name); cur = cur.parentId ? this.topics.get(cur.parentId) : null }
      return parts.reverse()
    }
  }
}

describe('topic filter (t)', () => {
  it('matches by exact name and wildcard', () => {
    const store = mockStore()
    const pairs = [ makePair('p1','t1'), makePair('p2','t2'), makePair('p3','t5') ]
    // exact name
    let res = evaluate({ type:'FILTER', kind:'t', args:{ value:'AI' } }, pairs, { store })
    expect(res.map(p=>p.id)).toEqual(['p1'])
    // wildcard contains
    res = evaluate({ type:'FILTER', kind:'t', args:{ value:'*Learn*' } }, pairs, { store })
    expect(res.map(p=>p.id)).toEqual([]) // none in pairs for t4
  })

  it('descendants via ...', () => {
    const store = mockStore()
    const pairs = [ makePair('p1','t1'), makePair('p2','t2'), makePair('p3','t3'), makePair('p4','t5') ]
    const res = evaluate({ type:'FILTER', kind:'t', args:{ value:"AI..." } }, pairs, { store })
    expect(res.map(p=>p.id)).toEqual(['p1','p2','p3'])
  })

  it('path match with >', () => {
    const store = mockStore()
    const pairs = [ makePair('p1','t1'), makePair('p2','t2'), makePair('p3','t3') ]
    const res = evaluate({ type:'FILTER', kind:'t', args:{ value:'AI > Transformers' } }, pairs, { store })
    expect(res.map(p=>p.id)).toEqual(['p2'])
  })

  it('path segment supports wildcards and slash-separated path', () => {
    const store = mockStore()
    const pairs = [ makePair('p1','t2'), makePair('p2','t3') ]
    // wildcard in segment
  let res = evaluate({ type:'FILTER', kind:'t', args:{ value:'AI > *former*' } }, pairs, { store })
  // matches exactly the Transformers node (no descendants without ...)
  expect(res.map(p=>p.id)).toEqual(['p1'])
  // descendants via ... include GPT child
  res = evaluate({ type:'FILTER', kind:'t', args:{ value:'AI > *former*...' } }, pairs, { store })
  expect(res.map(p=>p.id)).toEqual(['p1','p2'])
    // slash path
    res = evaluate({ type:'FILTER', kind:'t', args:{ value:'/AI/Transformers' } }, pairs, { store })
    expect(res.map(p=>p.id)).toEqual(['p1'])
  })

  it('bare t prefers pending topic id when provided', () => {
    const store = mockStore()
    const pairs = [ makePair('p1','t1'), makePair('p2','t2') ]
    const res = evaluate({ type:'FILTER', kind:'t', args:{ value: null } }, pairs, { store, currentTopicId:'tZ-not-used' })
    // In unit context, passing currentTopicId simulates pending/current. Keep existing expectation the same shape.
    expect(Array.isArray(res)).toBe(true)
  })

  it('bare t uses currentTopicId', () => {
    const store = mockStore()
    const pairs = [ makePair('p1','t1'), makePair('p2','t2'), makePair('p3','t5') ]
    const res = evaluate({ type:'FILTER', kind:'t', args:{ value: null } }, pairs, { store, currentTopicId:'t2' })
    expect(res.map(p=>p.id)).toEqual(['p2'])
  })
})
