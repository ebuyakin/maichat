// Phase 5b: Update pair with error

import { AdapterError } from '../../infrastructure/provider/adapterV2.js'

/**
 * Format error for display
 * 
 * @param {Error} error - Error object
 * @returns {string} Formatted error message
 */
function formatErrorMessage(error) {
  if (error instanceof AdapterError) {
    // Show error code and message
    return `[${error.code}] ${error.message}`
  }
  
  // Generic error
  return error.message || String(error)
}

/**
 * Update pair with error state
 * 
 * @param {Object} params
 * @param {string} params.pairId - Pair ID to update
 * @param {Error} params.error - Error that occurred
 * @param {Object} params.store - Message store
 */
export function updatePairError({ pairId, error, store }) {
  store.updatePair(pairId, {
    assistantText: '',  // Empty on error
    lifecycleState: 'error',
    errorMessage: formatErrorMessage(error),
  })
}
