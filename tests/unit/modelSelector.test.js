/* @vitest-environment jsdom */
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest'

// Absolute paths so mocks match SUT imports
const ROOT = '/Users/eugenebuyakin/Dev/mai-chat'
const SELECTOR_PATH = `${ROOT}/src/features/config/modelSelector.js`

vi.mock('/Users/eugenebuyakin/Dev/mai-chat/src/core/models/modelCatalog.js', () => {
  const models = [
    { id: 'alpha', enabled: true },
    { id: 'beta', enabled: true },
    { id: 'gamma', enabled: true },
  ]
  let active = 'beta'
  return {
    listModels: vi.fn(() => models.slice()),
    getActiveModel: vi.fn(() => active),
    setActiveModel: vi.fn((id)=>{ active = id }),
  }
})

const flush = () => new Promise(r => setTimeout(r, 0))

describe('Model Selector overlay', () => {
  let onSelect, onClose

  beforeEach(() => {
    // minimal mode manager used by openModal
    window.__modeManager = { mode: 'view', set: vi.fn() }
    document.body.innerHTML = ''
    onSelect = vi.fn()
    onClose = vi.fn()
  })

  afterEach(async () => {
    // Prefer graceful close to clean up global listeners
    if (document.getElementById('modelSelectorRoot')){
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      await flush()
    }
    const root = document.getElementById('modelSelectorRoot')
    if (root && root.parentNode) root.parentNode.removeChild(root)
    vi.clearAllMocks()
  })

  it('filters list and handles empty state focus, then backspace to recover', async () => {
    const { openModelSelector } = await import(SELECTOR_PATH)
    openModelSelector({ onSelect, onClose })
    await flush()

    // Type a filter that yields 1 match
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true, cancelable: true }))
    await flush()
    let items = document.querySelectorAll('.model-list .model-item')
    // 'gamma' only
    expect(items.length).toBe(1)

    // Make it empty (no model matches 'gz')
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true, cancelable: true }))
    await flush()
    items = document.querySelectorAll('.model-list .model-item')
    expect(items.length).toBe(0)

  // Focus handling in jsdom can be limited; ensure list is focusable (tabindex set)
  const listEl = document.querySelector('.model-list')
  expect(listEl?.getAttribute('tabindex')).toBe('0')

    // Backspace brings results back
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }))
    await flush()
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }))
    await flush()
    items = document.querySelectorAll('.model-list .model-item')
    expect(items.length).toBeGreaterThan(1)
  })

  it('selects with Enter after filtering, closes with Esc', async () => {
    const { openModelSelector } = await import(SELECTOR_PATH)
    openModelSelector({ onSelect, onClose })
    await flush()

  // Narrow down to 'gamma' via typing one char
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true, cancelable: true }))
  await flush()
  const only = document.querySelectorAll('.model-list .model-item')
  expect(only.length).toBe(1)
  expect(only[0]?.getAttribute('data-name')).toBe('gamma')

    // Enter selects the only match
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await flush()
    expect(onSelect).toHaveBeenCalledWith('gamma')
    expect(document.getElementById('modelSelectorRoot')).toBeNull()

    // Reopen and Esc closes
    openModelSelector({ onSelect, onClose })
    await flush()
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
  await flush(); await flush()
  expect(onClose).toHaveBeenCalled()
  expect(document.getElementById('modelSelectorRoot')).toBeNull()
  })

  it('selecting a model updates active model immediately (setActiveModel called)', async () => {
    const { openModelSelector } = await import(SELECTOR_PATH)
    const catalog = await import('/Users/eugenebuyakin/Dev/mai-chat/src/core/models/modelCatalog.js')
    openModelSelector({ onSelect, onClose })
    await flush()

    // Type filter for 'alpha' (ensure unique match)
    for (const ch of ['a','l','p','h','a']){
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true, cancelable: true }))
      await flush()
    }
    const only = document.querySelectorAll('.model-list .model-item')
    expect(only.length).toBe(1)
    expect(only[0]?.getAttribute('data-name')).toBe('alpha')

    // Enter selects and should call setActiveModel('alpha') inside selector
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await flush()

    expect(catalog.getActiveModel()).toBe('alpha')
    expect(onSelect).toHaveBeenCalledWith('alpha')
  })
})
