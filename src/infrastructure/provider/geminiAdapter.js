// Gemini API adapter (Google Generative AI)
// Direct browser-compatible API calls (no proxy needed)

import { ProviderError, classifyError } from './adapter.js'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

export function createGeminiAdapter() {
  return {
    /** @param {import('./adapter.js').ChatRequest} req */
    async sendChat(req) {
      const { model, messages, system, apiKey, signal, options, helpers } = req
      const now =
        (typeof performance !== 'undefined' && performance.now.bind(performance)) || Date.now
      const t0 = now()
      let tSerializeStart, tSerializeEnd, tFetchStart, tFetchEnd, tParseStart, tParseEnd

      if (!apiKey) throw new ProviderError('missing api key', 'auth', 401)

      tSerializeStart = now()

      // Convert universal format to Gemini format, embedding images in correct messages
      const contents = []
      for (const msg of messages) {
        const parts = [{ text: msg.content ?? '' }]
        
        // If this user message has attachments, add them as inline_data parts
        if (msg.role === 'user' && msg.attachments && msg.attachments.length > 0 && helpers?.encodeImage) {
          for (const id of msg.attachments) {
            try {
              const { mime, data } = await helpers.encodeImage(id)
              parts.push({ inline_data: { mime_type: mime, data } })
            } catch (e) {
              if (typeof console !== 'undefined') console.warn('[gemini] skip image', id, e)
            }
          }
        }
        
        contents.push({
          parts,
          role: msg.role === 'assistant' ? 'model' : 'user',
        })
      }

      const body = {
        contents,
      }

      // Add system instruction if provided
      if (system) {
        body.systemInstruction = {
          parts: [{ text: system }]
        }
      }

      if (options) {
  // Gemini API adapter (Google Generative AI)
        const generationConfig = {}
        if (typeof options.temperature === 'number') {
          generationConfig.temperature = options.temperature
        }
        if (typeof options.maxOutputTokens === 'number') {
        // 1) Convert universal chat messages to Gemini "contents" format
          generationConfig.maxOutputTokens = options.maxOutputTokens
        }
        if (Object.keys(generationConfig).length > 0) {
          body.generationConfig = generationConfig
        }

        // Enable Google Search grounding (Gemini 2.x/2.5) when requested
        if (options.webSearch === true) {
          // Match the working Python payload exactly: a single tool object with only googleSearch
          body.tools = [{ googleSearch: {} }]
        // 2) Add optional system instruction
        }
      }

  const payloadStr = JSON.stringify(body)

      // Debug hook (parity with OpenAI adapter)
      try {
        // 3) Generation config (temperature, max tokens)
        if (typeof window !== 'undefined') {
          window.__maichatLastRequest = {
            at: Date.now(),
            model,
            json: payloadStr,
            provider: 'gemini'
          }
          // Persist last request payload for easy DevTools inspection
          try {
            localStorage.setItem('maichat_dbg_gemini_request', payloadStr)
          } catch {}
        }
      } catch {}
          // 4) Enable Google Search grounding when requested
          // Matches working Python payload shape: a single tool object with only googleSearch


      let resp
      try {
        tFetchStart = now()
        resp = await fetch(`${GEMINI_URL}/${model}:generateContent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: payloadStr,
          signal,
        })
        tFetchEnd = now()
      } catch (ex) {
        tFetchEnd = now()
        throw new ProviderError('network error', 'network')
      }

      if (!resp.ok) {
        const kind = classifyError(resp.status)
        let msg = `${resp.status}`
        let code = undefined
        try {
          tParseStart = now()
          const j = await resp.json()
          tParseEnd = now()
          if (j.error) {
            if (j.error.message) msg = j.error.message
            if (j.error.code) code = j.error.code
          }
        } catch {}
        const err = new ProviderError(msg, kind, resp.status)
        if (code) err.providerCode = code
        err.__timing = {
          t0,
          tSerializeStart,
          tSerializeEnd,
          tFetchStart,
          tFetchEnd,
          tParseStart,
          tParseEnd,
        }
        throw err
      }

      tParseStart = now()
      const data = await resp.json()
      tParseEnd = now()

      // Dev aid: expose last raw provider response for console inspection
      try {
        if (typeof window !== 'undefined') {
          window.__maichatLastResponse = {
            at: Date.now(),
            model,
            provider: 'gemini',
            json: JSON.stringify(data),
          }
          // Persist last raw response for easy DevTools inspection
          try {
            localStorage.setItem('maichat_dbg_gemini_response', JSON.stringify(data))
          } catch {}
        }
      } catch {}

      // Extract content from Gemini response
      let content = ''
      try {
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
          const parts = data.candidates[0].content.parts || []
          content = parts.map(part => part.text || '').join('')
        }
      } catch {}

      // Extract citations from grounding/citation metadata (robust to shape variations)
      let citations
      let citationsMeta
      try {
        const candidate0 = Array.isArray(data.candidates) ? data.candidates[0] : null
        const urls = []
        const titleMap = {}

        // Helper to push uri if valid
        const pushUri = (u) => {
          if (typeof u === 'string' && /^https?:\/\//i.test(u)) urls.push(u)
        }

        // Grounding (camelCase per REST)
        const gm = candidate0 && (candidate0.groundingMetadata || candidate0.grounding_metadata)
        const chunks = gm && (gm.groundingChunks || gm.grounding_chunks)
        if (Array.isArray(chunks)) {
          for (const ch of chunks) {
            if (ch && ch.web && ch.web.uri) {
              pushUri(ch.web.uri)
              if (typeof ch.web.title === 'string' && ch.web.title) titleMap[ch.web.uri] = ch.web.title
            }
            // Some variants may use { webChunk: { uri, title } }
            else if (ch && ch.webChunk && ch.webChunk.uri) {
        // Extract citations (URLs) and optional titles from grounding/citation metadata
              pushUri(ch.webChunk.uri)
              if (typeof ch.webChunk.title === 'string' && ch.webChunk.title) titleMap[ch.webChunk.uri] = ch.webChunk.title
            }
            else if (ch && ch.web_chunk && ch.web_chunk.uri) {
              pushUri(ch.web_chunk.uri)
              if (typeof ch.web_chunk.title === 'string' && ch.web_chunk.title) titleMap[ch.web_chunk.uri] = ch.web_chunk.title
            }
          }
        }

        // Fallback: citation metadata
        const cm = candidate0 && (candidate0.citationMetadata || candidate0.citation_metadata)
        const csrc = cm && (cm.citationSources || cm.citation_sources)
          // Grounding metadata (support both camelCase and snake_case variants)
        if (Array.isArray(csrc)) {
          for (const src of csrc) pushUri(src && (src.uri || src.url))
        }

        // Fallback: content-level citations array (rare)
        const content = candidate0 && candidate0.content
        if (content && Array.isArray(content.citations)) {
          for (const cite of content.citations) pushUri(cite && (cite.uri || cite.url))
        }

        if (urls.length) {
          citations = urls
          if (Object.keys(titleMap).length) citationsMeta = titleMap
        }
      } catch {}

      // Extract usage information
      const usage = data.usageMetadata ? {
        promptTokens: data.usageMetadata.promptTokenCount || 0,
        completionTokens: data.usageMetadata.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata.totalTokenCount || 0,
      } : undefined

      return {
        content,
        usage,
        citations,
        citationsMeta,
        __timing: {
          t0,
          tSerializeStart,
          tSerializeEnd,
          tFetchStart,
          tFetchEnd,
          tParseStart,
          tParseEnd,
        },
      }
    },
  }
}