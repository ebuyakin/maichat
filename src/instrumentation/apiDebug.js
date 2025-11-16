/**
 * API debugging instrumentation
 * Captures and stores API requests, responses, errors, and pipeline data for debugging
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
    console.warn('[apiDebug] Failed to store response:', err)
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
    console.warn('[apiDebug] Failed to store error:', err)
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
    console.warn('[apiDebug] Failed to store request:', err)
  }
}

/**
 * Store pipeline pre-send debug data
 * @param {string} provider - Provider name
 * @param {string} model - Model name
 * @param {string} topicSystem - System instruction text
 * @param {Array} messages - Array of message objects with role, content, attachments
 * @param {number} systemTokens - Token count for system message
 * @param {number} userTokens - Token count for user message (includes image tokens)
 * @param {number} imageTokens - Token count for images only
 */
export function storePipelinePresend(
  provider, 
  model, 
  topicSystem, 
  messages, 
  systemTokens,
  userTokens,
  imageTokens
) {
  try {
    // Count images per message for telemetry
    let totalImages = 0
    const messagesWithImages = []
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i]
      const imageCount = Array.isArray(m.attachments) ? m.attachments.length : 0
      if (imageCount > 0) {
        totalImages += imageCount
        messagesWithImages.push({
          index: i,
          role: m.role,
          imageCount,
          imageIds: m.attachments
        })
      }
    }
    
    const debugData = {
      timestamp: Date.now(),
      timestampISO: new Date().toISOString(),
      provider,
      model,
      // Message counts
      totalMessages: messages ? messages.length : 0,
      totalImages,
      messagesWithImages,
      // Token counts
      systemTokens,
      userTokens,
      imageTokens,
      textTokens: userTokens - imageTokens,
      // Message details
      systemMessageLen: (topicSystem || '').length,
      messages: (messages || []).map((m) => ({
        role: m.role,
        contentPreview: typeof m.content === 'string' ? m.content.slice(0, 400) : String(m.content).slice(0, 200),
        contentLength: typeof m.content === 'string' ? m.content.length : undefined,
        imageCount: Array.isArray(m.attachments) ? m.attachments.length : 0,
      })),
    }
    
    // Store in both localStorage (persistent) and window (easy DevTools access)
    localStorage.setItem('maichat_dbg_pipeline_presend', JSON.stringify(debugData))
    window.__maichat_dbg_pipeline_presend = debugData
  } catch (err) {
    // Silently fail - don't break app if debug logging fails
    console.warn('[apiDebug] Failed to store pipeline presend:', err)
  }
}

/**
 * Store pipeline error debug data
 * @param {string} provider - Provider name
 * @param {string} model - Model name
 * @param {Error} error - ProviderError with message, kind, status, providerCode, timing
 */
export function storePipelineError(provider, model, error) {
  try {
    const debugData = {
      timestamp: Date.now(),
      timestampISO: new Date().toISOString(),
      provider,
      model,
      message: error?.message,
      kind: error?.kind,
      status: error?.status,
      providerCode: error?.providerCode,
      timing: error?.__timing,
    }
    
    // Store in both localStorage (persistent) and window (easy DevTools access)
    localStorage.setItem('maichat_dbg_pipeline_error', JSON.stringify(debugData))
    window.__maichat_dbg_pipeline_error = debugData
  } catch (err) {
    // Silently fail - don't break app if debug logging fails
    console.warn('[apiDebug] Failed to store pipeline error:', err)
  }
}
