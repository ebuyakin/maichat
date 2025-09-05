import { describe, it, expect, beforeEach } from 'vitest'
import { JSDOM } from 'jsdom'
import { createNewMessageLifecycle } from '../../src/features/history/newMessageLifecycle.js'

function mockStore(){
  return { pairs:new Map(), getAllPairs(){ return Array.from(this.pairs.values()) } }
}
function addPair(store, { id, userText='u', assistantText='a' }){
  store.pairs.set(id, { id, topicId:'t', model:'gpt', userText, assistantText })
}

describe('new reply extended navigation', ()=>{
  beforeEach(()=>{
    const dom = new JSDOM('<!DOCTYPE html><body><div id="statusRight"></div></body>')
    global.window = dom.window
    global.document = dom.window.document
    global.getComputedStyle = (el)=> dom.window.getComputedStyle(el)
  })
  it('jumpToNewReply first no-ops after badge removal', ()=>{
    const store = mockStore()
    addPair(store, { id:'p1', assistantText:'reply one part one\npart two' })
    // simulate two assistant parts
    const parts = [
      { id:'p1:user:0', pairId:'p1', role:'user' },
      { id:'p1:assistant:0', pairId:'p1', role:'assistant' },
      { id:'p1:assistant:1', pairId:'p1', role:'assistant' }
    ]
    let activeId = parts[0].id
    const activeParts = {
      parts,
      active(){ return parts.find(p=>p.id===activeId) },
      setActiveById(id){ activeId = id }
    }
    const lifecycle = createNewMessageLifecycle({ store, activeParts, commandInput:null, renderHistory:()=>{}, applyActivePart:()=>{} })
  lifecycle.handleNewAssistantReply('p1')
  const jumped = lifecycle.jumpToNewReply('first')
  expect(jumped).toBe(false)
  expect(activeId).toBe(parts[0].id)
  })

  it('auto-focuses first assistant part when user at logical end on reply arrival (no badge)', ()=>{
    const store = mockStore()
    addPair(store, { id:'p2', assistantText:'A B' })
    const parts = [
      { id:'p2:user:0', pairId:'p2', role:'user' },
      { id:'p2:assistant:0', pairId:'p2', role:'assistant' }
    ]
    let activeId = parts[parts.length-1].id // simulate logical end (last part active)
    const activeParts = {
      parts,
      active(){ return parts.find(p=>p.id===activeId) },
      setActiveById(id){ activeId = id }
    }
    const lifecycle = createNewMessageLifecycle({ store, activeParts, commandInput:null, renderHistory:()=>{}, applyActivePart:()=>{} })
    // userAtLogicalEnd() should be true, so reply arrival auto-focus first assistant part
    lifecycle.handleNewAssistantReply('p2')
    const badge = lifecycle.getBadgeState()
    expect(badge.visible).toBe(false)
    expect(activeId).toBe('p2:assistant:0')
  })

  it('filtered reply jump no-op after badge removal', ()=>{
    const store = mockStore()
    addPair(store, { id:'p3', assistantText:'Z' })
    const parts = [
      { id:'p3:user:0', pairId:'p3', role:'user' },
      { id:'p3:assistant:0', pairId:'p3', role:'assistant' }
    ]
    let activeId = parts[0].id
    const activeParts = { parts, active(){ return parts.find(p=>p.id===activeId) }, setActiveById(id){ activeId = id } }
    let rendered = false
    const lifecycle = createNewMessageLifecycle({ store, activeParts, commandInput:{ value:'topic:foo' }, renderHistory:()=>{ rendered = true }, applyActivePart:()=>{} })
    lifecycle.setFilterQuery('topic:foo')
  lifecycle.handleNewAssistantReply('p3')
  let badge = lifecycle.getBadgeState()
  expect(badge.visible).toBe(false)
  const jumped = lifecycle.jumpToNewReply('first')
  expect(jumped).toBe(false)
  expect(rendered).toBe(false) // renderHistory not triggered by jump anymore
  // activeId unchanged
  expect(activeId).toBe(parts[0].id)
  })
})
