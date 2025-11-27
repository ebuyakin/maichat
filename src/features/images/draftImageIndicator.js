// Draft image indicator click/keyboard handler
// Enables opening draft image overlay by clicking the attach indicator in input zone

import { openImageOverlay } from './imageOverlay.js'
import { 
  updateIndicator, 
  persistAttachments, 
  cleanStaleAttachments 
} from './draftAttachments.js'

/**
 * Bind click and keyboard handlers to draft image indicator
 * Opens image overlay when user clicks the indicator showing pending attachments
 * 
 * @param {Object} params
 * @param {HTMLElement} params.indicatorElement - The indicator element (#attachIndicator)
 * @param {Object} params.modeManager - Mode manager instance
 * @param {Object} params.pendingMessageMeta - Pending message metadata (contains attachments array)
 * @returns {Object} { openDraftOverlay } - Expose function for keyboard shortcut to reuse
 */
export function bindDraftImageClick({ 
  indicatorElement,
  modeManager,
  pendingMessageMeta
}) {
  if (!indicatorElement) return { openDraftOverlay: () => {} }
  
  async function openDraftOverlay() {
    const list = Array.isArray(pendingMessageMeta.attachments) ? pendingMessageMeta.attachments : []
    if (!list.length) return
    
    // Clean stale references before opening overlay
    const cleaned = await cleanStaleAttachments(pendingMessageMeta.attachments)
    pendingMessageMeta.attachments = cleaned
    updateIndicator(cleaned)
    
    if (!cleaned.length) return
    
    const overlay = openImageOverlay({
      modeManager,
      mode: 'draft',
      pendingMessageMeta,
      startIndex: 0,
      onChange: () => {
        updateIndicator(pendingMessageMeta.attachments)
        persistAttachments(pendingMessageMeta.attachments, '') // No draft text on click
      }
    })
    
    // Expose temporary jump helper while overlay is open
    try {
      window.__mcDraftOverlay = overlay
    } catch {}
  }
  
  // Click handler
  indicatorElement.addEventListener('click', (e) => {
    e.preventDefault()
    openDraftOverlay()
  })
  
  // Keyboard accessibility (Enter/Space)
  indicatorElement.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openDraftOverlay()
    }
  })
  
  // Return function for keyboard shortcut to reuse
  return { openDraftOverlay }
}

