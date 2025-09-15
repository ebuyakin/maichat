/* @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// We import openModal directly to exercise the central blocker.
import { openModal, registerModalExemptRoot } from '../../src/shared/openModal.js'

describe('central modal blocker', () => {
  let bgCount
  let bgWheel
  let incRef, incWheelRef
  beforeEach(() => {
    bgCount = 0
    bgWheel = 0
    const inc = () => { bgCount++ }
    const incWheel = () => { bgWheel++ }
    // Simulate global routers: bubble-phase listeners on window
    incRef = inc
    incWheelRef = incWheel
    window.addEventListener('keydown', incRef, false)
    window.addEventListener('wheel', incWheelRef, false)
  })
  afterEach(()=>{
    try{ window.removeEventListener('keydown', incRef, false) }catch{}
    try{ window.removeEventListener('wheel', incWheelRef, false) }catch{}
  })

  function dispatchKey(target, key){
    const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    target.dispatchEvent(e)
  }
  function dispatchWheel(target){
    const e = new Event('wheel', { bubbles: true, cancelable: true })
    target.dispatchEvent(e)
  }

  it('blocks background handlers while modal is open, but allows inside modal', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const modal = openModal({ modeManager: window.__modeManager || { mode:'view', set(){} }, root })
  // inside modal: should not increment window bubble listener
  dispatchKey(root, 'j')
  expect(bgCount).toBe(0)
    // background
    dispatchKey(document.body, 'j')
    expect(bgCount).toBe(0)
    // wheel also blocked
    dispatchWheel(document.body)
    expect(bgWheel).toBe(0)
    modal.close('test')
    // after close, background receives
    dispatchKey(document.body, 'j')
    expect(bgCount).toBe(1)
  })

  it('does not block events when non-modal overlay is exempted', () => {
  const debug = document.createElement('div')
    document.body.appendChild(debug)
    const off = registerModalExemptRoot(debug)
    // With no modal, background fires as usual
  dispatchKey(document.body, 'x')
  expect(bgCount).toBeGreaterThan(0)
    const prev = bgCount
    // While a modal is open, events inside debug should not be blocked, but background should
    const modalRoot = document.createElement('div')
    document.body.appendChild(modalRoot)
    const modal = openModal({ modeManager: window.__modeManager || { mode:'view', set(){} }, root: modalRoot })
    dispatchKey(debug, 'a')
    expect(bgCount).toBe(prev + 1)
    dispatchKey(document.body, 'a')
    expect(bgCount).toBe(prev + 1) // still blocked for background
    modal.close('test')
    off && off()
  })
})
