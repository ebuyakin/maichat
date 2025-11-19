// UI updates after message send (success or error)

import { getHistoryRuntime, getLifecycle, getActiveParts, getScrollController } from '../../runtime/runtimeServices.js'

/**
 * Update UI after message send completes
 * 
 * @param {Object} params
 * @param {string} params.pairId - Pair ID that was created/updated
 * @param {boolean} params.isReask - Whether this was a re-ask
 */
export function updateUI({ pairId, isReask }) {
  const historyRuntime = getHistoryRuntime()
  const lifecycle = getLifecycle()
  const activeParts = getActiveParts()
  const scrollController = getScrollController()
  // Re-render history to show new/updated message
  historyRuntime.renderCurrentView({ preserveActive: false })
  
  // Activate the new/updated message
  if (isReask) {
    // Re-ask: keep current active (already correct)
    historyRuntime.applyActiveMessage()
  } else {
    // New message: find and activate last user part
    try {
      const pane = document.getElementById('historyPane')
      const userEls = pane?.querySelectorAll(
        `.message[data-pair-id="${pairId}"][data-role="user"], .part[data-pair-id="${pairId}"][data-role="user"]`
      )
      const lastUserEl = userEls && userEls.length ? userEls[userEls.length - 1] : null
      
      if (lastUserEl) {
        const lastUserId = lastUserEl.getAttribute('data-part-id')
        if (lastUserId) {
          activeParts.setActiveById(lastUserId)
        }
      } else {
        activeParts.last()
      }
    } catch {
      activeParts.last()
    }
    
    historyRuntime.applyActiveMessage()
  }
  
  // Scroll to show the result
  if (scrollController && scrollController.scrollToBottom) {
    requestAnimationFrame(() => {
      scrollController.scrollToBottom(false)
    })
  }
  
  // Clear "AI is thinking..." badge
  lifecycle.completeSend()
  
  // Note: updateSendDisabled called elsewhere (interaction module owns this)
}
