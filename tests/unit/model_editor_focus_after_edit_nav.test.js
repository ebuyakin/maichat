/* @vitest-environment jsdom */
import { describe, it, beforeEach, expect, vi } from 'vitest'

vi.mock('/src/core/models/modelCatalog.js', () => {
  return {
    listModels: () => ([
      { id: 'alpha', enabled: true, contextWindow: 8000, tpm: 1000, rpm: 10, tpd: 10000 },
      { id: 'beta', enabled: true, contextWindow: 8000, tpm: 1000, rpm: 10, tpd: 10000 },
    ]),
    getActiveModel: () => 'alpha',
    setActiveModel: vi.fn(),
    updateModelMeta: vi.fn(),
    setModelEnabled: vi.fn(),
    addModel: vi.fn(),
    deleteModel: vi.fn(),
  }
})

describe('Model Editor focus after edit -> nav', () => {
  beforeEach(() => { document.body.innerHTML = ''; window.__modeManager = { mode: 'view', set: vi.fn() } })

  it('keeps focus in overlay after editing numeric then j', async () => {
    const { openModelEditor } = await import('../../src/features/config/modelEditor.js')
    openModelEditor({ onClose: vi.fn() })
    // Focus first numeric input (contextWindow)
    const firstRow = document.querySelector('.me-list li.me-row')
    expect(firstRow).toBeTruthy()
    const cwInput = firstRow.querySelector('input.me-num')
    cwInput.focus()
    cwInput.value = '9'
    // Press j to move
    const evt = new KeyboardEvent('keydown', { key: 'j', bubbles: true })
    document.querySelector('.overlay-backdrop.centered').dispatchEvent(evt)
    // After handling, something inside overlay should be focused
    const overlay = document.querySelector('.overlay-backdrop.centered')
    expect(overlay.contains(document.activeElement)).toBe(true)
  })
})
