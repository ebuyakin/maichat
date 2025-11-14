import { ProviderError, classifyError } from './adapter.js'

/** OpenAI Responses API adapter (non-streaming)
 *  - Endpoint: POST /v1/responses
 *  - Input format: `input` array of role/content blocks using typed segments
 *    - user turns   → [{ type: 'input_text',  text }]
 *    - assistant    → [{ type: 'output_text', text }] (for history)
 *  - System prompt goes into `instructions` (not a message turn)
 *  - Optional native web search: tools: [{ type: 'web_search' }], tool_choice: 'auto'
 *  - Returns: { content, usage, citations?, citationsMeta?, __timing }
 */
export function createOpenAIAdapter() {
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
      // Responses API: keep system separately in `instructions`; do not inject a system turn
      const msgArr = messages

      // Build Responses API payload with image parts embedded in correct user messages
      const mkContentBlocks = async (arr) => {
        const out = []
        for (const m of arr) {
          const base = {
            role: m.role,
            content: [
              {
                type: m.role === 'user' ? 'input_text' : 'output_text',
                text: m.content,
              },
            ],
          }
          // If this user message has attachments, add them as image parts
          if (m.role === 'user' && m.attachments && m.attachments.length > 0 && helpers?.encodeImage) {
            for (const id of m.attachments) {
              try {
                const { mime, data } = await helpers.encodeImage(id)
                const url = `data:${mime};base64,${data}`
                // OpenAI Responses API expects image_url to be a string (data URL), not an object
                base.content.push({ type: 'input_image', image_url: url })
              } catch (e) {
                // Skip failed encodes; continue with remaining images
                if (typeof console !== 'undefined') console.warn('[openai] skip image', id, e)
              }
            }
          }
          out.push(base)
        }
        return out
      }
      const baseTools = options && options.webSearch === true
        ? [{ type: 'web_search' }]
        : undefined
      const maxTok = options && typeof options.maxOutputTokens === 'number' ? options.maxOutputTokens : undefined
      const requestBody = {
        model,
        input: await mkContentBlocks(msgArr),
        ...(system ? { instructions: system } : {}),
        ...(baseTools ? { tools: baseTools, tool_choice: 'auto' } : {}),
        ...(maxTok != null ? { max_output_tokens: maxTok } : {}),
      }

      // Debug hook: capture last outbound request (sans auth headers)
      try {
        if (typeof window !== 'undefined') {
          const now = Date.now()
          window.__maichatLastRequest = {
            timestamp: now,
            timestampISO: new Date(now).toISOString(),
            provider: 'openai',
            model,
            json: payloadStr,
          }
          try {
            localStorage.setItem('maichat_dbg_openai_request', JSON.stringify({
              timestamp: now,
              timestampISO: new Date(now).toISOString(),
              model,
              provider: 'openai',
              payload: JSON.parse(payloadStr)
            }))
          } catch {}
        }
      } catch {}

      let resp
      tSerializeEnd = now()
      const payloadStr = JSON.stringify(requestBody)
      try {
        // Execute request
        tFetchStart = now()
        resp = await fetch('https://api.openai.com/v1/responses', {
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
        const err = new ProviderError('network error', 'network')
        err.__timing = { t0, tSerializeStart, tSerializeEnd, tFetchStart, tFetchEnd }
        throw err
      }
      let data
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
          // Debug: capture last error response
          try {
            if (typeof window !== 'undefined') {
              const now = Date.now()
              window.__maichatLastResponse = {
                timestamp: now,
                timestampISO: new Date(now).toISOString(),
                provider: 'openai',
                model,
                status: resp.status,
                json: JSON.stringify(j),
              }
              try {
                localStorage.setItem('maichat_dbg_openai_response', JSON.stringify({
                  timestamp: now,
                  timestampISO: new Date(now).toISOString(),
                  model,
                  provider: 'openai',
                  status: resp.status,
                  response: j
                }))
              } catch {}
            }
          } catch {}
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
      data = await resp.json()
      tParseEnd = now()

      // Debug: capture last successful response
      try {
        if (typeof window !== 'undefined') {
          const now = Date.now()
          window.__maichatLastResponse = {
            timestamp: now,
            timestampISO: new Date(now).toISOString(),
            provider: 'openai',
            model,
            status: resp.status,
            json: JSON.stringify(data),
          }
          try {
            localStorage.setItem('maichat_dbg_openai_response', JSON.stringify({
              timestamp: now,
              timestampISO: new Date(now).toISOString(),
              model,
              provider: 'openai',
              status: resp.status,
              response: data
            }))
          } catch {}
        }
      } catch {}

      // Parse Responses API content
      let content = ''
      try {
        if (Array.isArray(data.output)) {
          for (const item of data.output) {
            const blocks = Array.isArray(item?.content) ? item.content : []
            for (const b of blocks) {
              const t = b && (b.text || b.value || (typeof b === 'string' ? b : ''))
              if (typeof t === 'string') content += t
            }
          }
        } else if (data.output_text && typeof data.output_text === 'string') {
          content = data.output_text
        } else if (data.choices?.[0]?.message?.content) {
          // Fallback (if server routed to legacy under the hood)
          content = data.choices[0].message.content
        }
      } catch {}

      // Extract citations (URLs) and optional titles from typical Responses shapes
      let citations
      let citationsMeta
      try {
        const urls = []
        const titleMap = {}
        const push = (u, t) => {
          if (typeof u === 'string' && /^https?:\/\//i.test(u)) {
            urls.push(u)
            if (typeof t === 'string' && t) titleMap[u] = t
          }
        }
        // 1) Walk output blocks for citations/annotations
        if (Array.isArray(data.output)) {
          for (const item of data.output) {
            const blocks = Array.isArray(item?.content) ? item.content : []
            for (const b of blocks) {
              // Common: b.citations (array of { url, title, ... })
              if (Array.isArray(b?.citations)) {
                for (const c of b.citations) push(c?.url, c?.title)
              }
              // Some variants: b.annotations with web refs
              if (Array.isArray(b?.annotations)) {
                for (const a of b.annotations) push(a?.url || a?.href, a?.title || a?.source)
              }
              // Nested server tool result-style content
              if (Array.isArray(b?.content)) {
                for (const it of b.content) {
                  if (it && (it.type === 'web_result' || it.type === 'search_result')) push(it.url, it.title)
                }
              }
            }
          }
        }
        // 2) Look for top-level references if present
        if (Array.isArray(data.references)) {
          for (const r of data.references) push(r?.url, r?.title)
        }
        if (urls.length) {
          const seen = new Set()
          const dedup = []
          for (const u of urls) if (!seen.has(u)) { seen.add(u); dedup.push(u) }
          citations = dedup
          if (Object.keys(titleMap).length) citationsMeta = titleMap
        }
      } catch {}

      // Usage mapping
      const usage = data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens:
              typeof data.usage.total_tokens === 'number' ? data.usage.total_tokens : undefined,
          }
        : undefined
      return {
        content: content || '',
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
