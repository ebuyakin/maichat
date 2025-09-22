import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { executeSend } from '../../src/features/compose/pipeline.js'
import { addModel, updateModelMeta } from '../../src/core/models/modelCatalog.js'
import { registerProvider } from '../../src/infrastructure/provider/adapter.js'
import { setApiKey } from '../../src/infrastructure/api/keys.js'
import { resetSettings, saveSettings } from '../../src/core/settings/index.js'
import { createAnthropicAdapter } from '../../src/infrastructure/provider/anthropicAdapter.js'

// localStorage polyfill
if(typeof globalThis.localStorage === 'undefined'){
  const __store = {}
  globalThis.localStorage = { getItem:k=> (__store[k]??null), setItem:(k,v)=>{ __store[k]=String(v) }, removeItem:k=>{ delete __store[k] } }
}

function makePair(id,u,a){ return { id, userText:u, assistantText:a, model:'claude-3-5-sonnet-20240620', createdAt:id, topicId:null } }
function makeStore(pairs){ return { getAllPairs: ()=>pairs.slice(), topics:{ get:()=>null } } }

describe('Anthropic otpm cap enforcement', () => {
  let originalFetch, capturedBody
  beforeEach(()=>{
    resetSettings(); saveSettings({ userRequestAllowance:50, assistantResponseAllowance:0, charsPerToken:4 })
    addModel('claude-3-5-sonnet-20240620', { provider:'anthropic', contextWindow:200000, otpm:8000 })
    // Force otpm value update in case model existed
    updateModelMeta('claude-3-5-sonnet-20240620', { otpm:8000 })
    registerProvider('anthropic', createAnthropicAdapter())
    setApiKey('anthropic','KEY')
    // Mock fetch so we don't hit real network; capture request body
    originalFetch = global.fetch
    global.fetch = async (url, init)=>{
      capturedBody = JSON.parse(init.body)
      return {
        ok: true,
        json: async ()=> ({ content:[{ type:'text', text:'ok' }], usage:{ input_tokens: 100, output_tokens:10 } })
      }
    }
  })
  it('caps max_tokens to otpm when R larger', async () => {
    const pairs = [makePair(1,'Hello','Response')]
    const store = makeStore(pairs)
    // Large remaining R due to huge context window; otpm should dominate
  await executeSend({ store, model:'claude-3-5-sonnet-20240620', topicId:null, userText:'Test message for otpm cap', visiblePairs:pairs, onDebugPayload:()=>{} })
  expect(capturedBody).toBeTruthy()
  expect(capturedBody.max_tokens).toBeLessThanOrEqual(8000)
  // R should be large; ensure cap equals otpm exactly (not UTMO since none) assuming R > otpm
  expect(capturedBody.max_tokens).toBe(8000)
  })
  afterEach(()=>{ if(originalFetch) global.fetch = originalFetch })
})
