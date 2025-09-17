/* @vitest-environment jsdom */
import { describe, it, beforeEach, expect, vi } from 'vitest'

// lightweight mode manager mock
function createModeManager(initial){
  let mode = initial
  const listeners = []
  return {
    get mode(){ return mode },
    set: (m)=>{ mode=m; listeners.forEach(fn=>fn(mode)) },
    onChange: (fn)=>{ listeners.push(fn) }
  }
}

vi.stubGlobal('__modeManager', createModeManager('view'))

vi.mock('/src/core/models/modelCatalog.js', () => ({
  listModels: () => ([{ id:'m1', enabled:true, contextWindow:8000, tpm:1000, rpm:60, tpd:10000 }]),
  getActiveModel: () => 'm1',
  setActiveModel: vi.fn(),
  updateModelMeta: vi.fn(),
  setModelEnabled: vi.fn(),
  addModel: vi.fn(),
  deleteModel: vi.fn(),
}))

import { openModal } from '../../src/shared/openModal.js'

describe('Model Editor: mode restore on Esc close', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('restores mode to snapshot at open (view)', async () => {
    const { openModelEditor } = await import('../../src/features/config/modelEditor.js')
    __modeManager.set('view')
    openModelEditor({ onClose: vi.fn(), store: { getAllPairs: ()=>[] } })
    // Press Esc to close via openModal closeKeys
    const backdrop = document.querySelector('.overlay-backdrop.centered')
    backdrop.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    // Mode should be restored to 'view'
    expect(__modeManager.mode).toBe('view')
  })

  it('restores mode to snapshot at open (input)', async () => {
    const { openModelEditor } = await import('../../src/features/config/modelEditor.js')
    __modeManager.set('input')
    openModelEditor({ onClose: vi.fn(), store: { getAllPairs: ()=>[] } })
    const backdrop = document.querySelector('.overlay-backdrop.centered')
    backdrop.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(__modeManager.mode).toBe('input')
  })

  it('does not leak Esc to global router', async () => {
    // Simulate a global key router that would set command on Esc if not blocked
    const globalSpy = vi.fn()
    window.addEventListener('keydown', (e)=>{ if(e.key==='Escape') globalSpy() })
    const { openModelEditor } = await import('../../src/features/config/modelEditor.js')
    __modeManager.set('view')
    openModelEditor({ onClose: vi.fn(), store: { getAllPairs: ()=>[] } })
    const backdrop = document.querySelector('.overlay-backdrop.centered')
    backdrop.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(globalSpy).not.toHaveBeenCalled()
    expect(__modeManager.mode).toBe('view')
  })
})
