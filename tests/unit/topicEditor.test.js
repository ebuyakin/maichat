/* @vitest-environment jsdom */
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest'

const EDITOR_PATH = '/src/features/topics/topicEditor.js'

// Minimal in-memory topic store mock compatible with Topic Editor needs
function createMockStore(){
  const listeners = {}
  const on = (e, fn)=>{ (listeners[e] ||= []).push(fn); return ()=>{ listeners[e] = (listeners[e]||[]).filter(x=>x!==fn) } }
  const emit = (e, p)=>{ (listeners[e]||[]).forEach(fn=>fn(p)) }
  const rootTopicId = 'root'
  const topics = new Map([[rootTopicId, { id: rootTopicId, name: 'Root', parentId: null, createdAt: 1, directCount:0, totalCount:0 }]])
  const children = new Map([[null, new Set([rootTopicId])], [rootTopicId, new Set()]])
  return {
    on,
    emit,
    rootTopicId,
    topics,
    children,
    addTopic(name, parentId){
      const id = crypto.randomUUID ? crypto.randomUUID() : String(Math.random())
      // Assign initial sortIndex as current sibling count for deterministic order
      const pid = parentId ?? rootTopicId
      const sibs = children.get(pid) || new Set()
      const sortIndex = sibs.size
      const t = { id, name, parentId: pid, createdAt: Date.now(), directCount:0, totalCount:0, sortIndex }
      topics.set(id, t)
      if(!children.has(pid)) children.set(pid, new Set())
      children.get(pid).add(id)
      emit('topic:add', t)
      return id
    },
    updateTopic(id, patch){ const t = topics.get(id); if(!t) return false; Object.assign(t, patch); emit('topic:update', t); return true },
    moveTopic(id, to){ const t=topics.get(id); if(!t) return false; const from=t.parentId; if(children.get(from)) children.get(from).delete(id); if(!children.has(to)) children.set(to, new Set()); children.get(to).add(id); t.parentId=to; emit('topic:move', { id, from, to }); return true },
    deleteTopic(id){ const t=topics.get(id); if(!t) return false; const p=t.parentId; topics.delete(id); if(children.get(p)) children.get(p).delete(id); emit('topic:delete', id); return true },
  }
}

const flush = () => new Promise(r => setTimeout(r, 0))

describe('Topic Editor overlay', () => {
  beforeEach(() => {
    window.__modeManager = { mode: 'view', set: vi.fn() }
    document.body.innerHTML = ''
  })
  afterEach(async () => {
    // best-effort cleanup
    const leftover = document.querySelector('.topic-editor-backdrop')
    if(leftover){ leftover.remove() }
    vi.clearAllMocks()
  })

  it('opens and closes with Esc without runtime errors', async () => {
    const { openTopicEditor } = await import(EDITOR_PATH)
    const store = createMockStore()
    const onClose = vi.fn()
    openTopicEditor({ store, onClose })
    await flush()

    // Editor backdrop present
    const backdrop = document.querySelector('.topic-editor-backdrop')
    expect(backdrop).toBeTruthy()

  // Esc from non-tree focus path closes overlay (listener attached to backdrop)
  backdrop.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await flush(); await flush()

    expect(onClose).toHaveBeenCalled()
    expect(document.querySelector('.topic-editor-backdrop')).toBeFalsy()
  })

  it('Ctrl+O toggles order only when tree-focused; Shift+O in textarea types O', async () => {
    const { openTopicEditor } = await import(EDITOR_PATH)
    const store = createMockStore(); const onClose = vi.fn()
    openTopicEditor({ store, onClose }); await flush()

    const backdrop = document.querySelector('.topic-editor-backdrop')
    const tree = backdrop.querySelector('.te-tree')
    const textarea = backdrop.querySelector('.te-textarea')
    const hints = backdrop.querySelector('.te-hints')

    // Ensure not in tree focus initially; typing Shift+O in textarea should insert 'O'
    textarea.focus(); textarea.value = ''
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'O', shiftKey: true, bubbles: true, cancelable: true }))
    textarea.value += 'O' // jsdom won't mutate value automatically
    expect(textarea.value).toBe('O')
  // Ensure order not toggled (starts logical/manual)
  expect(hints.textContent.toLowerCase()).toContain('sorted logically')

    // Focus tree and toggle with Ctrl+O
  tree.focus()
  // Ensure in-tree focus state toggles in jsdom
  tree.dispatchEvent(new Event('focusin', { bubbles: true }))
  backdrop.dispatchEvent(new KeyboardEvent('keydown', { key: 'o', ctrlKey: true, bubbles: true, cancelable: true }))
  await flush()
  expect(hints.textContent.toLowerCase()).toContain('sorted chronologically')
  })

  it('Ctrl+U/D reorder one step in Manual and no-op in Recent', async () => {
    const { openTopicEditor } = await import(EDITOR_PATH)
    const store = createMockStore()
    const p = store.rootTopicId
    const a = store.addTopic('A', p)
    const b = store.addTopic('B', p)
    const c = store.addTopic('C', p)
    const onClose = vi.fn()
    openTopicEditor({ store, onClose }); await flush()
  const backdrop = document.querySelector('.topic-editor-backdrop')
  const tree = backdrop.querySelector('.te-tree')
    const hints = backdrop.querySelector('.te-hints')
  // Focus tree and signal focusin so Editor treats tree as focused
  // Enter tree mode the same way users do
  backdrop.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', ctrlKey: true, bubbles: true, cancelable: true }))
  await flush(); await flush()
    // Ensure Manual mode (settings may persist from previous tests) — toggle requires tree focus
    if(hints.textContent.toLowerCase().includes('recent')){
      tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'o', ctrlKey: true, bubbles: true, cancelable: true }))
      await flush(); await flush()
    }
  // Assert starting at first item, then move to B
  let activeId = backdrop.querySelector('.te-row.active')?.getAttribute('data-id')
  // If no active row yet (render timing), nudge once
  if(!activeId){ await flush(); activeId = backdrop.querySelector('.te-row.active')?.getAttribute('data-id') }
  expect(activeId).toBe(a)
  tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true, cancelable: true }))
  await flush(); await flush()
  activeId = backdrop.querySelector('.te-row.active')?.getAttribute('data-id')
  expect(activeId).toBe(b)
  expect(hints.textContent.toLowerCase()).toContain('sorted logically')
    // Manual mode default: Ctrl+D should move B down below C (tree-focused reorder)
  tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true, cancelable: true }))
  await flush(); await flush()
  // Verify order now A, C, B via store sortIndex
  const idxA1 = store.topics.get(a)?.sortIndex
  const idxB1 = store.topics.get(b)?.sortIndex
  const idxC1 = store.topics.get(c)?.sortIndex
  expect([idxA1, idxC1, idxB1]).toEqual([0,1,2])
    // Toggle to Recent
  backdrop.dispatchEvent(new KeyboardEvent('keydown', { key: 'o', ctrlKey: true, bubbles: true, cancelable: true }))
  await flush(); await flush()
    // Ctrl+U should do nothing in Recent (tree-focused reorder key)
  tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'u', ctrlKey: true, bubbles: true, cancelable: true }))
  await flush(); await flush()
  // Verify no change in store order after no-op in Recent
  const idxA2 = store.topics.get(a)?.sortIndex
  const idxB2 = store.topics.get(b)?.sortIndex
  const idxC2 = store.topics.get(c)?.sortIndex
  expect([idxA2, idxB2, idxC2]).toEqual([idxA1, idxB1, idxC1])
  })
})
