/* @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// We import the interaction factory to attach listeners
import { createInteraction } from '../../src/features/interaction/interaction.js'

// Minimal stubs for required dependencies and DOM
function setupDom(){
  document.body.innerHTML = `
    <div id="app">
      <div id="topBar">
        <div id="statusRight">
          <span id="messageCount" class="mc">0</span>
          <button id="appMenuBtn" aria-haspopup="true" aria-expanded="false" class="menu-btn" tabindex="0">⋮</button>
          <div id="appMenu" class="app-menu" hidden>
            <ul>
              <li data-action="topic-editor"><span class="label">Topic Editor</span></li>
              <li data-action="model-editor"><span class="label">Model Editor</span></li>
              <li data-action="help"><span class="label">Help</span></li>
            </ul>
          </div>
        </div>
      </div>
      <div id="historyPane"><div id="history"></div></div>
      <div id="inputBar">
        <input id="inputField" />
        <button id="sendBtn">Send</button>
      </div>
      <input id="commandInput" /><span id="commandError"></span>
    </div>
  `
}

function createModeManager(){
  let mode = 'view'
  const listeners = []
  return {
    mode,
    set(m){ mode=m; listeners.forEach(f=>f(m)) },
    onChange(fn){ listeners.push(fn) }
  }
}

function createHistoryRuntime(){
  return {
    renderCurrentView: vi.fn(),
    applyActivePart: vi.fn(),
    renderStatus: vi.fn(),
    getContextStats: ()=>({ includedCount: 1 }),
    setSendDebug: vi.fn(),
    updateMessageCount: vi.fn(),
  }
}

function createMinimalRuntime(){
  return {
    store: {
      rootTopicId: 'root',
      pairs: new Map(),
      topics: new Map([[ 'root', { id:'root', name:'Root', children:[] } ]]),
      getAllPairs(){ return [] },
      getTopicPath(){ return ['Root'] },
      updatePair: vi.fn(),
      removePair: vi.fn(),
      addMessagePair: vi.fn().mockReturnValue('p1'),
    },
    activeParts: {
      parts: [],
      active: ()=>null,
      setActiveById: vi.fn(),
      next: vi.fn(),
      prev: vi.fn(),
      last: vi.fn(),
      first: vi.fn(),
    },
    lifecycle: {
      isPending: ()=>false,
      beginSend: vi.fn(),
      completeSend: vi.fn(),
      handleNewAssistantReply: vi.fn(),
      setFilterQuery: vi.fn(),
    },
    boundaryMgr: {
      updateVisiblePairs: vi.fn(),
      setModel: vi.fn(),
      applySettings: vi.fn(),
      getBoundary: ()=>({ included: [] }),
    },
    pendingMessageMeta: { },
    scrollController: { alignTo: vi.fn(), remeasure: vi.fn(), setAnimationEnabled: vi.fn() },
  }
}

// Mock window globals used by interaction
function installGlobals(){
  const modeManager = createModeManager()
  window.__modeManager = modeManager
  window.__hud = { notify: ()=>{}, info: ()=>{} }
  window.modalIsActive = ()=> false
  return modeManager
}

describe('Menu overlay open/close and navigation', ()=>{
  beforeEach(()=>{
    setupDom()
    installGlobals()
  })

  it('opens on Ctrl+. and supports j/k navigation', ()=>{
    const ctx = createMinimalRuntime()
    const historyRuntime = createHistoryRuntime()
    const interaction = createInteraction({
      ctx,
      dom: {
        commandInput: document.getElementById('commandInput'),
        commandErrEl: document.getElementById('commandError'),
        inputField: document.getElementById('inputField'),
        sendBtn: document.getElementById('sendBtn'),
        historyPaneEl: document.getElementById('historyPane'),
      },
      historyRuntime,
      requestDebug: { toggle: ()=>{}, setPayload: ()=>{} },
      hudRuntime: { setReadingMode: ()=>{}, enable: ()=>{} }
    })
    // Simulate Ctrl+.
    const evt = new KeyboardEvent('keydown', { key: '.', ctrlKey: true, bubbles: true })
    window.dispatchEvent(evt)
    const backdrop = document.querySelector('.overlay-backdrop.menu-overlay')
    const menu = document.getElementById('appMenu')
    expect(backdrop).toBeTruthy()
    expect(menu.hasAttribute('hidden')).toBeFalsy()
    // Ensure first item is active
    const items = Array.from(menu.querySelectorAll('li'))
    const activeIdx0 = items.findIndex(li=> li.classList.contains('active'))
    expect(activeIdx0).toBe(0)
    // j key moves selection down
    const jEvt = new KeyboardEvent('keydown', { key: 'j', bubbles: true })
    backdrop.dispatchEvent(jEvt)
    const activeIdx1 = items.findIndex(li=> li.classList.contains('active'))
    expect(activeIdx1).toBe(1)
    // k key moves selection up
    const kEvt = new KeyboardEvent('keydown', { key: 'k', bubbles: true })
    backdrop.dispatchEvent(kEvt)
    const activeIdx2 = items.findIndex(li=> li.classList.contains('active'))
    expect(activeIdx2).toBe(0)
    // Escape closes
    const escEvt = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    backdrop.dispatchEvent(escEvt)
    // After close, menu should be hidden again
    expect(menu.hasAttribute('hidden')).toBeTruthy()
  })

  it('ensures exclusive highlight on hover', ()=>{
    const ctx = createMinimalRuntime()
    const historyRuntime = createHistoryRuntime()
    createInteraction({
      ctx,
      dom: {
        commandInput: document.getElementById('commandInput'),
        commandErrEl: document.getElementById('commandError'),
        inputField: document.getElementById('inputField'),
        sendBtn: document.getElementById('sendBtn'),
        historyPaneEl: document.getElementById('historyPane'),
      },
      historyRuntime,
      requestDebug: { toggle: ()=>{}, setPayload: ()=>{} },
      hudRuntime: { setReadingMode: ()=>{}, enable: ()=>{} }
    })
    // Open menu
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '.', ctrlKey: true, bubbles: true }))
    const backdrop = document.querySelector('.overlay-backdrop.menu-overlay')
    const menu = document.getElementById('appMenu')
    const items = Array.from(menu.querySelectorAll('li'))
    // Hover over third item
    const hoverEvt = new MouseEvent('mouseover', { bubbles: true })
    items[2].dispatchEvent(hoverEvt)
    const activeCount = items.filter(li=> li.classList.contains('active')).length
    expect(activeCount).toBe(1)
    expect(items[2].classList.contains('active')).toBe(true)
  })
})
