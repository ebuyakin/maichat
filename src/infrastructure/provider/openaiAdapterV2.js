// OpenAI API adapter V2 (for new sendNewMessage architecture)
// Uses Responses API (/v1/responses) - the modern OpenAI endpoint
// Images already encoded in messages, no helpers needed

import { storeFetchResponse, storeFetchError, storeRequestPayload } from '../../instrumentation/apiDebug.js'
import { AdapterError } from './adapterV2.js'

const OPENAI_URL = 'https://api.openai.com/v1/responses'

/**
 * Build OpenAI Responses API request body from universal format
 */
function buildOpenAIRequestBody({ messages, system, options }) {
  const input = []
  
  // Convert messages to Responses API format
  for (const msg of messages) {
    const content = []
    
    // Add text
    if (msg.content) {
      content.push({
        type: msg.role === 'user' ? 'input_text' : 'output_text',
        text: msg.content
      })
    }
    
    // Add images (already base64 encoded) - only for user messages
    if (msg.role === 'user' && msg.images && msg.images.length > 0) {
      for (const img of msg.images) {
        content.push({
          type: 'input_image',
          image_url: `data:${img.mime};base64,${img.data}`
        })
      }
    }
    
    input.push({
      role: msg.role,
      content
    })
  }
  
  const body = { input }
  
  // Add system instructions (separate from messages)
  if (system) {
    body.instructions = system
  }
  
  // Add optional parameters
  if (typeof options.maxOutputTokens === 'number') {
    body.max_output_tokens = options.maxOutputTokens
  }
  
  // Add web search tool if requested
  if (options.webSearch === true) {
    body.tools = [{ type: 'web_search' }]
    body.tool_choice = 'auto'
  }
  
  // Note: Responses API doesn't support temperature parameter
  
  return body
}

/**
 * Send HTTP request to OpenAI API
 */
async function sendOpenAIRequest({ model, apiKey, body, signal }) {
  const url = OPENAI_URL
  
  // Add model to body
  body.model = model
  
  // Store request payload for debugging
  storeRequestPayload('openai', model, body)
  
  // Measure timing
  const tStart = Date.now()
  
  // Send request
  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal,
    })
  } catch (err) {
    storeFetchError(err, 'openai')
    throw new AdapterError('fetchNetwork', 'Network error', { cause: err })
  }
  
  const responseMs = Date.now() - tStart
  
  // Parse response body
  let responseBody
  try {
    responseBody = await response.json()
  } catch (err) {
    throw new AdapterError('parseError', 'Failed to parse JSON response', { cause: err })
  }
  
  // Store response (both success and HTTP errors)
  storeFetchResponse(response, 'openai', responseBody)
  
  return { response, responseBody, responseMs }
}

/**
 * Parse and extract data from OpenAI Responses API response
 */
