/**
 * Experimental module to test render + scroll coordination
 * 
 * Purpose: Render all messages and scroll to bottom, ensuring proper timing
 * Usage: Call from console: window.__refreshAndScrollToBottom()
 */

import { getSettings } from '../../core/settings/index.js'
import { getActiveModel } from '../../core/models/modelCatalog.js'

/**
 * Refreshes message history and scrolls to bottom
 * Inlines renderHistory logic to see exact mechanics and timing
 * 
 * @param {Object} options
 * @param {Object} options.store - Message store
 * @param {Object} options.historyRuntime - History runtime (for helper functions)
 * @param {Object} options.scrollController - Scroll controller
 * @param {Object} options.activeParts - Active parts manager
 * @param {Object} options.boundaryMgr - Boundary manager
 * @param {Object} options.historyView - History view (for DOM rendering)
 * @param {Object} options.lifecycle - Lifecycle manager
 * @param {Object} options.pendingMessageMeta - Pending message metadata
 * @returns {Promise<void>} Resolves when scroll completes
 */
export async function refreshAndScrollToBottom({
  store,
  historyRuntime,
  scrollController,
  activeParts,
  boundaryMgr,
  historyView,
  lifecycle,
  pendingMessageMeta,
}) {
  console.log('[refreshAndScroll] ===== STARTING =====')
  
  // STEP 1: Get all pairs
  let pairs = store
    .getAllPairs()
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt)
  
  console.log(`[refreshAndScroll] Step 1: Found ${pairs.length} pairs`)
  
  // STEP 2: Get settings
  const settings = getSettings()
  const cpt = settings.charsPerToken || 3.5
  const activeModel = pendingMessageMeta.model || getActiveModel() || 'gpt'
  console.log(`[refreshAndScroll] Step 2: Settings loaded (cpt=${cpt}, model=${activeModel})`)
  
  // STEP 3: Update boundary manager (context calculations)
  boundaryMgr.applySettings({
    userRequestAllowance: settings.userRequestAllowance || 0,
    charsPerToken: cpt,
  })
  boundaryMgr.setModel(activeModel)
  boundaryMgr.updateVisiblePairs(pairs)
  const boundary = boundaryMgr.getBoundary()
  console.log(`[refreshAndScroll] Step 3: Boundary calculated (${boundary.included.length} in context)`)
  
  // STEP 4: Build messages and parts
  const messages = historyRuntime.buildMessages(pairs) // k
  const parts = historyRuntime.flattenMessagesToParts(messages)
  activeParts.setParts(parts)
  console.log(`[refreshAndScroll] Step 4: Built ${messages.length} messages, ${parts.length} parts`)
  
  // STEP 5: Render to DOM (SYNCHRONOUS - updates innerHTML)
  historyView.renderMessages(messages)
  console.log('[refreshAndScroll] Step 5: DOM updated (renderMessages called)')
  
  // STEP 6: Apply styling (off-context, message count)
  historyRuntime.applyOutOfContextStyling()
  historyRuntime.updateMessageCount(boundary.included.length, pairs.length)
  console.log('[refreshAndScroll] Step 6: Styling applied')
  
  // STEP 7: Wait for browser to paint the DOM
  console.log('[refreshAndScroll] Step 7: Waiting for Frame 1 (DOM paint)...')
  await waitForNextFrame()
  console.log('[refreshAndScroll] Frame 1 complete - DOM should be visible')
  
  // STEP 8: Remeasure scroll geometry (CRITICAL - measures actual DOM heights)
  scrollController.remeasure()
  console.log('[refreshAndScroll] Step 8: Remeasure complete')
  
  // STEP 9: Apply active message styling
  historyRuntime.applyActiveMessage()
  console.log('[refreshAndScroll] Step 9: Active message styling applied')
  
  // STEP 10: Wait one more frame to ensure remeasure metrics are ready
  console.log('[refreshAndScroll] Step 10: Waiting for Frame 2 (metrics ready)...')
  await waitForNextFrame()
  console.log('[refreshAndScroll] Frame 2 complete - metrics should be accurate')
  
  // STEP 11: Scroll to bottom
  scrollController.scrollToBottom(false)
  console.log('[refreshAndScroll] Step 11: scrollToBottom() called')
  
  // STEP 12: Wait for scroll to apply
  await waitForNextFrame()
  console.log('[refreshAndScroll] ===== COMPLETE =====')
  
  // STEP 13: Update lifecycle badge
  lifecycle.updateNewReplyBadgeVisibility()
  console.log('[refreshAndScroll] Step 13: Badge visibility updated')
}

/**
 * Helper: Wait for next animation frame
 * @returns {Promise<void>}
 */
function waitForNextFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve()
    })
  })
}

/**
 * Setup function to expose to window for console testing
 * Call this during app initialization
 * 
 * @param {Object} dependencies
 */
export function setupConsoleTest(dependencies) {
  window.__refreshAndScrollToBottom = async () => {
    try {
      await refreshAndScrollToBottom(dependencies)
      console.log('✅ Success!')
    } catch (error) {
      console.error('❌ Error:', error)
    }
  }
  
  console.log('💡 Test function available: window.__refreshAndScrollToBottom()')
}
