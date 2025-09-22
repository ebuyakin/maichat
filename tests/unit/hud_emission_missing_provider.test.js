import { describe, it, expect } from 'vitest'
import { executeSend } from '../../src/features/compose/pipeline.js'
import { saveSettings, resetSettings } from '../../src/core/settings/index.js'

function makePair(id, userText, assistantText=''){ return { id, userText, assistantText, model:'ghost-model', createdAt:id, topicId:null } }
function makeStore(pairs){ return { getAllPairs: ()=>pairs.slice(), topics:{ get: ()=> null } } }

describe('HUD emissions on missing provider', () => {
  it('emits preflight then error payload when provider not registered', async () => {
    resetSettings(); saveSettings({ userRequestAllowance:50, assistantResponseAllowance:0 })
    const pairs = [makePair(1,'Hi','There')]
    const store = makeStore(pairs)
    const payloads = []
    await expect(executeSend({ store, model:'ghost-model', topicId:null, userText:'Test', visiblePairs:pairs, onDebugPayload:(p)=>payloads.push(p) })).rejects.toThrow()
    expect(payloads.length).toBeGreaterThanOrEqual(2)
    expect(payloads[0].status).toBe('preflight')
    const last = payloads[payloads.length-1]
    expect(last.status).toBe('error')
    expect(last.errorCode).toBe('provider_not_registered')
  })
})
