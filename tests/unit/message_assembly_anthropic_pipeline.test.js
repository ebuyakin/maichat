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
import { predictHistory, finalizeHistory } from '../../src/core/context/budgetMath.js'
import { buildMessages, executeSend } from '../../src/features/compose/pipeline.js'
import { registerProvider } from '../../src/infrastructure/provider/adapter.js'
import { setApiKey } from '../../src/infrastructure/api/keys.js'
import { saveSettings, resetSettings } from '../../src/core/settings/index.js'
import { addModel } from '../../src/core/models/modelCatalog.js'

function makePair(id, u, a){ return { id, userText:u, assistantText:a, model:'claude-3-5-sonnet-20240620', createdAt:id, topicId:null } }
function makeStore(pairs){ return { getAllPairs: ()=>pairs.slice(), topics:{ get:()=>null } } }

class CapturingProvider{
  constructor(){ this.calls=[] }
  async sendChat(req){ this.calls.push(req); return { content:'ok', usage:{ promptTokens:0, completionTokens:0 } } }
}

describe('Anthropic message assembly pipeline', () => {
  let pairs, store, provider
  beforeEach(()=>{
    resetSettings();
    saveSettings({ userRequestAllowance:50, assistantResponseAllowance:0, charsPerToken:4 })
    pairs = [
      makePair(1,'User one','Assistant one'),
      makePair(2,'User two','Assistant two'),
      makePair(3,'User three','Assistant three')
    ]
    store = makeStore(pairs)
    // Ensure model exists
    addModel('claude-3-5-sonnet-20240620', { provider:'anthropic', contextWindow:200000, tpm:100000 })
    provider = new CapturingProvider()
    registerProvider('anthropic', provider)
    setApiKey('anthropic','TEST')
  })

  it('predict/finalize produce non-empty included list', () => {
    const pred = predictHistory({ pairs, model:'claude-3-5-sonnet-20240620', systemText:'', provider:'anthropic', charsPerToken:4, URA:50, ARA:0 })
    expect(pred.predicted.length).toBeGreaterThan(0)
    const fin = finalizeHistory({ predicted: pred.predicted, userText:'Hello Anthropic', systemTokens: pred.systemTokens, C: pred.C, PARA: pred.PARA, URA:50, charsPerToken:4 })
    expect(fin.included.length).toBe(pred.predicted.length)
  })

  it('buildMessages includes history + new user', () => {
    const pred = predictHistory({ pairs, model:'claude-3-5-sonnet-20240620', systemText:'', provider:'anthropic', charsPerToken:4, URA:50, ARA:0 })
    const fin = finalizeHistory({ predicted: pred.predicted, userText:'Hello Anthropic', systemTokens: pred.systemTokens, C: pred.C, PARA: pred.PARA, URA:50, charsPerToken:4 })
    const msgs = buildMessages({ includedPairs: fin.included, newUserText:'Hello Anthropic' })
    // Each pair contributes up to 2 messages + final user
    expect(msgs[msgs.length-1].content).toBe('Hello Anthropic')
    expect(msgs.filter(m=>m.role==='user').length).toBeGreaterThan(1)
  })

  it('executeSend passes non-empty messages to Anthropic provider', async () => {
    const res = await executeSend({ store, model:'claude-3-5-sonnet-20240620', topicId:null, userText:'Hello Anthropic', visiblePairs:pairs, onDebugPayload:()=>{} })
    expect(res.content).toBe('ok')
    expect(provider.calls.length).toBe(1)
    const sent = provider.calls[0]
    expect(Array.isArray(sent.messages)).toBe(true)
    expect(sent.messages.length).toBeGreaterThan(1) // history + new user
    expect(sent.messages[sent.messages.length-1].content).toBe('Hello Anthropic')
  })
})
