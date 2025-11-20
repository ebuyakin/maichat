// Gemini API adapter V2 (for new sendNewMessage architecture)
// Clean, focused: translates universal format → Gemini format, sends HTTP
// Images already encoded in messages, no helpers needed

import { storeFetchResponse, storeFetchError, storeRequestPayload } from '../../instrumentation/apiDebug.js'
import { AdapterError } from './adapterV2.js'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

/**
 * Build Gemini API request body from universal format
 */
function buildGeminiRequestBody({ messages, system, options }) {
  const contents = []
  
  for (const msg of messages) {
    const parts = []
    
    // Add text
    if (msg.content) {
      parts.push({ text: msg.content })
    }
    
    // Add images (already base64 encoded)
    if (msg.images && msg.images.length > 0) {
      for (const img of msg.images) {
        parts.push({
          inline_data: {
            mime_type: img.mime,
            data: img.data,
          }
        })
      }
    }
    
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts,
    })
  }
  
  const body = { contents }
  
  // Add system instruction
  if (system) {
    body.systemInstruction = {
      parts: [{ text: system }]
    }
  }
  
  // Add generation config
  const generationConfig = {}
  if (typeof options.temperature === 'number') {
    generationConfig.temperature = options.temperature
  }
  if (typeof options.maxOutputTokens === 'number') {
    generationConfig.maxOutputTokens = options.maxOutputTokens
  }
  if (Object.keys(generationConfig).length > 0) {
    body.generationConfig = generationConfig
  }
  
  // Add tools (web search)
  if (options.webSearch === true) {
    body.tools = [{
      googleSearch: {}
    }]
  }
  
  return body
}

/**
 * Send HTTP request to Gemini API
 */
async function sendGeminiRequest({ model, apiKey, body, signal }) {
  const url = `${GEMINI_URL}/${model}:generateContent?key=${apiKey}`
  
  // Store request payload for debugging
  storeRequestPayload('gemini', model, body)
  
  // Measure timing
  const tStart = Date.now()
  
  // Send request
  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (err) {
    storeFetchError(err, 'gemini')
    throw new AdapterError('fecthError', { cause: err })
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
  storeFetchResponse(response, 'gemini', responseBody)
  
  return { response, responseBody, responseMs }
}

/**
 * Parse and extract data from Gemini response
 */
async function parseGeminiResponse({ response, responseBody }) {
  // Check for HTTP errors
  if (!response.ok) {
    const errorMsg = responseBody.error?.message || response.statusText
    const errorStatus = responseBody.error?.status // Gemini includes status field
    
    // 429 or RESOURCE_EXHAUSTED = rate limit/quota
    // 500 with "context too long" = context overflow
    if (response.status === 429 || errorStatus === 'RESOURCE_EXHAUSTED' ||
        (response.status === 500 && /context|too long|too large/i.test(errorMsg))) {
      throw new AdapterError('exceededUsageLimit', `${response.status}: ${errorMsg}`)
    }
    throw new AdapterError('httpError', `${response.status}: ${errorMsg}`)
  }
  
  // Extract candidate
  const candidate = responseBody.candidates?.[0]
  if (!candidate) {
    const reason = responseBody.promptFeedback?.blockReason || 'No candidates'
    throw new AdapterError('responseNoCandidateError', `No candidates: ${reason}`)
  }
  
  // Extract content
  const content = candidate.content?.parts
    ?.map(p => p.text)
    ?.filter(Boolean)
    ?.join('') || ''
  
  if (!content) {
    throw new AdapterError('emptyResponse', 'Empty response content')
  }
  
  // Extract usage
  const tokenUsage = responseBody.usageMetadata ? {
    promptTokens: responseBody.usageMetadata.promptTokenCount || 0,
    completionTokens: responseBody.usageMetadata.candidatesTokenCount || 0,
    totalTokens: responseBody.usageMetadata.totalTokenCount || 0,
  } : undefined
  
  // Extract citations from grounding/citation metadata
  let citations
  let citationsMeta
  try {
    const urls = []
    const titleMap = {}
    
    const pushUri = (u, title) => {
      if (typeof u === 'string' && /^https?:\/\//i.test(u)) {
        urls.push(u)
        if (typeof title === 'string' && title) {
          titleMap[u] = title
        }
      }
    }
    
    // Grounding metadata (support both camelCase and snake_case)
    const gm = candidate.groundingMetadata || candidate.grounding_metadata
    const chunks = gm && (gm.groundingChunks || gm.grounding_chunks)
    if (Array.isArray(chunks)) {
      for (const ch of chunks) {
        if (ch && ch.web && ch.web.uri) {
          pushUri(ch.web.uri, ch.web.title)
        } else if (ch && ch.webChunk && ch.webChunk.uri) {
          pushUri(ch.webChunk.uri, ch.webChunk.title)
        } else if (ch && ch.web_chunk && ch.web_chunk.uri) {
          pushUri(ch.web_chunk.uri, ch.web_chunk.title)
        }
      }
    }
    
    // Fallback: citation metadata
    const cm = candidate.citationMetadata || candidate.citation_metadata
    const csrc = cm && (cm.citationSources || cm.citation_sources)
    if (Array.isArray(csrc)) {
      for (const src of csrc) {
        pushUri(src && (src.uri || src.url))
      }
    }
    
    // Fallback: content-level citations
    const candidateContent = candidate.content
    if (candidateContent && Array.isArray(candidateContent.citations)) {
      for (const cite of candidateContent.citations) {
        pushUri(cite && (cite.uri || cite.url))
      }
    }
    
    if (urls.length) {
      citations = urls
      if (Object.keys(titleMap).length) {
        citationsMeta = titleMap
      }
    }
  } catch {}
  
  return {
    content,
    tokenUsage,
    citations,
    citationsMeta,
  }
}

/**
 * Create Gemini adapter for new architecture
 * 
 * @returns {Object} Adapter with sendChat method
 * @returns {Function} adapter.sendChat - Send chat request
 */
export function createGeminiAdapterV2() {
  return {
    /**
     * Send chat request to Gemini
     * 
     * @param {Object} params
     * @param {string} params.model - Model ID
     * @param {Array} params.messages - Messages with encoded images
     * @param {string} params.system - System message
     * @param {string} params.apiKey - API key
     * @param {AbortSignal} params.signal - Abort signal
     * @param {Object} params.options - Options (temperature, webSearch)
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
        throw new AdapterError('missingApiKey', 'API key not provided')
      }
      
      // 1. Build request
      const body = buildGeminiRequestBody({ messages, system, options })
      
      // 2. Send HTTP request
      const { response, responseBody, responseMs } = await sendGeminiRequest({ model, apiKey, body, signal })
      
      // 3. Parse and extract result
      const result = await parseGeminiResponse({ response, responseBody })
      
      return { ...result, responseMs }
    }
  }
}
