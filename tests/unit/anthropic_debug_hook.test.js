import { describe, it, expect, beforeEach } from 'vitest'
import { executeSend } from '../../src/features/compose/pipeline.js'
import { addModel } from '../../src/core/models/modelCatalog.js'
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

describe('Anthropic adapter parity debug hook', () => {
  beforeEach(()=>{
    resetSettings(); saveSettings({ userRequestAllowance:50, assistantResponseAllowance:0, charsPerToken:4 })
    addModel('claude-3-5-sonnet-20240620', { provider:'anthropic', contextWindow:200000 })
    registerProvider('anthropic', createAnthropicAdapter())
    setApiKey('anthropic','KEY')
    if(typeof window !== 'undefined'){ delete window.__maichatLastRequest }
  })
  it('sets window.__maichatLastRequest with outbound JSON (even on auth error)', async () => {
    const pairs = [makePair(1,'Hi','There')]
    const store = makeStore(pairs)
    try {
      await executeSend({ store, model:'claude-3-5-sonnet-20240620', topicId:null, userText:'Test Anthropic', visiblePairs:pairs, onDebugPayload:()=>{} })
    } catch(_) {}
    if(typeof window === 'undefined') return // environment guard
    expect(window.__maichatLastRequest).toBeTruthy()
    expect(window.__maichatLastRequest.model).toBe('claude-3-5-sonnet-20240620')
    const parsed = JSON.parse(window.__maichatLastRequest.json)
    expect(parsed.model).toBe('claude-3-5-sonnet-20240620')
    expect(Array.isArray(parsed.messages)).toBe(true)
    expect(parsed.messages.length).toBeGreaterThan(0)
  })
})
