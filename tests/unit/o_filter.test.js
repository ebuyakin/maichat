import { describe, it, expect } from 'vitest'
import { parse } from '../../src/features/command/parser.js'
import { evaluate } from '../../src/features/command/evaluator.js'

function mkPairs(){
  const now = Date.now()
  return [
    { id:'p1', createdAt: now-4000 },
    { id:'p2', createdAt: now-3000 },
    { id:'p3', createdAt: now-2000 },
    { id:'p4', createdAt: now-1000 },
  ]
}

describe('o filter (in-context)', ()=>{
  it('o keeps only included', ()=>{
    const ast = parse('o')
    const pairs = mkPairs()
    const includedIds = new Set(['p2','p4'])
    const out = evaluate(ast, pairs, { includedIds })
    expect(out.map(p=>p.id)).toEqual(['p2','p4'])
  })
  it('o3 keeps included plus last 3 off-context', ()=>{
    const ast = parse('o3')
    const pairs = mkPairs()
    const includedIds = new Set(['p2','p4'])
    const offContextOrder = ['p1','p3'] // in chronological order among base
    const out = evaluate(ast, pairs, { includedIds, offContextOrder })
    // last 3 of off-contextOrder => ['p1','p3'] (both), combined with included preserves pairs order
    expect(out.map(p=>p.id)).toEqual(['p1','p2','p3','p4'])
  })
  it('!o keeps only off-context', ()=>{
    const ast = parse('!o')
    const pairs = mkPairs()
    const includedIds = new Set(['p2','p4'])
    const out = evaluate(ast, pairs, { includedIds })
    expect(out.map(p=>p.id)).toEqual(['p1','p3'])
  })
  it('!o1 excludes newest 1 off-context from off-context set', ()=>{
    const ast = parse('!o1')
    const pairs = mkPairs()
    const includedIds = new Set(['p2','p4'])
    const offContextOrder = ['p1','p3']
    const out = evaluate(ast, pairs, { includedIds, offContextOrder })
    // !o1 => off-context except last 1 off-context (newest among off-context is p3)
    expect(out.map(p=>p.id)).toEqual(['p1'])
  })
})
