/* @vitest-environment jsdom */
import { describe, it, beforeEach, expect, vi } from 'vitest'

vi.mock('/src/core/models/modelCatalog.js', () => {
  let models = [
    { id: 'alpha', enabled: true, contextWindow: 8000, tpm: 200000, rpm: 3000, tpd: 1000000 },
  ]
  return {
    listModels: () => models.slice(),
    getActiveModel: () => 'alpha',
    setActiveModel: vi.fn(),
    updateModelMeta: vi.fn(),
    setModelEnabled: vi.fn(),
    addModel: vi.fn(),
    deleteModel: vi.fn(),
  }
})

describe('Model Editor Save/Cancel', () => {
  beforeEach(() => { document.body.innerHTML = ''; window.__modeManager = { mode: 'view', set: vi.fn() } })

  it('Save button applies without closing or calling onClose when no changes', async () => {
    const { openModelEditor } = await import('../../src/features/config/modelEditor.js')
    const onClose = vi.fn()
    openModelEditor({ onClose })
    const saveBtn = document.getElementById('me-save-btn')
    expect(saveBtn).toBeTruthy()
    saveBtn.click()
    // Should NOT close overlay nor invoke onClose (spec: Apply keeps editor open)
    expect(onClose).not.toHaveBeenCalled()
    // Buttons should reflect clean state after save
    expect(saveBtn.textContent.toLowerCase()).toContain('all saved')
  })

  it('Cancel button triggers onClose({dirty:false}) when no changes', async () => {
    const { openModelEditor } = await import('../../src/features/config/modelEditor.js')
    const onClose = vi.fn()
    openModelEditor({ onClose })
    const cancelBtn = document.getElementById('me-cancel-btn')
    expect(cancelBtn).toBeTruthy()
    cancelBtn.click()
    expect(onClose).toHaveBeenCalled()
    expect(onClose.mock.calls[0][0]).toMatchObject({ dirty: false })
  })
})
