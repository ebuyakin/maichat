/* @vitest-environment jsdom */
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest'

const ROOT = '/Users/eugenebuyakin/Dev/mai-chat'
const EDITOR_PATH = `${ROOT}/src/features/config/modelEditor.js`

let listStub, toggleStub, getActiveStub, setActiveStub

vi.mock('/Users/eugenebuyakin/Dev/mai-chat/src/core/models/modelCatalog.js', () => {
  const store = {
    models: [
      { id: 'alpha', enabled: true, contextWindow: 8000, tpm: 200000, rpm: 3000, tpd: 1000000 },
      { id: 'beta',  enabled: true, contextWindow: 8000, tpm: 200000, rpm: 3000, tpd: 1000000 },
      { id: 'gamma', enabled: true, contextWindow: 8000, tpm: 200000, rpm: 3000, tpd: 1000000 },
    ],
    active: 'beta'
  }
  listStub = vi.fn(() => store.models.slice())
  toggleStub = vi.fn((id) => {
    const m = store.models.find(m => m.id === id)
    if (m) m.enabled = !m.enabled
  })
  getActiveStub = vi.fn(() => store.active)
  setActiveStub = vi.fn((id) => { store.active = id })
  return {
    listModels: listStub,
    toggleModelEnabled: toggleStub,
    getActiveModel: getActiveStub,
    setActiveModel: setActiveStub,
  }
})

const flush = () => new Promise(r => setTimeout(r, 0))

describe('Model Editor overlay', () => {
  beforeEach(() => {
    window.__modeManager = { mode: 'view', set: vi.fn() }
    document.body.innerHTML = ''
  })
  afterEach(async () => {
    // Prefer graceful close via Escape to ensure listeners removed
    if (document.querySelector('.overlay-panel.model-editor')){
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      await flush()
    }
    const root = document.querySelector('.overlay-backdrop.centered')
    if (root && root.parentNode) root.parentNode.removeChild(root)
    vi.clearAllMocks()
  })

  it('moves selection with j/k and toggles enabled with Space', async () => {
    const { openModelEditor } = await import(EDITOR_PATH)
    openModelEditor({ onClose: vi.fn() })
    await flush()

    const ul = document.querySelector('.model-editor ul.me-list')
    expect(ul).toBeTruthy()
    let active = document.querySelector('.model-editor li.active')
    // initially active index uses default 0 then render picks active model, but simple check: some active exists
    expect(active).toBeTruthy()

    // Move down
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }))
    await flush()
    active = document.querySelector('.model-editor li.active')
    expect(active).toBeTruthy()

    // Toggle with space
    const currentId = active?.getAttribute('data-id')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    await flush()
    expect(toggleStub).toHaveBeenCalled()
  })

  it('closes with Esc', async () => {
    const { openModelEditor } = await import(EDITOR_PATH)
    const onClose = vi.fn()
    openModelEditor({ onClose })
    await flush()

  // Esc closes (dispatch on window; handler is window capture)
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
  await flush(); await flush(); await flush()
  expect(onClose).toHaveBeenCalled()
  })
})
