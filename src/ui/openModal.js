// openModal.js - unified modal lifecycle (prevMode capture, key swallowing, focus trap, restoration)
// Usage: openModal({ modeManager, root, preferredFocus, closeKeys:['Escape','Enter'], restoreMode:true })
// Returns { close, prevMode }
import { createFocusTrap } from './focusTrap.js'

export function openModal({ modeManager, root, preferredFocus, closeKeys=['Escape'], restoreMode=true, onCloseKey, beforeClose }){
  if(!root) throw new Error('openModal: root element required')
  const prevMode = modeManager.mode
  let closed = false
  const trap = createFocusTrap(root, ()=> (preferredFocus && preferredFocus()) || root)
  function swallow(e){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation() }
  function keyHandler(e){
    if(closeKeys.includes(e.key)){
      swallow(e)
      if(onCloseKey) onCloseKey(e.key)
      close(e.key)
    }
  }
  root.addEventListener('keydown', keyHandler, true)
  function close(trigger){
    if(closed) return
    closed = true
    if(beforeClose) beforeClose(trigger, { prevMode })
    root.removeEventListener('keydown', keyHandler, true)
    trap.release()
    if(root.parentNode) root.parentNode.removeChild(root)
    if(restoreMode) modeManager.set(prevMode)
  }
  return { close, prevMode }
}
