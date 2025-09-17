/* @vitest-environment jsdom */
import { describe, it, beforeEach, expect, vi } from 'vitest'

vi.mock('/src/core/models/modelCatalog.js', () => {
  return {
    listModels: () => ([
      { id: 'a', enabled: true, contextWindow: 8000, tpm: 1000, rpm: 10, tpd: 10000 },
      { id: 'b', enabled: true, contextWindow: 8000, tpm: 1000, rpm: 10, tpd: 10000 },
      { id: 'c', enabled: true, contextWindow: 8000, tpm: 1000, rpm: 10, tpd: 10000 },
    ]),
    getActiveModel: () => 'a',
    setActiveModel: vi.fn(),
    updateModelMeta: vi.fn(),
    setModelEnabled: vi.fn(),
    addModel: vi.fn(),
    deleteModel: vi.fn(),
  }
})

describe('Model Editor g/G focus retention', () => {
  beforeEach(() => { document.body.innerHTML = ''; window.__modeManager = { mode: 'view', set: vi.fn() } })

  it('keeps focus after g (first) and G (last)', async () => {
    const { openModelEditor } = await import('../../src/features/config/modelEditor.js')
    openModelEditor({ onClose: vi.fn() })
    const overlay = document.querySelector('.overlay-backdrop.centered')

    // g
    overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }))
    expect(overlay.contains(document.activeElement)).toBe(true)

    // G (Shift+g)
    overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'G', shiftKey: true, bubbles: true }))
    expect(overlay.contains(document.activeElement)).toBe(true)
  })
})
