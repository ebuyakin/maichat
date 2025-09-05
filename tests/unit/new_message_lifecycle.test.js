import { describe, it, expect } from 'vitest'
import { createNewMessageLifecycle } from '../../src/features/history/newMessageLifecycle.js'

function mockStore(){
  return {
    pairs: new Map(),
    getAllPairs(){ return Array.from(this.pairs.values()) }
  }
}

function addPair(store, { id, topicId='t', model='gpt', userText='u', assistantText='a' }){
  store.pairs.set(id, { id, topicId, model, userText, assistantText })
}

describe('new message lifecycle', ()=>{
  it('blocks duplicate sends while pending', ()=>{
    const store = mockStore()
    addPair(store, { id:'p1' })
    const activeParts = { parts:[], active(){ return null }, setActiveById(){} }
    const lifecycle = createNewMessageLifecycle({ store, activeParts, commandInput:null, renderHistory:()=>{}, applyActivePart:()=>{} })
    expect(lifecycle.isPending()).toBe(false)
    lifecycle.beginSend()
    expect(lifecycle.isPending()).toBe(true)
    lifecycle.completeSend()
    expect(lifecycle.isPending()).toBe(false)
  })

  it('handles reply arrival when user not at logical end (badge removed; state.visible stays false)', ()=>{
    const store = mockStore()
    addPair(store, { id:'p2', assistantText:'old' })
    const partsList = [ { id:'p2:user:0', pairId:'p2', role:'user' }, { id:'p2:assistant:0', pairId:'p2', role:'assistant' } ]
    const activeParts = { parts: partsList, active(){ return partsList[0] }, setActiveById(){} }
    const lifecycle = createNewMessageLifecycle({ store, activeParts, commandInput:null, renderHistory:()=>{}, applyActivePart:()=>{} })
    lifecycle.handleNewAssistantReply('p2')
    const state = lifecycle.getBadgeState()
    expect(state.visible).toBe(false)
  })

  it('jump call no-ops (badge removed)', ()=>{
    const store = mockStore()
    addPair(store, { id:'p3', assistantText:'A reply' })
    const partsList = [ { id:'p3:user:0', pairId:'p3', role:'user' }, { id:'p3:assistant:0', pairId:'p3', role:'assistant' } ]
    const activeParts = { parts: partsList, active(){ return partsList[0] }, setActiveById(){} }
    const lifecycle = createNewMessageLifecycle({ store, activeParts, commandInput:{ value:'f star>=2' }, renderHistory:()=>{}, applyActivePart:()=>{} })
    lifecycle.setFilterQuery('f star>=2')
    lifecycle.handleNewAssistantReply('p3')
    const jumped = lifecycle.jumpToNewReply('first')
    expect(jumped).toBe(false)
    expect(lifecycle.getBadgeState().visible).toBe(false)
  })

  it('updateNewReplyBadgeVisibility is inert after badge removal', ()=>{
    const store = mockStore()
    addPair(store, { id:'p4', assistantText:'R' })
    const partsList = [ { id:'p4:user:0', pairId:'p4', role:'user' }, { id:'p4:assistant:0', pairId:'p4', role:'assistant' } ]
    const activeParts = { parts: partsList, active(){ return partsList[0] }, setActiveById(){} }
    const lifecycle = createNewMessageLifecycle({ store, activeParts, commandInput:null, renderHistory:()=>{}, applyActivePart:()=>{} })
    lifecycle.setFilterQuery('somefilter')
    lifecycle.handleNewAssistantReply('p4')
    // emulate filter cleared externally making reply visible -> setFilterQuery('') then update
    lifecycle.setFilterQuery('')
    lifecycle.updateNewReplyBadgeVisibility()
    expect(lifecycle.getBadgeState().visible).toBe(false)
  })
})
