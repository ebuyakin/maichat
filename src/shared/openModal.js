// Moved from src/ui/openModal.js (Phase 4 shared primitives move)
import { createFocusTrap } from './focusTrap.js'

// Central modal blocker state (shared across all modals)
const modalStack = [] // stack of { root:Element, blockPolicy:{keys:boolean,pointer:boolean,wheel:boolean} }
const exemptRoots = new Set() // Elements allowed to receive events even when a modal is open
let blockersInstalled = false

const defaultBlockPolicy = { keys: true, pointer: true, wheel: true }

function isWithin(el, root) {
  try {
    return !!(root && el && root.contains(el))
  } catch {
    return false
  }
}
function isInAnyExempt(el) {
  for (const er of exemptRoots) {
    if (isWithin(el, er)) return true
  }
  return false
}
function topModal() {
  return modalStack.length ? modalStack[modalStack.length - 1] : null
}

function shouldBlockByType(e, policy) {
  const t = e.type
  if (t === 'keydown' || t === 'keyup') return !!policy.keys
  if (
    t === 'mousedown' ||
    t === 'mouseup' ||
    t === 'click' ||
    t === 'contextmenu' ||
    t === 'pointerdown' ||
    t === 'pointerup'
  )
    return !!policy.pointer
  if (t === 'wheel' || t === 'touchmove') return !!policy.wheel
  return false
}

function onCapturedEvent(e) {
  const top = topModal()
  if (!top) return
  // Let OS/system shortcuts through, don't interfere
  if (e.metaKey) return
  const target = e.target
  const withinTop = isWithin(target, top.root)
  const withinExempt = isInAnyExempt(target)
  const shouldBlock = shouldBlockByType(e, top.blockPolicy)
  // If event is inside the active modal root and not in an exempt area,
  // allow it to proceed normally. Do not replay.
  if (withinTop && !withinExempt) {
    return
  }
  // Outside-target events (or inside exempt roots): block fully per policy.
  if (shouldBlock && !withinTop && !withinExempt) {
    try {
      e.preventDefault()
    } catch {}
    try {
      e.stopPropagation()
      e.stopImmediatePropagation()
    } catch {}
  }
}

function installBlockers() {
  if (blockersInstalled) return
  blockersInstalled = true
  window.addEventListener('keydown', onCapturedEvent, true)
  window.addEventListener('keyup', onCapturedEvent, true)
  // Prevent modal-local key events from reaching window-level bubble listeners
  document.addEventListener('keydown', onBubbledKeyEvent, false)
  document.addEventListener('keyup', onBubbledKeyEvent, false)
  window.addEventListener('wheel', onCapturedEvent, true)
  window.addEventListener('touchmove', onCapturedEvent, true)
  window.addEventListener('mousedown', onCapturedEvent, true)
  window.addEventListener('mouseup', onCapturedEvent, true)
  window.addEventListener('click', onCapturedEvent, true)
  window.addEventListener('contextmenu', onCapturedEvent, true)
  window.addEventListener('pointerdown', onCapturedEvent, true)
  window.addEventListener('pointerup', onCapturedEvent, true)
}
function uninstallBlockersIfNone() {
  if (!blockersInstalled || modalStack.length) return
  blockersInstalled = false
  window.removeEventListener('keydown', onCapturedEvent, true)
  window.removeEventListener('keyup', onCapturedEvent, true)
  document.removeEventListener('keydown', onBubbledKeyEvent, false)
  document.removeEventListener('keyup', onBubbledKeyEvent, false)
  window.removeEventListener('wheel', onCapturedEvent, true)
  window.removeEventListener('touchmove', onCapturedEvent, true)
  window.removeEventListener('mousedown', onCapturedEvent, true)
  window.removeEventListener('mouseup', onCapturedEvent, true)
  window.removeEventListener('click', onCapturedEvent, true)
  window.removeEventListener('contextmenu', onCapturedEvent, true)
  window.removeEventListener('pointerdown', onCapturedEvent, true)
  window.removeEventListener('pointerup', onCapturedEvent, true)
}

function onBubbledKeyEvent(e) {
  const top = topModal()
  if (!top) return
  if (e.metaKey) return
  const target = e.target
  if (isWithin(target, top.root)) {
    try {
      e.stopPropagation()
      e.stopImmediatePropagation()
    } catch {}
  }
}

export function registerModalExemptRoot(root) {
  if (!root) return () => {}
  exemptRoots.add(root)
  return () => {
    try {
      exemptRoots.delete(root)
    } catch {}
  }
}

export function openModal({
  modeManager,
  root,
  preferredFocus,
  closeKeys = ['Escape'],
  restoreMode = true,
  onCloseKey,
  beforeClose,
  modal = true,
  blockPolicy,
}) {
  if (!root) throw new Error('openModal: root element required')
  const prevMode = modeManager.mode
  let closed = false
  const trap = createFocusTrap(root, () => (preferredFocus && preferredFocus()) || root)
  function swallow(e) {
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
  }
  function keyHandler(e) {
    if (closeKeys.includes(e.key)) {
      swallow(e)
      if (onCloseKey) onCloseKey(e.key)
      close(e.key)
    }
  }
  root.addEventListener('keydown', keyHandler, true)

  // Register in central blocker if modal
  const policy = Object.assign({}, defaultBlockPolicy, blockPolicy || {})
  const stackEntry = modal ? { root, blockPolicy: policy } : null
  if (stackEntry) {
    modalStack.push(stackEntry)
    installBlockers()
  }

  function close(trigger) {
    if (closed) return
    closed = true
    if (beforeClose) beforeClose(trigger, { prevMode })
    root.removeEventListener('keydown', keyHandler, true)
    trap.release()
    if (root.parentNode) root.parentNode.removeChild(root)
    if (stackEntry) {
      // Remove from stack (LIFO-safe, but guard in case of out-of-order closes)
      const idx = modalStack.lastIndexOf(stackEntry)
      if (idx >= 0) modalStack.splice(idx, 1)
      uninstallBlockersIfNone()
    }
    if (restoreMode) modeManager.set(prevMode)
  }
  return { close, prevMode }
}

// Expose a unified modal activity predicate backed by the central stack
try {
  if (typeof window !== 'undefined') {
    window.modalIsActive = function () {
      return modalStack.length > 0
    }
  }
} catch {}
