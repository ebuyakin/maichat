// xAI Grok API adapter V2 (for new sendNewMessage architecture)
// Uses Chat Completions API (OpenAI-compatible format)
// Images already encoded in messages, no helpers needed

import { storeFetchResponse, storeFetchError, storeRequestPayload } from '../../instrumentation/apiDebug.js'
import { AdapterError } from './adapterV2.js'

const GROK_URL = 'https://api.x.ai/v1/chat/completions'

/**
 * Build Grok Chat Completions request body from universal format
 */
function buildGrokRequestBody({ messages, system, options }) {
  const msgArr = []
  
  // Add system message first if present
  if (system) {
    msgArr.push({ role: 'system', content: system })
  }
  
  // Convert messages to Grok format
  for (const msg of messages) {
    // If user message with images, use content array format
    if (msg.role === 'user' && msg.images && msg.images.length > 0) {
      const content = []
      
      // Add text part
      if (msg.content) {
        content.push({ type: 'text', text: msg.content })
      }
      
      // Add image parts
      for (const img of msg.images) {
        const url = `data:${img.mime};base64,${img.data}`
        content.push({
          type: 'image_url',
          image_url: { url }
        })
      }
      
      msgArr.push({ role: msg.role, content })
    } else {
      // Simple text message
      msgArr.push({ role: msg.role, content: msg.content || '' })
    }
  }
  
  const body = {
    messages: msgArr
  }
  
  // Add optional parameters
  if (typeof options.temperature === 'number') {
    body.temperature = options.temperature
  }
  
  if (typeof options.maxOutputTokens === 'number') {
    body.max_tokens = options.maxOutputTokens
  }
  
  // Web search via search_parameters (Grok-specific)
  if (options.webSearch === true) {
    body.search_parameters = {
      mode: 'auto',
      return_citations: true,
    }
  } else if (options.webSearch === false) {
    body.search_parameters = { mode: 'off' }
  }
  
  return body
}

/**
 * Send HTTP request to Grok API
 */
async function sendGrokRequest({ model, apiKey, body, signal }) {
  // Add model to body
  body.model = model
  
  // Store request payload for debugging
  storeRequestPayload('grok', model, body)
  
  // Measure timing
  const tStart = Date.now()
  
  // Send request
  let response
  try {
    response = await fetch(GROK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal,
    })
  } catch (err) {
    storeFetchError(err, 'grok')
    if (err.name === 'AbortError') {
      throw new AdapterError('requestAborted', { cause: err })
    }
    throw new AdapterError('fetchNetwork', { cause: err })
  }
  
  const responseMs = Date.now() - tStart
  
  // Parse response body
  let responseBody
  try {
    responseBody = await response.json()
  } catch (err) {
    throw new AdapterError('parseError', { cause: err })
  }
  
  // Store response (both success and HTTP errors)
  storeFetchResponse(response, 'grok', responseBody)
  
  return { response, responseBody, responseMs }
}

/**
 * Parse and extract data from Grok Chat Completions response
 */
function parseGrokResponse({ response, responseBody }) {
  // Check for HTTP errors
  if (!response.ok) {
    const errorMsg = responseBody.error?.message || response.statusText
    const errorCode = responseBody.error?.code
    
    // Check for usage limit errors
    if (response.status === 429 || 
        errorCode === 'rate_limit_error' ||
        errorCode === 'insufficient_quota' ||
        errorMsg.includes('rate limit') ||
        errorMsg.includes('quota')) {
      throw new AdapterError('exceededUsageLimit', `${response.status}: ${errorMsg}`)
    }
    
    throw new AdapterError('httpError', `${response.status}: ${errorMsg}`)
  }
  
  // Extract content from Chat Completions response
  const content = responseBody.choices?.[0]?.message?.content || ''
  
  // Extract citations if available (Grok search results)
  // Citations can appear in multiple locations
  let citations
  
  try {
    // Check top-level citations array
    if (Array.isArray(responseBody.citations) && responseBody.citations.length > 0) {
      citations = responseBody.citations
    } else {
      // Check in message metadata
      const choice0 = responseBody.choices?.[0]
      const msg = choice0?.message || {}
      
      if (Array.isArray(msg.citations) && msg.citations.length > 0) {
        citations = msg.citations
      } else if (msg.metadata && Array.isArray(msg.metadata.citations) && msg.metadata.citations.length > 0) {
        citations = msg.metadata.citations
      }
    }
  } catch (err) {
    // Citations extraction is non-critical
    console.warn('[grok] Failed to extract citations:', err)
  }
  
  // Extract token usage (Grok provides OpenAI-compatible usage)
  const rawTokenUsage = responseBody.usage || undefined
  
  return {
    content,
    rawTokenUsage,
    citations,
  }
}

/**
 * Create Grok adapter V2
 * Main entry point - orchestrates request building, sending, and parsing
 */
export function createGrokAdapterV2() {
  return {
    /**
     * Send chat request to Grok API
     * 
     * @param {Object} params
     * @param {string} params.model - Model ID
     * @param {Array} params.messages - Universal message format with images
     * @param {string} params.system - System message
     * @param {string} params.apiKey - Grok API key
     * @param {AbortSignal} params.signal - Abort signal
     * @param {Object} params.options - Request options (temperature, maxOutputTokens, webSearch)
     * @returns {Promise<Object>} { content, rawTokenUsage, responseMs, citations }
     */
    async sendChat({ model, messages, system, apiKey, signal, options = {} }) {
      if (!apiKey) {
        throw new AdapterError('auth', 'Missing Grok API key')
      }
      
      // Build request body
      const body = buildGrokRequestBody({
        messages,
        system,
        options,
      })
      
      // Send request
      const { response, responseBody, responseMs } = await sendGrokRequest({
        model,
        apiKey,
        body,
        signal,
      })
      
      // Parse response
      const { content, rawTokenUsage, citations } = parseGrokResponse({
        response,
        responseBody,
      })
      
      return {
        content,
        rawTokenUsage,
        responseMs,
        citations,
      }
    }
  }
}
