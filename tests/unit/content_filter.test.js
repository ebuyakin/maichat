import { describe, it, expect } from 'vitest'
import { evaluate } from '../../src/features/command/evaluator.js'

function pair(id, userText, assistantText=''){ return { id, createdAt: Date.now(), topicId:'t', model:'m', star:0, colorFlag:'b', userText, assistantText } }

describe('content filter (c)', () => {
  const pairs = [
    pair('a','Transformers are attention-based models'),
    pair('b','Retry logic','Handle error and timeout cases'),
    pair('c','Misc','No match here'),
  ]
  it('substring match default', () => {
    const ast = { type:'FILTER', kind:'c', args:{ value:"attention" } }
    const res = evaluate(ast, pairs)
    expect(res.map(p=>p.id)).toEqual(['a'])
  })
  it('wildcard order semantics with *', () => {
    const ast = { type:'FILTER', kind:'c', args:{ value:"*error*timeout*" } }
    const res = evaluate(ast, pairs)
    expect(res.map(p=>p.id)).toEqual(['b'])
  })
  it('case-insensitive', () => {
    const ast = { type:'FILTER', kind:'c', args:{ value:"TIMEOUT" } }
    const res = evaluate(ast, pairs)
    expect(res.map(p=>p.id)).toEqual(['b'])
  })
})