async function parseOpenAIResponse({ response, responseBody }) {
  // Check for HTTP errors
  if (!response.ok) {
    const errorMsg = responseBody.error?.message || response.statusText
    const errorCode = responseBody.error?.code
    
    // Check for usage limit errors
    // OpenAI uses 429 for rate limits and specific error codes for context
    if (response.status === 429 || 
        errorCode === 'insufficient_quota' ||
        errorCode === 'context_length_exceeded') {
      throw new AdapterError('exceededUsageLimit', `${response.status}: ${errorMsg}`)
    }
    
    throw new AdapterError('httpError', `${response.status}: ${errorMsg}`)
  }
  
  // Extract content from Responses API output
  let content = ''
  try {
    if (Array.isArray(responseBody.output)) {
      for (const item of responseBody.output) {
        const blocks = Array.isArray(item?.content) ? item.content : []
        for (const block of blocks) {
          const text = block && (block.text || block.value || (typeof block === 'string' ? block : ''))
          if (typeof text === 'string') {
            content += text
          }
        }
      }
    } else if (responseBody.output_text && typeof responseBody.output_text === 'string') {
      // Fallback format
      content = responseBody.output_text
    }
  } catch (err) {
    throw new AdapterError('parseError', 'Failed to extract content from response', { cause: err })
  }
  
  if (!content) {
    throw new AdapterError('modelEmptyContent', 'Empty response content')
  }
  
  // Extract usage
  const tokenUsage = responseBody.usage ? {
    promptTokens: responseBody.usage.input_tokens || 0,
    completionTokens: responseBody.usage.output_tokens || 0,
    totalTokens: responseBody.usage.total_tokens || 0,
  } : undefined
  
  // Store raw provider token usage
  const rawTokenUsage = responseBody.usage
  
  // Extract citations (URLs) and optional titles from Responses API
  let citations
  let citationsMeta
  try {
    const urls = []
    const titleMap = {}
    
    const push = (u, t) => {
      if (typeof u === 'string' && /^https?:\/\//i.test(u)) {
        urls.push(u)
        if (typeof t === 'string' && t) {
          titleMap[u] = t
        }
      }
    }
    
    // Walk output blocks for citations/annotations
    if (Array.isArray(responseBody.output)) {
      for (const item of responseBody.output) {
        const blocks = Array.isArray(item?.content) ? item.content : []
        for (const b of blocks) {
          // b.citations (array of { url, title, ... })
          if (Array.isArray(b?.citations)) {
            for (const c of b.citations) {
              push(c?.url, c?.title)
            }
          }
          // b.annotations with web refs
          if (Array.isArray(b?.annotations)) {
            for (const a of b.annotations) {
              push(a?.url || a?.href, a?.title || a?.source)
            }
          }
          // Nested content (web_result, search_result)
          if (Array.isArray(b?.content)) {
            for (const it of b.content) {
              if (it && (it.type === 'web_result' || it.type === 'search_result')) {
                push(it.url, it.title)
              }
            }
          }
        }
      }
    }
    
    // Top-level references
    if (Array.isArray(responseBody.references)) {
      for (const r of responseBody.references) {
        push(r?.url, r?.title)
      }
    }
    
    // Deduplicate URLs
    if (urls.length) {
      const seen = new Set()
      const dedup = []
      for (const u of urls) {
        if (!seen.has(u)) {
          seen.add(u)
          dedup.push(u)
        }
      }
      citations = dedup
      if (Object.keys(titleMap).length) {
        citationsMeta = titleMap
      }
    }
  } catch {}
  
  return {
    content,
    tokenUsage,
    rawTokenUsage,
    citations,
    citationsMeta,
  }
}

/**
 * Create OpenAI adapter for new architecture
 * 
 * @returns {Object} Adapter with sendChat method
 * @returns {Function} adapter.sendChat - Send chat request
 */
export function createOpenAIAdapterV2() {
  return {
    /**
     * Send chat request to OpenAI
     * 
     * @param {Object} params
     * @param {string} params.model - Model ID
     * @param {Array} params.messages - Messages with encoded images
     * @param {string} params.system - System message
     * @param {string} params.apiKey - API key
     * @param {AbortSignal} params.signal - Abort signal
     * @param {Object} params.options - Options (temperature, maxOutputTokens)
     * @returns {Promise<Object>} Response object
     * @returns {string} response.content - Assistant response text
     * @returns {Object} response.tokenUsage - Token usage {promptTokens, completionTokens, totalTokens}
     * @returns {number} response.responseMs - Response time in milliseconds
     * @returns {string[]|undefined} response.citations - Citation URLs (if any)
     * @returns {Object|undefined} response.citationsMeta - Citation metadata {url: title}
     */
    async sendChat({ model, messages, system, apiKey, signal, options = {} }) {
      // Validate API key
      if (!apiKey) {
        throw new AdapterError('missingKey', 'API key not provided')
      }
      
      // 1. Build request
      const body = buildOpenAIRequestBody({ messages, system, options })
      
      // 2. Send HTTP request
      const { response, responseBody, responseMs } = await sendOpenAIRequest({ model, apiKey, body, signal })
      
      // 3. Parse and extract result
      const result = await parseOpenAIResponse({ response, responseBody })
      
      return { ...result, responseMs }
    }
  }
}
