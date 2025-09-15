import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Create a tiny harness to call renderCurrentView via createHistoryRuntime
import { createHistoryRuntime } from '../../src/features/history/historyRuntime.js'

function makeStore(){
  const topics = new Map()
  const rootTopicId = 'root'
  topics.set(rootTopicId, { id: rootTopicId, name: 'Root', parentId: null })
  const tA = { id:'A', name:'AI', parentId: rootTopicId }
  const tB = { id:'B', name:'Notes', parentId: rootTopicId }
  topics.set('A', tA)
  topics.set('B', tB)
  const pairs = new Map()
  const list = []
  function add(p){ pairs.set(p.id,p); list.push(p) }
  const now = Date.now()
  add({ id:'p1', topicId:'A', model:'gpt', userText:'u1', assistantText:'a1', createdAt: now-2000, lifecycleState:'complete', star:0 })
  add({ id:'p2', topicId:'B', model:'llama', userText:'u2', assistantText:'a2', createdAt: now-1000, lifecycleState:'complete', star:0 })
  return {
    topics,
    pairs,
    rootTopicId,
    getAllTopics(){ return Array.from(topics.values()) },
    getTopicPath(id){
      const path=[]; let cur=topics.get(id); while(cur){ path.unshift(cur.name||''); cur = cur.parentId ? topics.get(cur.parentId) : null }
      return path
    },
    getAllPairs(){ return list.slice() },
    updatePair(id, patch){ const p=pairs.get(id); if(!p) return; Object.assign(p, patch) },
    addMessagePair(p){ const id=p.id||String(Math.random()); const createdAt=p.createdAt||Date.now(); const rec={ id, createdAt, lifecycleState:'complete', star:0, colorFlag:null, ...p }; pairs.set(id, rec); list.push(rec); return id },
  }
}

function makeCtx({ fq, currentTopicId, currentModel }){
  const store = makeStore()
  const parts = []
  const activeParts = {
    parts,
    setParts: (arr)=>{ parts.length=0; parts.push(...arr) },
    active: ()=> parts.length ? parts[0] : null,
    setActiveById: ()=>{},
    last: ()=>{},
    get activeIndex(){ return 0 },
    set activeIndex(_){},
  }
  const historyView = { render: vi.fn() }
  const scrollController = { remeasure: vi.fn(), setActiveIndex: vi.fn(), ensureVisible: vi.fn(), alignTo: vi.fn() }
  const boundaryMgr = {
    applySettings: vi.fn(), setModel: vi.fn(), updateVisiblePairs: vi.fn(),
    getBoundary: ()=>({ included: store.getAllPairs(), stats: { totalIncludedTokens: 0, includedCount: store.getAllPairs().length } })
  }
  const lifecycle = { getFilterQuery: ()=> fq, updateNewReplyBadgeVisibility: vi.fn(), bindApplyActivePart: vi.fn() }
  const pendingMessageMeta = { topicId: currentTopicId, model: currentModel }
  const ctx = { store, activeParts, historyView, scrollController, boundaryMgr, lifecycle, pendingMessageMeta }
  const rt = createHistoryRuntime(ctx)
  return { rt, ctx, store, historyView }
}

describe('history re-render filter context', ()=>{
  let origDocument, origWindow, origRAF
  beforeEach(()=>{
    // Minimal DOM stubs for historyRuntime
    origDocument = globalThis.document
    origWindow = globalThis.window
    origRAF = globalThis.requestAnimationFrame
    const stubEl = ()=>({
      style: {},
      clientWidth: 800,
      clientHeight: 600,
      offsetWidth: 800,
      getBoundingClientRect: ()=>({ width: 800, height: 600, top:0, left:0, right:800, bottom:600 }),
      querySelectorAll: ()=>[],
      setAttribute: ()=>{},
      removeAttribute: ()=>{},
      addEventListener: ()=>{},
      removeEventListener: ()=>{},
      classList: { add: ()=>{}, remove: ()=>{}, toggle: ()=>{} },
      set textContent(_){},
      get textContent(){ return '' },
      set title(_){},
      get title(){ return '' },
      contains: ()=>false,
    })
    globalThis.document = {
      getElementById: (id)=>{
        if(id==='historyPane') return stubEl()
        if(id==='commandError') return stubEl()
        if(id==='topBar') return stubEl()
        if(id==='inputBar') return stubEl()
        return null
      },
      createElement: (tag)=>{
        if(tag === 'canvas'){
          return {
            getContext: ()=>({ font: '', measureText: (str)=>({ width: (str||'').length * 7 }) })
          }
        }
        return stubEl()
      },
      documentElement: {},
      querySelectorAll: ()=>[],
      body: { appendChild: ()=>{} },
    }
    globalThis.window = {
      addEventListener: ()=>{},
      removeEventListener: ()=>{},
      innerHeight: 800,
      innerWidth: 1200,
      getComputedStyle: ()=>({
        getPropertyValue: ()=> '0',
        paddingLeft: '0px', paddingRight: '0px', paddingTop: '0px', paddingBottom: '0px',
        fontWeight: '400', fontSize: '13px', fontFamily: 'sans-serif',
      }),
    }
  globalThis.requestAnimationFrame = (fn)=> { try { fn() } catch {} }
  })
  afterEach(()=>{
    globalThis.document = origDocument
    globalThis.window = origWindow
    globalThis.requestAnimationFrame = origRAF
  })

  it('applies bare t (current topic) on re-render', ()=>{
    const { rt, historyView } = makeCtx({ fq: 't', currentTopicId: 'A', currentModel: 'gpt' })
    // No command error element in test; render should not throw
    rt.renderCurrentView({ preserveActive: true })
    expect(historyView.render).toHaveBeenCalled()
    const parts = historyView.render.mock.calls[0][0]
    // Expect only topic A pairs (one pair -> multiple parts; all should share pairId 'p1')
    const pairIds = Array.from(new Set(parts.map(p=> p.pairId)))
    expect(pairIds).toEqual(['p1'])
  })

  it('applies bare m (current model) on re-render', ()=>{
    const { rt, historyView } = makeCtx({ fq: 'm', currentTopicId: 'A', currentModel: 'llama' })
    rt.renderCurrentView({ preserveActive: true })
    expect(historyView.render).toHaveBeenCalled()
    const parts = historyView.render.mock.calls[0][0]
    const pairIds = Array.from(new Set(parts.map(p=> p.pairId)))
    // Only model 'llama' pair is p2
    expect(pairIds).toEqual(['p2'])
  })
})
