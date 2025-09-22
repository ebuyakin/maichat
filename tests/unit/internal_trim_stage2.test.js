import { describe, it, expect, beforeEach, vi } from 'vitest'
import { executeSend } from '../../src/features/compose/pipeline.js'
import { saveSettings, resetSettings } from '../../src/core/settings/index.js'

// Minimal in-memory store stub
function makePair(id, userText, assistantText=''){ return { id, userText, assistantText, model:'gpt-test', createdAt:id, topicId:null } }
function makeStore(pairs){
  return {
    getAllPairs: ()=> pairs.slice(),
    topics: { get: ()=> null }
  }
}

// NOTE: Temporarily skipped until deterministic token estimation mock is added.
describe.skip('Stage2 internal one-by-one trim', () => {
  beforeEach(()=>{ 
    resetSettings(); 
    // Provide a fake OpenAI key so executeSend passes key check
    try { 
      localStorage.setItem('maichat_api_keys', JSON.stringify({ openai:'TEST_KEY' })) 
    } catch {}
  })
  it('trims exactly one oldest pair when only slightly over HLA', async () => {
    // Arrange: create 3 pairs with small token estimates
    // charsPerToken=4 default; each char ~0.25 token by estimate.
    // We'll craft lengths so that predicted includes all 3, but actual user prompt reduces HLA just below total.
    const p1 = makePair(1, 'AAAA', 'BBBB')        // 8 chars
    const p2 = makePair(2, 'CCCC', 'DDDD')        // 8 chars
    const p3 = makePair(3, 'EEEE', 'FFFF')        // 8 chars
    const store = makeStore([p1,p2,p3])
    // Force generous URA so prediction takes all 3 originally, then user prompt shrinks available by small margin.
    saveSettings({ userRequestAllowance: 50, assistantResponseAllowance: 0 })
    let debugPayload = null
    await executeSend({
      store,
      model:'gpt-test',
      topicId:null,
      userText:'X'.repeat(60), // user message large enough to force trimming one pair
      visiblePairs:[p1,p2,p3],
      onDebugPayload:(p)=>{ debugPayload = p }
    }).catch(()=>{})
    expect(debugPayload).toBeTruthy()
    // predictedMessageCount should be 3
    expect(debugPayload.predictedMessageCount).toBe(3)
    // Internal trimming should have removed exactly one
    expect(debugPayload.T_internal).toBe(1)
    // Final selection length should be 2
    expect(debugPayload.selection.length).toBe(2)
  })
})
