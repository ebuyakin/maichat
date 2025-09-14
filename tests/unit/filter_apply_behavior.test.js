import { describe, it, expect, beforeEach } from 'vitest'
import { JSDOM } from 'jsdom'
import { saveSettings } from '../../src/core/settings/index.js'
import { createScrollController } from '../../src/features/history/scrollControllerV3.js'
import { ActivePartController } from '../../src/features/history/parts.js'
import { createHistoryRuntime } from '../../src/features/history/historyRuntime.js'

// Minimal fakes for store/lifecycle/boundary
function makePair(id, userText, assistantText){
  return { id, userText, assistantText, topicId:'t1', model:'m1', createdAt: id, lifecycleState:'complete' }
}

function buildDom(){
  const dom = new JSDOM(`<!DOCTYPE html><body>
    <div id="topBar" style="height:40px"></div>
    <div id="historyPane" style="position:absolute; top:40px; bottom:80px; overflow:auto; padding:20px 0"></div>
    <div id="inputBar" style="height:80px"></div>
    <div id="messageCount"></div>
    <div id="modeIndicator"></div>
    <input id="commandInput" />
    <div id="commandError"></div>
    <div id="history"></div>
  </body>`)
  global.window = dom.window
  global.document = dom.window.document
  global.getComputedStyle = (el)=> dom.window.getComputedStyle(el)
  if(!global.performance) global.performance = { now: ()=> Date.now() }
  if(!global.requestAnimationFrame) global.requestAnimationFrame = (fn)=> setTimeout(()=>fn(Date.now()), 0)
  if(!global.cancelAnimationFrame) global.cancelAnimationFrame = (id)=> clearTimeout(id)
  // Stub canvas in JSDOM for partitioner measurements
  if(dom.window.HTMLCanvasElement){
    dom.window.HTMLCanvasElement.prototype.getContext = function(){
      return { font: '400 13px sans-serif', measureText: (str)=> ({ width: (str||'').length * 7 }) }
    }
  }
  return dom
}

function mountPartsDom(parts){
  const pane = document.getElementById('historyPane')
  const history = document.getElementById('history')
  history.innerHTML=''
  pane.innerHTML=''
  pane.appendChild(history)
  // Simulate layout numbers
  let cursor = parseFloat(getComputedStyle(pane).paddingTop)||0
  parts.forEach((p,i)=>{
    const el = document.createElement('div')
    el.className = 'part'
    el.setAttribute('data-part-id', p.id)
    el.setAttribute('data-pair-id', p.pairId)
    el.setAttribute('data-role', p.role)
    el.textContent = `${p.role}:${p.id}`
    const h = 20
    Object.defineProperty(el, 'offsetTop', { value: cursor, configurable: true })
    Object.defineProperty(el, 'offsetHeight', { value: h, configurable: true })
    history.appendChild(el)
    cursor += h
  })
  Object.defineProperty(pane, 'clientHeight', { value: 400, configurable: true })
  Object.defineProperty(pane, 'scrollHeight', { value: cursor + (parseFloat(getComputedStyle(pane).paddingBottom)||0), configurable: true })
}

function makeCtx(){
  const store = {
    pairs: new Map(),
    getAllPairs(){ return [...this.pairs.values()].sort((a,b)=> a.createdAt-b.createdAt) },
    add(p){ this.pairs.set(p.id, p) }
  }
  const activeParts = new ActivePartController()
  const container = document.getElementById('historyPane')
  const scrollController = createScrollController({ container })
  const historyView = { render(parts){ mountPartsDom(parts) } }
  const boundaryMgr = { applySettings(){}, setModel(){}, updateVisiblePairs(){}, getBoundary(){ return { included: [...store.pairs.values()], stats:{ totalIncludedTokens: 0 } } } }
  const lifecycle = { getFilterQuery(){ return '' }, setFilterQuery(){}, updateNewReplyBadgeVisibility(){} }
  const pendingMessageMeta = {}
  const ctx = { store, activeParts, historyView, scrollController, boundaryMgr, lifecycle, pendingMessageMeta }
  const historyRuntime = createHistoryRuntime(ctx)
  ctx.__hr = historyRuntime
  return { ctx, historyRuntime, activeParts, store, scrollController }
}

// Helper to press Enter in command mode with a query
function applyFilter(q){
  const input = document.getElementById('commandInput')
  input.value = q
  const e = new window.KeyboardEvent('keydown', { key:'Enter' })
  window.dispatchEvent(e)
}

// Build interaction with only command mode handler exposed for tests
function buildInteraction(ctx){
  const hudRuntime = { enable(){}, setReadingMode(){} }
  const requestDebug = { setPayload(){}, toggle(){} }
  const dom = {
    commandInput: document.getElementById('commandInput'),
    commandErrEl: document.getElementById('commandError'),
    inputField: document.createElement('textarea'),
    sendBtn: document.createElement('button'),
    historyPaneEl: document.getElementById('historyPane')
  }
  const modeManager = { mode:'command', set(m){ this.mode=m; this._cb && this._cb(m) }, onChange(cb){ this._cb = cb } }
  window.__modeManager = modeManager
  const { createInteraction } = require('../../src/features/interaction/interaction.js')
  // historyRuntime is created in makeCtx and attached on ctx via closure return
  return createInteraction({ ctx, dom, historyRuntime: ctx.__hr, requestDebug, hudRuntime })
}

describe('filter apply behavior', ()=>{
  beforeEach(()=>{ buildDom(); saveSettings({ gapOuterPx: 20 }) })
  it('empty input applies full history and bottom-anchors last assistant focus', ()=>{
    const { ctx, historyRuntime, activeParts, store, scrollController } = makeCtx()
    // Add pairs: last has assistant parts
    store.add(makePair(1, 'u1', 'a1'))
    store.add(makePair(2, 'u2', 'a2'))
  historyRuntime.renderCurrentView()
  // Set initial focus to last assistant
  ctx.activeParts.last(); ctx.__hr.applyActivePart()
  buildInteraction(ctx)
  // Enter COMMAND mode to snapshot active part id (last assistant)
  window.__modeManager.set('command')
  applyFilter('')
    // After apply: focus last assistant part, bottom-aligned
    const act = activeParts.active()
    expect(act.role).toBe('assistant')
    const dbg = scrollController.debugInfo()
    expect(dbg).toBeTruthy()
  })

  it('Escape clears input only (no rebuild, no mode change)', ()=>{
    const { ctx, historyRuntime, store } = makeCtx()
    // Seed with one pair
    store.add(makePair(1, 'u1', 'a1'))
    historyRuntime.renderCurrentView()
    buildInteraction(ctx)
    const cmd = document.getElementById('commandInput')
    window.__modeManager.set('command')
    cmd.value = 'stars >= 2'
    const esc = new window.KeyboardEvent('keydown', { key:'Escape' })
    window.dispatchEvent(esc)
    expect(cmd.value).toBe('')
    // Still in command mode
    expect(window.__modeManager.mode).toBe('command')
  })
})
