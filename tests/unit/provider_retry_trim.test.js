import { describe, it, expect } from 'vitest'
import { executeSend } from '../../src/features/compose/pipeline.js'
import { registerProvider } from '../../src/infrastructure/provider/adapter.js'
import * as modelCatalog from '../../src/core/models/modelCatalog.js'
import { getModelMeta } from '../../src/core/models/modelCatalog.js'
import { setApiKey } from '../../src/infrastructure/api/keys.js'
import { saveSettings, resetSettings } from '../../src/core/settings/index.js'

// Provide minimal provider registration hook if not exposed; fallback monkey patch.

function makePair(id, userText, assistantText=''){ return { id, userText, assistantText, model:'retry-model', createdAt:id, topicId:null } }
function makeStore(pairs){ return { getAllPairs: ()=>pairs.slice(), topics:{ get: ()=> null } } }

class MockOverflowProvider{
  constructor(){ this.calls=0 }
  async sendChat(){
    this.calls++
    if(this.calls===1){ const e = new Error('context length exceeded'); e.providerCode='context_length_exceeded'; throw e }
    return { content:'ok', usage:{ promptTokens:10, completionTokens:5 } }
  }
}

describe('Provider retry trimming loop', () => {
  it('retries once on overflow and succeeds second attempt', async () => {
    resetSettings()
    saveSettings({ userRequestAllowance:50, assistantResponseAllowance:0, maxTrimAttempts:5 })
    // Polyfill localStorage for key handling
    if(typeof global.localStorage === 'undefined'){
      const store = {}
      global.localStorage = {
        getItem:k=> (k in store? store[k]: null),
        setItem:(k,v)=>{ store[k]=String(v) },
        removeItem:(k)=>{ delete store[k] }
      }
    }
    // Register mock provider under id 'retry-provider'
    const providerId = 'retry-provider'
    const mock = new MockOverflowProvider()
    registerProvider(providerId, mock)
    setApiKey(providerId, 'KEY')
    // Ensure model meta returns this provider id
    // Add model formally via catalog API if not present
    const meta = modelCatalog.getModelMeta('retry-model')
    if(!meta || meta.provider !== providerId){
      modelCatalog.addModel('retry-model', { provider: providerId, contextWindow: 8000, tpm:8000 })
    }
    const pairs = [makePair(1,'A','B'), makePair(2,'C','D'), makePair(3,'E','F')]
    let debugPayload
    // We assume model catalog fallback provider openai; simulate by using provider id as model id mapping via meta override if needed.
    const res = await executeSend({ store: makeStore(pairs), model:'retry-model', topicId:null, userText:'Hello world', visiblePairs:pairs, onDebugPayload:(p)=>{ debugPayload=p }, signal:undefined })
    expect(res.content).toBe('ok')
    expect(mock.calls).toBe(2)
    expect(debugPayload.attemptsUsed).toBe(2)
    expect(debugPayload.T_provider).toBe(1)
  })
})
