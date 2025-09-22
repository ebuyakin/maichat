import { describe, it, expect } from 'vitest'
import { createAnthropicAdapter } from '../../src/infrastructure/provider/anthropicAdapter.js'

function fakeReq({ R, otpm, utmo }){
  return {
    model:'claude-test',
    messages: [{ role:'user', content:'Hello'}],
    system: undefined,
    apiKey: 'KEY',
    signal: undefined,
    options: {},
    budget: { maxContext: 2000, inputTokens: 100, remainingContext: R },
    userOverrides: utmo != null ? { maxOutputTokens: utmo } : {},
    meta: otpm != null ? { otpm } : {},
  }
}

describe('Anthropic max_tokens computation', () => {
  it('uses R when no otpm or utmo', async () => {
    const adapter = createAnthropicAdapter()
    const req = fakeReq({ R:500, otpm: undefined, utmo: undefined })
    let body
    global.fetch = async (url, init)=>{ body = JSON.parse(init.body); return { ok:true, json: async ()=> ({ content:[{type:'text', text:'ok'}], usage:{ input_tokens:100, output_tokens: body.max_tokens } }) } }
    await adapter.sendChat(req)
    expect(body.max_tokens).toBe(500)
  })
  it('takes min among R and otpm', async () => {
    const adapter = createAnthropicAdapter()
    const req = fakeReq({ R:800, otpm:600, utmo: undefined })
    let body
    global.fetch = async (url, init)=>{ body = JSON.parse(init.body); return { ok:true, json: async ()=> ({ content:[{type:'text', text:'ok'}], usage:{ input_tokens:100, output_tokens: body.max_tokens } }) } }
    await adapter.sendChat(req)
    expect(body.max_tokens).toBe(600)
  })
  it('includes utmo and picks min(R, otpm, utmo)', async () => {
    const adapter = createAnthropicAdapter()
    const req = fakeReq({ R:700, otpm:650, utmo:300 })
    let body
    global.fetch = async (url, init)=>{ body = JSON.parse(init.body); return { ok:true, json: async ()=> ({ content:[{type:'text', text:'ok'}], usage:{ input_tokens:100, output_tokens: body.max_tokens } }) } }
    await adapter.sendChat(req)
    expect(body.max_tokens).toBe(300)
  })
  it('throws when cap would be <1', async () => {
    const adapter = createAnthropicAdapter()
    const req = fakeReq({ R:0, otpm: undefined, utmo: undefined })
    global.fetch = async ()=> ({ ok:true, json: async ()=> ({ content:[], usage:{ input_tokens:0, output_tokens:0 } }) })
    await expect(adapter.sendChat(req)).rejects.toThrow()
  })
})
