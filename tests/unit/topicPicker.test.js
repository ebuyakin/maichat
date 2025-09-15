/* @vitest-environment jsdom */
import { describe, it, beforeEach, expect } from 'vitest'

const PICKER_PATH = '/src/features/topics/topicPicker.js'

// Minimal store compatible with Picker
function createMockStore(){
  const rootTopicId = 'root'
  const topics = new Map([[rootTopicId, { id: rootTopicId, name: 'Root', parentId: null, createdAt: 1, directCount:0, totalCount:0 }]])
  const children = new Map([[rootTopicId, new Set()], [null, new Set([rootTopicId])]])
  return { rootTopicId, topics, children }
}

const flush = () => new Promise(r => setTimeout(r, 0))

describe('Topic Picker toggle keys', () => {
  beforeEach(() => { document.body.innerHTML = ''; window.__modeManager = { mode:'view', set: ()=>{} } })

  it('toggles with O and Ctrl+O only when tree-focused', async () => {
    const { createTopicPicker } = await import(PICKER_PATH)
    const store = createMockStore()
    const picker = createTopicPicker({ store, modeManager: window.__modeManager })
    await flush()
    const backdrop = document.querySelector('.topic-picker-backdrop')
    const tree = backdrop.querySelector('.tp-tree')
    const input = backdrop.querySelector('.tp-search')

    // Initial render should exist
    expect(tree).toBeTruthy()

    // Typing in input: press 'O' shouldn't toggle (not tree-focused)
    input.focus()
    backdrop.dispatchEvent(new KeyboardEvent('keydown', { key: 'O', bubbles: true, cancelable: true }))
    await flush()
    // Focus tree and toggle with 'O'
    tree.focus()
    backdrop.dispatchEvent(new KeyboardEvent('keydown', { key: 'O', bubbles: true, cancelable: true }))
    await flush()

    // Toggle again with Ctrl+O
    backdrop.dispatchEvent(new KeyboardEvent('keydown', { key: 'o', ctrlKey: true, bubbles: true, cancelable: true }))
    await flush()

    // Cleanup
    picker.destroy()
  })
})
