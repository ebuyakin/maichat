// Gemini API adapter V2 (for new sendNewMessage architecture)
// Clean, focused: translates universal format → Gemini format, sends HTTP
// Images already encoded in messages, no helpers needed

import { storeFetchResponse, storeFetchError, storeRequestPayload } from '../../instrumentation/apiDebug.js'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

/**
 * Create Gemini adapter for new architecture
 * 
 * @returns {Object} Adapter with sendChat method
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
     * @returns {Promise<Object>} Response { content, usage }
     */
    async sendChat({ model, messages, system, apiKey, signal, options = {} }) {
      if (!apiKey) {
        const err = new Error('Missing API key')
        err.code = 'MISSING_API_KEY'
        err.httpStatus = 401
        throw err
      }

      // Convert universal format to Gemini format
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
              inlineData: {
                mimeType: img.mime,
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
      
      // Build request body
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
      
      // Build URL
      const url = `${GEMINI_URL}/${model}:generateContent?key=${apiKey}`
      
      // Store request payload for debugging
      storeRequestPayload('gemini', model, body)
      
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
        // Network error or abort
        storeFetchError(err, 'gemini')
        throw err
      }
      
      // Parse response
      const data = await response.json()
      
      // Store response (both success and HTTP errors)
      storeFetchResponse(response, 'gemini', data)
      
      // Check for HTTP errors
      if (!response.ok) {
        const err = new Error(`Gemini API error: ${data.error?.message || response.statusText}`)
        err.code = 'API_ERROR'
        err.httpStatus = response.status
        throw err
      }
      
      // Extract response
      const candidate = data.candidates?.[0]
      if (!candidate) {
        const err = new Error('No response from Gemini')
        err.code = 'NO_RESPONSE'
        err.httpStatus = 500
        throw err
      }
      
      const content = candidate.content?.parts
        ?.map(p => p.text)
        ?.filter(Boolean)
        ?.join('') || ''
      
      // Extract usage
      const usage = data.usageMetadata ? {
        promptTokens: data.usageMetadata.promptTokenCount || 0,
        completionTokens: data.usageMetadata.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata.totalTokenCount || 0,
      } : undefined
      
      return {
        content,
        usage,
      }
    }
  }
}
