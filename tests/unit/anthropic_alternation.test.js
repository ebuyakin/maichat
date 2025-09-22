import { describe, it, expect, beforeEach } from 'vitest'
import { executeSend } from '../../src/features/compose/pipeline.js'
import { addModel, updateModelMeta } from '../../src/core/models/modelCatalog.js'
import { registerProvider } from '../../src/infrastructure/provider/adapter.js'
import { setApiKey } from '../../src/infrastructure/api/keys.js'
import { resetSettings, saveSettings } from '../../src/core/settings/index.js'
import { createAnthropicAdapter } from '../../src/infrastructure/provider/anthropicAdapter.js'

if(typeof globalThis.localStorage === 'undefined'){
  const __s = {}
  globalThis.localStorage = { getItem:k=> (__s[k]??null), setItem:(k,v)=>{ __s[k]=String(v) }, removeItem:k=>{ delete __s[k] } }
}

function pair(id,u,a){ return { id, userText:u, assistantText:a, model:'claude-3-5-sonnet-20240620', createdAt:id, topicId:null } }
function makeStore(pairs){ return { getAllPairs: ()=>pairs.slice(), topics:{ get:()=>null } } }

// Helper to intercept fetch and inspect request body
function mockFetchCapture(){
  let captured=null
  const orig = global.fetch
  global.fetch = async (_url, init)=>{
    captured = JSON.parse(init.body)
    return { ok:true, json: async ()=> ({ content:[{type:'text', text:'ok'}], usage:{ input_tokens:10, output_tokens:5 } }) }
  }
  return { restore: ()=>{ global.fetch = orig }, capturedBody:()=>captured }
}

describe('Anthropic alternation normalization', () => {
  beforeEach(()=>{
    resetSettings(); saveSettings({ userRequestAllowance:50, assistantResponseAllowance:0, charsPerToken:4 })
    addModel('claude-3-5-sonnet-20240620', { provider:'anthropic', contextWindow:200000, otpm:8000 })
    updateModelMeta('claude-3-5-sonnet-20240620', { otpm:8000 })
    registerProvider('anthropic', createAnthropicAdapter())
    setApiKey('anthropic','KEY')
  })

  it('inserts placeholders between consecutive user turns', async () => {
    const pairs = [
      pair(1,'Question A',''),
      pair(2,'Question B',''),
      // Third prior user is different; new outgoing userText will be 'Final question'
      pair(3,'Earlier third question','')
    ]
    const store = makeStore(pairs)
    const { restore, capturedBody } = mockFetchCapture()
    try {
  await executeSend({ store, model:'claude-3-5-sonnet-20240620', topicId:null, userText:'Final question', visiblePairs:pairs, onDebugPayload:()=>{} })
      const body = capturedBody()
      expect(body).toBeTruthy()
  // We have three prior user-only turns plus the new outgoing user turn => 4 user turns.
  // Normalization inserts a placeholder assistant between each adjacent user pair => 3 placeholders.
  // Resulting sequence: user, assistant, user, assistant, user, assistant, user (7 entries)
  const roles = body.messages.map(m=>m.role)
  expect(roles).toEqual(['user','assistant','user','assistant','user','assistant','user'])
  const assistantPlaceholders = body.messages.filter(m=> m.role==='assistant' && m.content && m.content[0] && m.content[0].text==='failed to respond')
  expect(assistantPlaceholders.length).toBe(3)
    } finally { restore() }
  })

  it('does not modify already alternating sequence', async () => {
    const pairs = [
      pair(1,'Q1','A1'),
      pair(2,'Q2','A2')
    ]
    const store = makeStore(pairs)
    const { restore, capturedBody } = mockFetchCapture()
    try {
      await executeSend({ store, model:'claude-3-5-sonnet-20240620', topicId:null, userText:'New question', visiblePairs:pairs, onDebugPayload:()=>{} })
      const body = capturedBody()
      const roles = body.messages.map(m=>m.role)
      // Original expands to user, assistant, user, assistant, user
      expect(roles).toEqual(['user','assistant','user','assistant','user'])
      // Only the last user should be the new question; no assistant placeholders with single space
  const placeholders = body.messages.filter(m=> m.role==='assistant' && m.content && m.content[0] && m.content[0].text==='failed to respond')
      expect(placeholders.length).toBe(0)
    } finally { restore() }
  })
})
