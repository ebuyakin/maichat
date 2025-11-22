// Anthropic (Claude) API adapter V2 (for new sendNewMessage architecture)
// Uses Anthropic Messages API via proxy
// Images already encoded in messages, no helpers needed

import { storeFetchResponse, storeFetchError, storeRequestPayload } from '../../instrumentation/apiDebug.js'
import { AdapterError } from './adapterV2.js'

const ANTHROPIC_PROXY_URL = 'https://anthropic-proxy-phi.vercel.app/api/anthropic'
const ANTHROPIC_VERSION = '2023-06-01'

/**
 * Enforce Anthropic role alternation requirement
 * Inserts placeholder messages between consecutive same-role messages
 */
function enforceRoleAlternation(messages) {
  const normalized = []
  let insertedPlaceholders = 0
  
  for (const msg of messages) {
    const prev = normalized[normalized.length - 1]
    
    // Check if we have consecutive same-role messages
    if (prev && prev.role === msg.role) {
      if (msg.role === 'user') {
        // Insert placeholder assistant message
        normalized.push({ role: 'assistant', content: 'failed to respond' })
        insertedPlaceholders++
      } else {
        // Insert placeholder user message (rare)
        normalized.push({ role: 'user', content: 'failed to respond' })
        insertedPlaceholders++
      }
    }
    
    normalized.push(msg)
  }
  
  return { normalized, insertedPlaceholders }
}

/**
 * Build Anthropic Messages API request body from universal format
 */
function buildAnthropicRequestBody({ messages, system, options }) {
  // Enforce role alternation
  const { normalized, insertedPlaceholders } = enforceRoleAlternation(messages)
  
  // Convert messages to Anthropic format with images embedded in user messages
  const msgPayload = []
  
  for (const msg of normalized) {
    const content = []
    
    // Add text content (always add text even if empty string, to avoid empty content arrays)
    const textContent = msg.content || ''
    if (textContent) {
      content.push({ type: 'text', text: textContent })
    }
    
    // Add images (already base64 encoded) - only for user messages
    if (msg.role === 'user' && msg.images && msg.images.length > 0) {
      for (const img of msg.images) {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: img.mime,
            data: img.data
          }
        })
      }
    }
    
    // Ensure content is not empty (Anthropic requirement)
    // If no text and no images, add placeholder text
    if (content.length === 0) {
      content.push({ type: 'text', text: '...' })
    }
    
    msgPayload.push({
      role: msg.role,
      content
    })
  }
  
  const body = { messages: msgPayload }
  
  // Add system message if present
  if (system) {
    body.system = system
  }
  
  // Add temperature if specified
  if (typeof options.temperature === 'number') {
    body.temperature = options.temperature
  }
  
  // Add web search tool if requested
  if (options.webSearch === true) {
    body.tools = [{
      type: 'web_search_20250305',
      name: 'web_search',
    }]
  }
  
  // max_tokens is required by Anthropic - use maxOutputTokens or default
  const maxTokens = options.maxOutputTokens || 4096
  body.max_tokens = maxTokens
  
  return { body, insertedPlaceholders }
}

/**
 * Send HTTP request to Anthropic API via proxy
 */
async function sendAnthropicRequest({ model, apiKey, body, signal }) {
  // Add model to body
  body.model = model
  
  // Store request payload for debugging
  storeRequestPayload('anthropic', model, body)
  
  // Measure timing
  const tStart = Date.now()
  
  // Send request to proxy
  let response
  try {
    response = await fetch(ANTHROPIC_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
      signal,
    })
  } catch (err) {
    storeFetchError(err, 'anthropic')
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
  storeFetchResponse(response, 'anthropic', responseBody)
  
  return { response, responseBody, responseMs }
}

/**
 * Parse and extract data from Anthropic Messages API response
 */
