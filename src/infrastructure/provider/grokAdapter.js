// xAI Grok Chat Completions adapter with search tools support
import { ProviderError, classifyError } from './adapter.js'

/** 
 * xAI Grok adapter using Chat Completions API.
 * Search is enabled via `search_parameters` (not `tools`).
 */
export function createGrokAdapter() {
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
      
      // Build message array
      const msgArr = system ? [{ role: 'system', content: system }, ...messages] : messages

      // Build request body with images embedded in correct user messages
      const body = {
        model,
        messages: await (async () => {
          const out = []
          for (const m of msgArr) {
            // If this user message has attachments, transform content to array of parts
            if (m.role === 'user' && m.attachments && m.attachments.length > 0 && helpers?.encodeImage) {
              const parts = [{ type: 'text', text: m.content || '' }]
              for (const id of m.attachments) {
                try {
                  const { mime, data } = await helpers.encodeImage(id)
                  const url = `data:${mime};base64,${data}`
                  // Chat Completions-style content part for images
                  parts.push({ type: 'image_url', image_url: { url } })
                } catch (e) {
                  if (typeof console !== 'undefined') console.warn('[grok] skip image', id, e)
                }
              }
              out.push({ role: m.role, content: parts })
            } else {
              out.push({ role: m.role, content: m.content || '' })
            }
          }
          return out
        })(),
      }
      
      // Add optional parameters
      if (options) {
        if (typeof options.temperature === 'number') body.temperature = options.temperature
        if (typeof options.maxOutputTokens === 'number') body.max_tokens = options.maxOutputTokens

        // Chat Completions search parameters (enable citations by default when searching)
        if (options.webSearch === true) {
          body.search_parameters = {
            mode: 'auto',
            return_citations: true,
          }
        } else if (options.webSearch === false) {
          body.search_parameters = { mode: 'off' }
        }
      }
      
      const payloadStr = JSON.stringify(body)
      
      // Debug payload capture
      try {
        if (typeof window !== 'undefined') {
          const now = Date.now()
          window.__maichatLastRequest = {
            timestamp: now,
            timestampISO: new Date(now).toISOString(),
            model,
            json: payloadStr
          }
          try {
            localStorage.setItem('maichat_dbg_grok_request', JSON.stringify({
              timestamp: now,
              timestampISO: new Date(now).toISOString(),
              model,
              provider: 'grok',
              payload: JSON.parse(payloadStr)
            }))
          } catch {}
        }
      } catch {}
      
      tSerializeEnd = now()
      
      let resp
      try {
        tFetchStart = now()
        resp = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
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
      
      // Persist response for debugging
      try {
        const now = Date.now()
        localStorage.setItem('maichat_dbg_grok_response', JSON.stringify({
          timestamp: now,
          timestampISO: new Date(now).toISOString(),
          model,
          provider: 'grok',
          response: data
        }))
      } catch {}
      
      const content = data.choices?.[0]?.message?.content || ''
      const usage = data.usage || undefined
      
      // Extract citations if available (locations may vary in Chat Completions)
      let citations = undefined
      if (Array.isArray(data.citations)) {
        citations = data.citations
      } else {
        const choice0 = data.choices?.[0]
        const msg = choice0?.message || {}
        if (Array.isArray(msg.citations)) citations = msg.citations
        else if (msg.metadata && Array.isArray(msg.metadata.citations)) citations = msg.metadata.citations
      }
      
      return {
        content,
        usage,
  citations,
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
