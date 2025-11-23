/**
 * Smart message alignment - unified function for aligning messages with fit detection
 * 
 * Aligns the currently active message based on whether it fits the viewport.
 * Optionally switches mode for long assistant responses.
 */

import { getActiveParts, getScrollController } from '../../runtime/runtimeServices.js'

/**
 * Smart align the currently active message
 * 
 * Measures if the active message fits in viewport, then aligns and switches mode accordingly.
 * 
 * Prerequisites: Message must already be active (renderCurrentView handles this)
 * 
 * @param {Object} [options={}] - Optional configuration
 * @param {'onfit'|'top'|'bottom'} [options.position='onfit'] - Alignment strategy
 *   - 'onfit': Bottom if fits, top if doesn't (smart)
 *   - 'top': Always align to top
 *   - 'bottom': Always align to bottom
 * @param {'onfit'|'view'|'input'|'command'} [options.mode='onfit'] - Mode switching strategy
 *   - 'onfit': Switch to VIEW if doesn't fit, stay in current if fits (smart)
 *   - 'view': Force VIEW mode
 *   - 'input': Force INPUT mode
 *   - 'command': Force COMMAND mode
 * @param {boolean} [options.animate=false] - Use smooth scrolling
 * @returns {boolean} Success status
 * 
 * @example
 * // Default: smart alignment with mode switching
 * smartAlignActiveMessage()
 * 
 * @example
 * // Force bottom, stay in current mode
 * smartAlignActiveMessage({ position: 'bottom', mode: 'input' })
 */
export function smartAlignActiveMessage(options = {}) {
  const {
    position = 'onfit',
    mode = 'onfit',
    animate = false,
  } = options

  // Defer to next frame to ensure DOM is fully rendered
  requestAnimationFrame(() => {
    try {
      // 1. Get currently active message
      const activeParts = getActiveParts()
      const active = activeParts.active()
      if (!active || !active.id) return
      
      // 2. Find active message DOM element
      const pane = document.getElementById('historyPane')
      if (!pane) return
      
      const message = pane.querySelector(
        `.message[data-part-id="${active.id}"]`
      )
      if (!message) return
      
      // 3. Measure if message fits in viewport
      let fits = true
      if (position === 'onfit' || mode === 'onfit') {
        const messageRect = message.getBoundingClientRect()
        const paneRect = pane.getBoundingClientRect()
        
        // Calculate total height including any content scrolled above viewport
        const messageHeight = messageRect.height
        const clippedTop = Math.max(0, paneRect.top - messageRect.top)
        const logicalHeight = messageHeight + clippedTop
        
        fits = logicalHeight <= paneRect.height - 2
      }
      
      // 4. Determine final scroll position
      let finalPosition
      if (position === 'onfit') {
        finalPosition = fits ? 'bottom' : 'top'
      } else {
        finalPosition = position  // 'top' or 'bottom'
      }
      
      // 5. Handle mode switching
      const modeMgr = window.__modeManager
      const MODES = window.__MODES
      const currentMode = modeMgr?.mode || modeMgr?.current
      
      let targetMode = null
      
      if (mode === 'onfit') {
        // Smart mode: switch to VIEW if doesn't fit, stay in current if fits
        if (!fits) {
          const input = document.getElementById('inputField')
          const inputEmpty = !input || input.value.trim().length === 0
          if (inputEmpty) {
            targetMode = 'VIEW'
          }
        }
        // If fits, targetMode stays null (don't switch)
      } else {
        // Force specific mode: 'view', 'input', or 'command'
        targetMode = mode.toUpperCase()  // Convert to uppercase for MODES enum
      }
      
      // Apply mode switch if needed
      if (targetMode && currentMode !== targetMode.toLowerCase() && modeMgr && MODES) {
        if (typeof modeMgr.set === 'function' && MODES[targetMode]) {
          modeMgr.set(MODES[targetMode])
        }
      }
      
      // 7. Scroll to final position
      const scrollController = getScrollController()
      
      if (finalPosition === 'bottom') {
        // Scroll to bottom of history
        if (scrollController && typeof scrollController.scrollToBottom === 'function') {
          scrollController.scrollToBottom(animate)
        }
      } else if (finalPosition === 'top') {
        // Align active message to top of viewport
        if (active.id && scrollController && typeof scrollController.alignTo === 'function') {
          scrollController.alignTo(active.id, 'top', animate)
        }
      }
      
    } catch (err) {
      // Alignment is non-critical, silently handle errors
      console.warn('[smartAlignActiveMessage] Error during alignment:', err)
    }
  })

  return true
}
