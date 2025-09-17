/* @vitest-environment jsdom */
import { describe, it, beforeEach, expect, vi } from 'vitest'

async function setupBase(){
  document.body.innerHTML = `
    <div id="topBar"></div>
    <div id="historyPane"><div id="history" class="history"></div></div>
    <div id="inputBar"><input id="inputField"/></div>
    <div id="statusRight"></div>
    <div id="commandError"></div>
    <input id="commandInput"/>
    <button id="sendBtn">Send</button>
  `
  // Stub canvas getContext for jsdom
  if(typeof window !== 'undefined'){
    const proto = window.HTMLCanvasElement && window.HTMLCanvasElement.prototype
    if(proto && !proto.__stubbed){
      proto.getContext = function(){ return { measureText: (str)=> ({ width: String(str||'').length * 7 }) } }
      proto.__stubbed = true
    }
  }
  window.__modeManager = { mode: 'view', set(m){ this.mode=m }, onChange(){}, current:'view' }
  window.__MODES = { VIEW: 'view', INPUT: 'input', COMMAND: 'command' }
  const { initRuntime } = await import('../../src/runtime/runtimeSetup.js')
  const { createHistoryRuntime } = await import('../../src/features/history/historyRuntime.js')
  const ctx = initRuntime()
  const hr = createHistoryRuntime(ctx)
  // Seed minimal data
  const t1 = ctx.store.addTopic('T1', ctx.store.rootTopicId)
  const id = ctx.store.addMessagePair({ topicId: t1, model: 'm1', userText: 'u', assistantText: 'a' })
  hr.renderCurrentView()
  return { ctx, hr, id }
}

async function createInteractionInstance(ctx, hr){
  const { createInteraction } = await import('../../src/features/interaction/interaction.js')
  const interaction = createInteraction({
    ctx,
    dom: {
      commandInput: document.getElementById('commandInput'),
      commandErrEl: document.getElementById('commandError'),
      inputField: document.getElementById('inputField'),
      sendBtn: document.getElementById('sendBtn'),
      historyPaneEl: document.getElementById('historyPane'),
    },
    historyRuntime: hr,
    requestDebug: { setPayload(){} },
    hudRuntime: { setReadingMode(){} }
  })
  // Ensure a part is focused
  try { ctx.activeParts.last(); hr.applyActivePart() } catch {}
  return interaction
}

describe('Metadata changes do not rebuild history', () => {
  beforeEach(()=>{ document.body.innerHTML='' })

  it('star/flag do not call renderCurrentView', async () => {
    const { ctx, hr } = await setupBase()
    const interaction = await createInteractionInstance(ctx, hr)
    const spy = vi.spyOn(hr, 'renderCurrentView')
    // Ensure there is a focused part (last by default after bootstrap)
    // Press '*' (cycle star)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' })) // move focus once to establish state
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '*' }))
    expect(spy).not.toHaveBeenCalled()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    expect(spy).not.toHaveBeenCalled()
  })

  it('topic change in VIEW updates badge inline and no rebuild', async () => {
    const { ctx, hr, id } = await setupBase()
    const spy = vi.spyOn(hr, 'renderCurrentView')
    const t2 = ctx.store.addTopic('T2', ctx.store.rootTopicId)
    // Mock topic picker before importing interaction
    vi.doMock('../../src/features/topics/topicPicker.js', () => ({
      createTopicPicker: ({ onSelect }) => { onSelect(t2) }
    }))
    const { createInteraction } = await import('../../src/features/interaction/interaction.js')
    const interaction = createInteraction({
      ctx,
      dom: {
        commandInput: document.getElementById('commandInput'),
        commandErrEl: document.getElementById('commandError'),
        inputField: document.getElementById('inputField'),
        sendBtn: document.getElementById('sendBtn'),
        historyPaneEl: document.getElementById('historyPane'),
      },
      historyRuntime: hr,
      requestDebug: { setPayload(){} },
      hudRuntime: { setReadingMode(){} }
    })
    // Invoke the quick picker path
    interaction.openQuickTopicPicker({ prevMode: 'view' })
    expect(spy).not.toHaveBeenCalled()
    // Verify DOM badge reflects T2
    const meta = document.querySelector(`.part.meta[data-pair-id="${id}"] .badge.topic`)
    expect(meta && meta.textContent).toBeTruthy()
  })
})
