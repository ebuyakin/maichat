/**
 * Fetch debugging instrumentation
 * Captures and stores fetch responses and errors for debugging provider API calls
 */

/**
 * Store fetch response debug data (success or HTTP error)
 * @param {Response} resp - Fetch Response object
 * @param {string} provider - Provider name ('gemini', 'openai', 'anthropic', etc.)
 * @param {Object} parsedBody - Already parsed response body
 */
export function storeFetchResponse(resp, provider, parsedBody) {
  try {
    const debugData = {
      timestamp: Date.now(),
      timestampISO: new Date().toISOString(),
      provider,
      // Response metadata
      url: resp.url,
      status: resp.status,
      statusText: resp.statusText,
      ok: resp.ok,
      type: resp.type,
      redirected: resp.redirected,
      headers: Object.fromEntries(resp.headers.entries()),
      // Parsed body
      body: parsedBody,
      // Error classification
      isError: !resp.ok,
      errorKind: !resp.ok ? 'http_error' : null,
    }
    
    // Store in both localStorage (persistent) and window (easy DevTools access)
    localStorage.setItem('maichat_dbg_fetch_response', JSON.stringify(debugData))
    window.__maichat_dbg_fetch_response = debugData
  } catch (err) {
    // Silently fail - don't break app if debug logging fails
    console.warn('[fetchDebug] Failed to store response:', err)
  }
}

/**
 * Store fetch exception debug data (network failure)
 * @param {Error} error - Exception thrown by fetch
 * @param {string} provider - Provider name
 */
export function storeFetchError(error, provider) {
  try {
    const debugData = {
      timestamp: Date.now(),
      timestampISO: new Date().toISOString(),
      provider,
      errorKind: 'failed-to-fetch',
      errorName: error?.name,
      errorMessage: error?.message,
      errorStack: error?.stack,
      // Network diagnostics
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : null,
      connectionType: typeof navigator !== 'undefined' && navigator.connection 
        ? navigator.connection.effectiveType 
        : 'unknown',
    }
    
    // Store in both localStorage (persistent) and window (easy DevTools access)
    localStorage.setItem('maichat_dbg_fetch_response', JSON.stringify(debugData))
    window.__maichat_dbg_fetch_response = debugData
  } catch (err) {
    // Silently fail - don't break app if debug logging fails
    console.warn('[fetchDebug] Failed to store error:', err)
  }
}

/**
 * Store request payload debug data
 * @param {string} provider - Provider name
 * @param {string} model - Model name
 * @param {Object} payload - Request payload object
 */
export function storeRequestPayload(provider, model, payload) {
  try {
    const debugData = {
      timestamp: Date.now(),
      timestampISO: new Date().toISOString(),
      provider,
      model,
      payload,
    }
    
    // Store in both localStorage (persistent) and window (easy DevTools access)
    localStorage.setItem('maichat_dbg_fetch_request', JSON.stringify(debugData))
    window.__maichat_dbg_fetch_request = debugData
  } catch (err) {
    // Silently fail - don't break app if debug logging fails
    console.warn('[fetchDebug] Failed to store request:', err)
  }
}
