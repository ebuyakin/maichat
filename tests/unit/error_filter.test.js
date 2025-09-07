import { describe, it, expect } from 'vitest'
import { evaluate } from '../../src/features/command/evaluator.js'

function makePair(id, state, msg=''){
  return { id, createdAt: Date.now(), topicId:'t', model:'gpt', star:0, colorFlag:'b', userText:'u', assistantText:'a', lifecycleState: state, errorMessage: msg }
}

describe('error filter (e)', () => {
  const pairs = [
    makePair('ok1','complete',''),
    makePair('err1','error','network error'),
    makePair('ok2','complete',''),
    makePair('err2','error','timeout'),
  ]
  it("e selects only error pairs", () => {
    const ast = { type:'FILTER', kind:'e', args:{} }
    const res = evaluate(ast, pairs)
    expect(res.map(p=>p.id)).toEqual(['err1','err2'])
  })
})