function parseAnthropicResponse({ response, responseBody }) {
  // Check for HTTP errors
  if (!response.ok) {
    const errorMsg = responseBody.error?.message || response.statusText
    const errorType = responseBody.error?.type
    
    // Check for usage limit errors
    // Anthropic uses specific error types for overloaded/rate-limited scenarios
    if (response.status === 429 || 
        errorType === 'overloaded_error' ||
        errorType === 'rate_limit_error' ||
        errorMsg.includes('context') ||
        errorMsg.includes('too large')) {
      throw new AdapterError('exceededUsageLimit', `${response.status}: ${errorMsg}`)
    }
    
    throw new AdapterError('httpError', `${response.status}: ${errorMsg}`)
  }
  
  // Extract content from response (content is array of blocks)
  let content = ''
  try {
    const blocks = responseBody.content || []
    content = blocks
      .filter(b => b && b.type === 'text')
      .map(b => b.text)
      .join('')
  } catch (err) {
    throw new AdapterError('parseError', 'Failed to extract content from response', { cause: err })
  }
  
  // Extract citations from Claude web search results
  // Sources can appear in:
  // - text blocks with citations array
  // - web_search_tool_result blocks
  let citations
  let citationsMeta
  
  try {
    const blocks = Array.isArray(responseBody.content) ? responseBody.content : []
    const urls = []
    const titleMap = {}
    
    const pushUrl = (url, title) => {
      if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
        urls.push(url)
        if (typeof title === 'string' && title) {
          titleMap[url] = title
        }
      }
    }
    
    for (const block of blocks) {
      if (!block || typeof block !== 'object') continue
      
      // Extract from text block citations
      if (block.type === 'text' && Array.isArray(block.citations)) {
        for (const citation of block.citations) {
          if (citation && typeof citation.url === 'string') {
            pushUrl(citation.url, citation.title)
          }
        }
      }
      
      // Extract from web_search_tool_result blocks
      if (block.type === 'web_search_tool_result') {
        const content = block.content
        const results = Array.isArray(content) ? content : [content]
        
        for (const result of results) {
          if (result && result.type === 'web_search_result' && typeof result.url === 'string') {
            pushUrl(result.url, result.title)
          }
        }
      }
    }
    
    if (urls.length > 0) {
      // Deduplicate while preserving order
      const seen = new Set()
      const dedup = []
      for (const url of urls) {
        if (!seen.has(url)) {
          seen.add(url)
          dedup.push(url)
        }
      }
      citations = dedup
      
      if (Object.keys(titleMap).length > 0) {
        citationsMeta = titleMap
      }
    }
  } catch (err) {
    // Citations extraction is non-critical, continue without them
    console.warn('[anthropic] Failed to extract citations:', err)
  }
  
  // Extract token usage (Anthropic provides detailed usage)
  const rawTokenUsage = responseBody.usage || undefined
  
  return {
    content,
    rawTokenUsage,
    citations,
    citationsMeta,
  }
}

/**
 * Create Anthropic adapter V2
 * Main entry point - orchestrates request building, sending, and parsing
 */
export function createAnthropicAdapterV2() {
  return {
    /**
     * Send chat request to Anthropic API
     * 
     * @param {Object} params
     * @param {string} params.model - Model ID
     * @param {Array} params.messages - Universal message format with images
     * @param {string} params.system - System message
     * @param {string} params.apiKey - Anthropic API key
     * @param {AbortSignal} params.signal - Abort signal
     * @param {Object} params.options - Request options (temperature, maxOutputTokens, webSearch)
     * @returns {Promise<Object>} { content, rawTokenUsage, responseMs, citations, citationsMeta }
     */
    async sendChat({ model, messages, system, apiKey, signal, options = {} }) {
      if (!apiKey) {
        throw new AdapterError('auth', 'Missing Anthropic API key')
      }
      
      // Build request body
      const { body, insertedPlaceholders } = buildAnthropicRequestBody({
        messages,
        system,
        options,
      })
      
      // Send request
      const { response, responseBody, responseMs } = await sendAnthropicRequest({
        model,
        apiKey,
        body,
        signal,
      })
      
      // Parse response
      const { content, rawTokenUsage, citations, citationsMeta } = parseAnthropicResponse({
        response,
        responseBody,
      })
      
      return {
        content,
        rawTokenUsage,
        responseMs,
        citations,
        citationsMeta,
      }
    }
  }
}
