import { describe, it, expect } from 'vitest'
import { createNewMessageLifecycle } from '../../src/ui/newMessageLifecycle.js'

function mockStore(){
  return { pairs:new Map(), getAllPairs(){ return Array.from(this.pairs.values()) } }
}
function addPair(store, { id, userText='u', assistantText='a' }){
  store.pairs.set(id, { id, topicId:'t', model:'gpt', userText, assistantText })
}

describe('new reply navigation', ()=>{
  it('jumpToNewReply last selects last assistant part when badge visible', ()=>{
    const store = mockStore()
    addPair(store, { id:'p1', assistantText:'reply one' })
    // two assistant parts simulation
    const parts = [
      { id:'p1:user:0', pairId:'p1', role:'user' },
      { id:'p1:assistant:0', pairId:'p1', role:'assistant' },
      { id:'p1:assistant:1', pairId:'p1', role:'assistant' }
    ]
    let activeId = null
    const activeParts = {
      parts,
      active(){ return activeId ? parts.find(p=>p.id===activeId) : parts[0] },
      setActiveById(id){ activeId = id }
    }
    const lifecycle = createNewMessageLifecycle({ store, activeParts, commandInput:null, renderHistory:()=>{}, applyActivePart:()=>{} })
    lifecycle.handleNewAssistantReply('p1') // simulate arrival -> badge visible
    const jumped = lifecycle.jumpToNewReply('last')
    expect(jumped).toBe(true)
    expect(activeId).toBe('p1:assistant:1')
  })
})
