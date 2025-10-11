// Gemini API adapter (Google Generative AI)
// Direct browser-compatible API calls (no proxy needed)

import { ProviderError, classifyError } from './adapter.js'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

export function createGeminiAdapter() {
  return {
    /** @param {import('./adapter.js').ChatRequest} req */
    async sendChat(req) {
      const { model, messages, system, apiKey, signal, options } = req
      const now =
        (typeof performance !== 'undefined' && performance.now.bind(performance)) || Date.now
      const t0 = now()
      let tSerializeStart, tSerializeEnd, tFetchStart, tFetchEnd, tParseStart, tParseEnd

      if (!apiKey) throw new ProviderError('missing api key', 'auth', 401)

      tSerializeStart = now()

      // Convert universal format to Gemini format
      const contents = messages.map(msg => ({
        parts: [{ text: msg.content }],
        role: msg.role === 'assistant' ? 'model' : 'user'
      }))

      const body = {
        contents
      }

      // Add system instruction if provided
      if (system) {
        body.systemInstruction = {
          parts: [{ text: system }]
        }
      }

      // Add generation config
      if (options) {
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
      }

      const payloadStr = JSON.stringify(body)

      // Debug hook (parity with OpenAI adapter)
      try {
        if (typeof window !== 'undefined') {
          window.__maichatLastRequest = {
            at: Date.now(),
            model,
            json: payloadStr,
            provider: 'gemini'
          }
        }
      } catch {}

      tSerializeEnd = now()

      let resp
      try {
        tFetchStart = now()
        resp = await fetch(`${GEMINI_URL}/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
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

      // Extract content from Gemini response
      let content = ''
      try {
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
          const parts = data.candidates[0].content.parts || []
          content = parts.map(part => part.text || '').join('')
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