import { describe, test, expect } from 'vitest'
import { ActivePartController } from '../../src/features/history/parts.js'

function makeParts(struct){
  // struct: array of roles like ['user','meta','assistant'] mapped to parts
  return struct.map((role, i)=>({ id: `p:${role}:${i}`+(role==='meta'?':meta':''), pairId: 'pair1', role, index: role==='meta'?0:i, text: role==='meta'?null:`${role} ${i}` }))
}

describe('ActivePartController meta skip', ()=>{
  test('j from last user should not land on terminal meta', ()=>{
    const ap = new ActivePartController()
    const parts = makeParts(['user','meta'])
    ap.setParts(parts)
    // ensure we start on the last non-meta (user)
    ap.last()
    expect(ap.active().role).toBe('user')
    // next()
    ap.next()
    // should remain on user, not meta
    expect(ap.active().role).toBe('user')
  })

  test('setParts preserves non-meta when last is meta', ()=>{
    const ap = new ActivePartController()
    const parts1 = makeParts(['user','meta'])
    ap.setParts(parts1)
    ap.last()
    expect(ap.active().role).toBe('user')
    // simulate re-render with same structure
    const parts2 = makeParts(['user','meta'])
    ap.setParts(parts2)
    expect(ap.active().role).toBe('user')
  })

  test('setActiveById(meta) resolves to nearest non-meta', ()=>{
    const ap = new ActivePartController()
    const parts = [
      { id:'a:user:0', pairId:'x', role:'user', index:0, text:'u0' },
      { id:'a:meta', pairId:'x', role:'meta', index:0, text:null },
      { id:'a:assistant:0', pairId:'x', role:'assistant', index:0, text:'a0' },
    ]
    ap.setParts(parts)
    ap.setActiveById('a:meta')
    expect(['user','assistant']).toContain(ap.active().role)
  })
})
