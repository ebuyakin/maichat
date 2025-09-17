/* @vitest-environment jsdom */
import { describe, it, beforeEach, expect, vi } from 'vitest'

vi.mock('/src/core/models/modelCatalog.js', () => {
  let active = 'beta'
  return {
    listModels: () => ([
      { id: 'alpha', enabled: true },
      { id: 'beta', enabled: true },
      { id: 'gamma', enabled: true },
    ]),
    getActiveModel: () => active,
    setActiveModel: (id) => { active = id },
  }
})

describe('Model Selector dirty signaling', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    window.__modeManager = { mode: 'view', set: vi.fn() }
  })

  it('calls onClose({dirty:false}) when closed without selection', async () => {
    const { openModelSelector } = await import('../../src/features/config/modelSelector.js')
    const onClose = vi.fn()
    openModelSelector({ onClose })
    const root = document.getElementById('modelSelectorRoot')
    // Click outside closes
    root.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onClose).toHaveBeenCalled()
    const arg = onClose.mock.calls[0][0] || {}
    expect(arg.dirty).toBe(false)
  })

  it('calls onClose({dirty:true}) when selection changes', async () => {
    const { openModelSelector } = await import('../../src/features/config/modelSelector.js')
    const onClose = vi.fn()
    openModelSelector({ onClose })
    // Move to a different model via j
    const root = document.getElementById('modelSelectorRoot')
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }))
    // Select with Enter
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(onClose).toHaveBeenCalled()
    const arg = onClose.mock.calls[0][0] || {}
    expect(arg.dirty).toBe(true)
  })
})
