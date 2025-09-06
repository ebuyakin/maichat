// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { createInteraction } from '../../src/features/interaction/interaction.js'
import { createStore } from '../../src/core/store/memoryStore.js'
import { createMessagePair } from '../../src/core/models/messagePair.js'

// Mock executeSend to avoid network and return deterministic content
vi.mock('../../src/features/compose/pipeline.js', () => ({
  executeSend: vi.fn(async () => ({ content: 'ok' }))
}))

function setupDom() {
  document.body.innerHTML = `
    <div id="app">
      <div id="historyPane"></div>
      <input id="commandInput" />
      <div id="commandErr"></div>
      <textarea id="inputField"></textarea>
      <button id="sendBtn">Send</button>
    </div>
  `
  return {
    commandInput: document.getElementById('commandInput'),
    commandErrEl: document.getElementById('commandErr'),
    inputField: document.getElementById('inputField'),
    sendBtn: document.getElementById('sendBtn'),
    historyPaneEl: document.getElementById('historyPane')
  }
}

function createModeManager(initial = 'view'){
  let mode = initial
  let onChangeCb = () => {}
  return {
    get mode(){ return mode },
    set(modeName){ mode = modeName; onChangeCb && onChangeCb(mode) },
    onChange(cb){ onChangeCb = cb }
  }
}

describe('Re-ask flow (error pair)', () => {
  it('deletes the old error pair and appends a new completed pair at the end, inheriting topic/model', async () => {
    const store = createStore()
    // Seed a couple of pairs so the error is not the last
    const p1 = createMessagePair({ id: 'p1', topicId: store.rootTopicId, model: 'gpt-4o', userText: 'hello', assistantText: 'hi', createdAt: Date.now() - 3000 })
    const err = createMessagePair({ id: 'err1', topicId: store.rootTopicId, model: 'gpt-4o', userText: 'failing request', assistantText: '', createdAt: Date.now() - 2000 })
    err.lifecycleState = 'error'; err.errorMessage = 'quota'
    const p3 = createMessagePair({ id: 'p3', topicId: store.rootTopicId, model: 'gpt-4o', userText: 'another', assistantText: 'resp', createdAt: Date.now() - 1000 })
    // Use internal import helpers to preserve ids/timestamps
    store._importPair(p1)
    store._importPair(err)
    store._importPair(p3)

    const dom = setupDom()
    // Minimal stubs
    const historyRuntime = {
      renderCurrentView: vi.fn(),
      applyActivePart: vi.fn(),
      renderStatus: vi.fn(),
      getContextStats: vi.fn(() => ({ includedCount: 1 }))
    }
    const requestDebug = { toggle: vi.fn(), setPayload: vi.fn() }
    const hudRuntime = { enable: vi.fn() }
    const activeParts = {
      parts: [],
      active: () => null,
      setActiveById: vi.fn(),
      last: vi.fn()
    }
    // Lifecycle stub that behaves like the real one for pending flags
    let pending = false
    const lifecycle = {
      isPending: () => pending,
      beginSend: () => { pending = true },
      completeSend: () => { pending = false },
      handleNewAssistantReply: vi.fn(),
      setFilterQuery: vi.fn(),
      getBadgeState: vi.fn(() => ({ visible: false }))
    }
    const boundaryMgr = {
      updateVisiblePairs: vi.fn(),
      setModel: vi.fn(),
      applySettings: vi.fn(),
      getBoundary: vi.fn(() => ({ included: [] }))
    }
    const pendingMessageMeta = {}

    // Mode manager wiring (global)
    window.__modeManager = createModeManager('view')
    window.__MODES = { VIEW: 'view', INPUT: 'input', COMMAND: 'command' }

    const ctx = { store, activeParts, lifecycle, boundaryMgr, pendingMessageMeta, scrollController: { setAnimationEnabled: vi.fn() } }
    const interaction = createInteraction({
      ctx,
      dom,
      historyRuntime,
      requestDebug,
      hudRuntime
    })

    // Pre-checks
    expect(store.pairs.has('err1')).toBe(true)
    expect(store.getAllPairs().length).toBe(3)

    // Prepare Re-ask on the error pair
    interaction.prepareEditResend('err1')
    expect(window.__modeManager.mode).toBe('input')
    expect(dom.inputField.value).toBe('failing request')
    expect(pendingMessageMeta.model).toBe('gpt-4o')
    expect(pendingMessageMeta.topicId).toBe(store.rootTopicId)
    expect(window.__editingPairId).toBe('err1')

    // Click Send to perform re-ask flow
    dom.sendBtn.click()

    // Wait for async pipeline to resolve and UI updates
    await new Promise(r => setTimeout(r, 10))

    // Old error pair removed
    expect(store.pairs.has('err1')).toBe(false)

    // A new pair exists with the same user text, completed, and with inherited meta
    const all = store.getAllPairs()
    const newest = all.reduce((a,b) => (a.createdAt > b.createdAt ? a : b))
    expect(newest).toBeTruthy()
    expect(newest.userText).toBe('failing request')
    expect(newest.topicId).toBe(store.rootTopicId)
    expect(newest.model).toBe('gpt-4o')
    expect(newest.lifecycleState).toBe('complete')
    expect(newest.assistantText).toBe('ok')

    // Editing state cleared and input emptied
    expect(window.__editingPairId).toBe(null)
    expect(dom.inputField.value).toBe('')
  })
})
