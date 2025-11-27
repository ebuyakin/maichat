// Draft attachment state management
// Pure functions extracted from inputKeys.js for reuse

import { getMany } from './imageStore.js'

/**
 * Update draft image indicator badge in DOM
 * @param {string[]} attachments - Array of image IDs
 */
export function updateIndicator(attachments) {
  try {
    const ind = document.getElementById('attachIndicator')
    const cnt = document.getElementById('attachCount')
    const n = Array.isArray(attachments) ? attachments.length : 0
    if (!ind || !cnt) return
    
    // Visibility: 0 -> hidden; 1 -> icon only; 2+ -> icon + number
    if (n === 0) {
      cnt.textContent = ''
      ind.setAttribute('aria-label', 'No images attached')
      ind.style.display = 'none'
      ind.hidden = false
    } else {
      cnt.textContent = n > 1 ? String(n) : ''
      ind.setAttribute('aria-label', n === 1 ? '1 image attached' : `${n} images attached`)
      ind.style.display = 'inline-flex'
      ind.hidden = false
    }
  } catch {}
}

/**
 * Persist draft attachments to localStorage
 * @param {string[]} attachments - Array of image IDs
 * @param {string} draftText - Current draft text (persisted alongside attachments)
 */
export function persistAttachments(attachments, draftText) {
  try {
    const ids = Array.isArray(attachments) ? attachments : []
    localStorage.setItem('maichat_draft_attachments', JSON.stringify(ids))
    
    // Policy: when attachments exist, also persist current draft text for reload restore.
    // When attachments are cleared, remove the draft text key to avoid restoring stale text alone.
    if (ids.length > 0) {
      try {
        localStorage.setItem('maichat_draft_text', draftText || '')
      } catch {}
    } else {
      try {
        localStorage.removeItem('maichat_draft_text')
      } catch {}
    }
  } catch {}
}

/**
 * Validate and clean stale attachment references
 * @param {string[]} attachments - Array of image IDs to validate
 * @returns {Promise<string[]>} Cleaned array with only valid IDs
 */
export async function cleanStaleAttachments(attachments) {
  if (!Array.isArray(attachments)) return []
  
  const validIds = []
  for (const id of attachments) {
    try {
      const rec = await getMany([id])
      if (rec && rec[0]) {
        validIds.push(id)
      } else {
        console.warn('[attach] removed stale reference:', id)
      }
    } catch {
      console.warn('[attach] removed stale reference:', id)
    }
  }
  
  return validIds
}
