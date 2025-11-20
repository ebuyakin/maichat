// Runtime services registry
// Provides access to app-level singleton services without parameter drilling

// Module-level variables (private)
let _store = null
let _lifecycle = null
let _historyRuntime = null
let _activeParts = null
let _scrollController = null
let _interaction = null

/**
 * Initialize runtime services registry
 * Must be called once from main.js after all services are created
 * 
 * @param {Object} services
 * @param {Object} services.store - Message store
 * @param {Object} services.lifecycle - Lifecycle manager
 * @param {Object} services.historyRuntime - History runtime
 * @param {Object} services.activeParts - Active parts manager
 * @param {Object} services.scrollController - Scroll controller
 * @param {Object} services.interaction - Interaction controller
 */
export function initServices({ store, lifecycle, historyRuntime, activeParts, scrollController, interaction }) {
  _store = store
  _lifecycle = lifecycle
  _historyRuntime = historyRuntime
  _activeParts = activeParts
  _scrollController = scrollController
  _interaction = interaction
}

/**
 * Get message store
 * @returns {Object} Message store
 */
export function getStore() {
  if (!_store) throw new Error('Services not initialized. Call initServices() first.')
  return _store
}

/**
 * Get lifecycle manager
 * @returns {Object} Lifecycle manager
 */
export function getLifecycle() {
  if (!_lifecycle) throw new Error('Services not initialized. Call initServices() first.')
  return _lifecycle
}

/**
 * Get history runtime
 * @returns {Object} History runtime
 */
export function getHistoryRuntime() {
  if (!_historyRuntime) throw new Error('Services not initialized. Call initServices() first.')
  return _historyRuntime
}

/**
 * Get active parts manager
 * @returns {Object} Active parts manager
 */
export function getActiveParts() {
  if (!_activeParts) throw new Error('Services not initialized. Call initServices() first.')
  return _activeParts
}

/**
 * Get scroll controller
 * @returns {Object} Scroll controller
 */
export function getScrollController() {
  if (!_scrollController) throw new Error('Services not initialized. Call initServices() first.')
  return _scrollController
}

/**
 * Get interaction controller
 * @returns {Object} Interaction controller (with updateSendDisabled, etc.)
 */
export function getInteraction() {
  if (!_interaction) throw new Error('Services not initialized. Call initServices() first.')
  return _interaction
}
