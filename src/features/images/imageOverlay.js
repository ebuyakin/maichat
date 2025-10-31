// features/images/imageOverlay.js
// Image attachments overlay viewer for both Input (draft) and View (history) modes
// - Opens a modal showing attachments from draft or saved message pair
// - Navigation: j/k, ArrowLeft/Right, digits 1-9 jump
// - Close: Esc
// - Remove current: Delete / Backspace / 'x' (Draft mode only, confirm if >1)
// - Lazy loads blobs from imageStore and uses object URLs (revoked on close)

import { openModal } from '../../shared/openModal.js'
import { get as getImage, detach as detachImage } from './imageStore.js'

/**
 * Open image overlay in draft or view mode
 * @param {Object} params
 * @param {Object} params.modeManager - Mode manager instance
 * @param {'draft'|'view'} [params.mode='draft'] - Overlay mode
 * @param {Object} [params.pendingMessageMeta] - For draft mode: pending message with attachments array
 * @param {Object} [params.pair] - For view mode: MessagePair with attachments array
 * @param {number} [params.startIndex=0] - Initial image index to display
 * @param {Function} [params.onChange] - Callback for draft mode changes (remove events)
 */
export function openImageOverlay({ 
  modeManager, 
  mode = 'draft',
  pendingMessageMeta,
  pair,
  startIndex = 0, 
  onChange 
}) {
  // Determine data source based on mode
  const isDraft = mode === 'draft'
  const dataSource = isDraft ? pendingMessageMeta : pair
  const ids = Array.isArray(dataSource?.attachments) ? dataSource.attachments : []
  
  if (!ids.length) return null

  let index = Math.min(Math.max(0, startIndex), ids.length - 1)
  const urlCache = new Map() // id -> objectURL

  // Root/backdrop
  const root = document.createElement('div')
  root.className = 'overlay-backdrop centered'
  root.id = isDraft ? 'draftImagesOverlay' : 'viewImagesOverlay'
  
  // Build header buttons (Remove button only in draft mode)
  const removeBtn = isDraft 
    ? `<button type="button" class="btn btn-danger" data-action="remove" title="Remove current (Delete/x)">Remove</button>`
    : ''
  
  // Build footer hint (remove actions only in draft mode)
  const hintText = isDraft
    ? 'j/k, ←/→ navigate • digits 1–9 jump • Delete/Backspace/x remove • Esc close'
    : 'j/k, ←/→ navigate • digits 1–9 jump • Esc close'
  
  root.innerHTML = `
    <div class="overlay-panel image-viewer-panel" style="width:min(92vw, 980px); height:min(80vh, 720px); display:flex; flex-direction:column;">
      <header class="image-viewer-header" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div class="left">
          <span class="title">Attachments</span>
          <span class="count" style="opacity:.75;margin-left:6px;"></span>
        </div>
        <div class="right" style="display:flex;gap:6px;align-items:center;">
          ${removeBtn}
          <button type="button" class="btn" data-action="close" title="Close (Esc)">Close</button>
        </div>
      </header>
      <div class="image-viewer-body" style="display:flex;align-items:center;justify-content:center;flex:1;overflow:auto;background:#070707;border:1px solid #222;border-radius:6px;">
        <div class="image-wrap" style="max-width:100%;max-height:100%;">
          <img class="image" alt="attachment" style="display:block;max-width:100%;max-height:100%;object-fit:contain;" />
        </div>
      </div>
      <footer class="image-viewer-footer" style="display:flex;justify-content:space-between;align-items:center;">
        <div class="hint" style="opacity:.7;font-size:12px;">${hintText}</div>
        <div class="meta dim" style="font-size:12px;opacity:.75;"></div>
      </footer>
    </div>
  `
  document.body.appendChild(root)
  const panel = root.querySelector('.image-viewer-panel')
  const imgEl = root.querySelector('img.image')
  const countEl = root.querySelector('.count')
  const metaEl = root.querySelector('.meta')
  try { panel.setAttribute('tabindex', '0') } catch {}

  function setCountLabel() {
    const n = (dataSource.attachments || []).length
    countEl.textContent = n ? `(${index + 1}/${n})` : '(0/0)'
  }

  async function showIndex(i) {
    const list = dataSource.attachments || []
    if (!list.length) return
    index = Math.min(Math.max(0, i), list.length - 1)
    const id = list[index]
    try {
      const rec = await getImage(id)
      if (!rec) throw new Error('not_found')
      // Create/reuse URL
      let url = urlCache.get(id)
      if (!url) {
        url = URL.createObjectURL(rec.blob)
        urlCache.set(id, url)
      }
      imgEl.src = url
      setCountLabel()
      metaEl.textContent = `${rec.format || rec.blob?.type || ''} • ${rec.w}×${rec.h} • ${(rec.bytes/1024).toFixed(1)} KB`
    } catch (e) {
      imgEl.removeAttribute('src')
      metaEl.textContent = 'Image not available'
    }
  }

  function revokeAll() {
    for (const url of urlCache.values()) {
      try { URL.revokeObjectURL(url) } catch {}
    }
    urlCache.clear()
  }

  function removeCurrent(withConfirm = true) {
    // Only allow removal in draft mode
    if (!isDraft) return
    
    const list = dataSource.attachments || []
    if (!list.length) return
    if (withConfirm && list.length > 1) {
      const ok = confirm('Remove this image from the draft?')
      if (!ok) return
    }
    const id = list[index]
    // Remove from draft array
    list.splice(index, 1)
    // Delete from store (direct delete now, no refCount)
    ;(async () => { try { await detachImage(id) } catch {} })()
    
    // Always notify about removal before closing (fix: was after empty check)
    if (typeof onChange === 'function') {
      try { onChange({ type: 'remove', id, index }) } catch {}
    }
    
    // Check if empty and close
    if (!list.length) {
      handleClose('empty')
      return
    }
    
    // Adjust index and view for remaining images
    if (index >= list.length) index = list.length - 1
    showIndex(index)
  }

  function handleClose(trigger) {
    try {
      revokeAll()
      modal && modal.close && modal.close(trigger)
    } catch {}
  }

  // Wire buttons
  root.querySelector('button[data-action="close"]').addEventListener('click', () => handleClose('button'))
  const removeButton = root.querySelector('button[data-action="remove"]')
  if (removeButton) {
    removeButton.addEventListener('click', () => removeCurrent(true))
  }

  // Click outside closes
  root.addEventListener('mousedown', (e) => { if (e.target === root) handleClose('backdrop') })

  // Open modal
  const modal = openModal({
    modeManager,
    root,
    closeKeys: ['Escape'],
    restoreMode: true,
    preferredFocus: () => panel,
    blockPolicy: { keys: true, pointer: true, wheel: true },
    beforeClose: () => {
      revokeAll()
    }
  })

  // Keyboard inside panel
  panel.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const list = dataSource.attachments || []
    if (!list.length) return
    if (e.key === 'j' || e.key === 'ArrowRight') {
      e.preventDefault()
      showIndex((index + 1) % list.length)
      return
    }
    if (e.key === 'k' || e.key === 'ArrowLeft') {
      e.preventDefault()
      showIndex((index - 1 + list.length) % list.length)
      return
    }
    if (/^[1-9]$/.test(e.key)) {
      const n = parseInt(e.key, 10) - 1
      if (n >= 0 && n < list.length) {
        e.preventDefault()
        showIndex(n)
      }
      return
    }
    // Delete/Backspace/x only work in draft mode
    if (isDraft && (e.key === 'Delete' || e.key === 'Backspace' || e.key === 'x' || e.key === 'X')) {
      e.preventDefault()
      removeCurrent(true)
      return
    }
  }, true)

  // Initial render
  setCountLabel()
  showIndex(index)

  return { close: () => handleClose('api'), jumpTo: (i) => showIndex(i) }
}

// Backwards compatibility: export draft-specific function with old name
export function openDraftImageOverlay(params) {
  return openImageOverlay({ ...params, mode: 'draft' })
}
