import { describe, it, expect, beforeEach } from 'vitest'
// localStorage polyfill for node test environment
if(typeof globalThis.localStorage === 'undefined'){
  const __store = {}
  globalThis.localStorage = {
    getItem:k=> Object.prototype.hasOwnProperty.call(__store,k)? __store[k] : null,
    setItem:(k,v)=>{ __store[k]=String(v) },
    removeItem:(k)=>{ delete __store[k] }
  }
}
import { executeSend } from '../../src/features/compose/pipeline.js'
import { registerProvider } from '../../src/infrastructure/provider/adapter.js'
import { setApiKey } from '../../src/infrastructure/api/keys.js'
import { saveSettings, resetSettings } from '../../src/core/settings/index.js'
import { addModel } from '../../src/core/models/modelCatalog.js'

function makePair(id, u, a){ return { id, userText:u, assistantText:a, model:'claude-3-5-sonnet-20240620', createdAt:id, topicId:null } }
function makeStore(pairs){ return { getAllPairs: ()=>pairs.slice(), topics:{ get:()=>null } } }

class NoopProvider{ async sendChat(){ return { content:'ok' } } }

describe('Pipeline debug payload integrity (Anthropic)', () => {
  let pairs, store
  beforeEach(()=>{
    resetSettings();
    saveSettings({ userRequestAllowance:50, assistantResponseAllowance:0, charsPerToken:4 })
    pairs = [
      makePair(1,'User one','Assistant one'),
      makePair(2,'User two','Assistant two'),
      makePair(3,'User three','Assistant three')
    ]
    store = makeStore(pairs)
    addModel('claude-3-5-sonnet-20240620', { provider:'anthropic', contextWindow:200000, tpm:100000 })
    registerProvider('anthropic', new NoopProvider())
    setApiKey('anthropic','TEST')
  })

  it('preflight debug payload has selection with numeric tokens', async () => {
    const payloads = []
    await executeSend({ store, model:'claude-3-5-sonnet-20240620', topicId:null, userText:'Hello Debug', visiblePairs:pairs, onDebugPayload:(p)=>payloads.push(p) })
    const preflight = payloads.find(p=>p.status==='preflight')
    expect(preflight).toBeTruthy()
    expect(preflight.selection.length).toBeGreaterThan(0)
    for(const s of preflight.selection){
      expect(typeof s.tokens).toBe('number')
      expect(isFinite(s.tokens)).toBe(true)
    }
  })
})
