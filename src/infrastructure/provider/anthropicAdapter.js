// Anthropic Messages API adapter (non-streaming)
import { ProviderError, classifyError } from './adapter.js'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_PROXY_URL = 'https://anthropic-proxy-phi.vercel.app/api/anthropic'
const ANTHROPIC_VERSION = '2023-06-01'

export function createAnthropicAdapter() {
  return {
    /** @param {import('./adapter.js').ChatRequest} req */
    async sendChat(req) {
      const {
        model,
        messages,
        system,
        apiKey,
        signal,
        options,
        budget,
        userOverrides,
        attachments = [],
        helpers,
      } = req
      if (!apiKey) throw new ProviderError('missing api key', 'auth', 401)
      // Translate universal envelope to Anthropic schema
      // Enforce Anthropic role alternation: insert placeholder assistant turns between consecutive user messages.
      let insertedPlaceholders = 0
      const normalized = []
      for (const m of messages) {
        const prev = normalized[normalized.length - 1]
        if (prev && prev.role === m.role) {
          if (m.role === 'user') {
            normalized.push({ role: 'assistant', content: 'failed to respond' })
            insertedPlaceholders++
          } else {
            // Extremely unlikely in our pipeline; insert minimal user placeholder if occurs
            normalized.push({ role: 'user', content: 'failed to respond' })
            insertedPlaceholders++
          }
        }
        normalized.push(m)
      }
      // Build Messages API payload and append image blocks to the last user turn (if any)
      let lastUserIdx = -1
      for (let i = normalized.length - 1; i >= 0; i--) {
        if (normalized[i] && normalized[i].role === 'user') {
          lastUserIdx = i
          break
        }
      }
      const msgPayload = []
      for (let i = 0; i < normalized.length; i++) {
        const m = normalized[i]
        const entry = {
          role: m.role,
          content: [{ type: 'text', text: m.content }],
        }
        if (i === lastUserIdx && attachments && attachments.length > 0 && helpers?.encodeImage) {
          for (const id of attachments) {
            try {
              const { mime, data } = await helpers.encodeImage(id)
              entry.content.push({ type: 'image', source: { type: 'base64', media_type: mime, data } })
            } catch (e) {
              if (typeof console !== 'undefined') console.warn('[anthropic] skip image', id, e)
            }
          }
        }
        msgPayload.push(entry)
      }
      const body = { model, messages: msgPayload }
      if (system) body.system = system
      if (options && typeof options.temperature === 'number') body.temperature = options.temperature
      // Enable server-side web search tool (Claude native) when requested
      if (options && options.webSearch === true) {
        body.tools = [
          {
            type: 'web_search_20250305',
            name: 'web_search',
          },
        ]
      }
      // Output cap (required) per spec: max_tokens = min(R, otpm?, UTMO?) ignoring undefined.
      try {
        const R =
          budget && typeof budget.remainingContext === 'number'
            ? budget.remainingContext
            : undefined
        const otpm = req.meta && typeof req.meta.otpm === 'number' ? req.meta.otpm : undefined
        const utmo =
          userOverrides && typeof userOverrides.maxOutputTokens === 'number'
            ? userOverrides.maxOutputTokens
            : undefined
        const candidates = [R, otpm, utmo].filter((v) => typeof v === 'number' && v > 0)
        const cap = candidates.length ? Math.min(...candidates) : R != null ? R : undefined
        const capInt = cap != null ? Math.floor(cap) : 0
        if (!capInt || capInt < 1)
          throw new ProviderError('context overflow (no output room)', 'bad-request')
        body.max_tokens = capInt
      } catch (ex) {
        if (ex instanceof ProviderError) throw ex
        throw new ProviderError('max token computation failed', 'bad-request')
      }
      const payloadStr = JSON.stringify(body)
      // Parity debug hook (similar to OpenAI adapter) – capture last outbound request (sans auth headers)
      try {
        if (typeof window !== 'undefined') {
          window.__maichatLastRequest = {
            at: Date.now(),
            model,
            json: payloadStr,
            placeholderInsertions: insertedPlaceholders,
          }
          try {
            localStorage.setItem('maichat_dbg_anthropic_request', payloadStr)
          } catch {}
        }
      } catch {}
      let resp
      try {
        resp = await fetch(ANTHROPIC_PROXY_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
          },
          body: payloadStr,
          signal,
        })
      } catch (_) {
        throw new ProviderError('network error', 'network')
      }
      if (!resp.ok) {
        const kind = classifyError(resp.status)
        let msg = `${resp.status}`
        try {
          const j = await resp.json()
          if (j && j.error && j.error.message) msg = j.error.message
        } catch {}
        throw new ProviderError(msg, kind, resp.status)
      }
      const data = await resp.json()
      // Persist response for debugging
      try {
        localStorage.setItem('maichat_dbg_anthropic_response', JSON.stringify(data))
      } catch {}
      // Anthropic content is an array of blocks; join text blocks for display
      let text = ''
      try {
        const blocks = data.content || []
        text = blocks.map((b) => (b && b.type === 'text' ? b.text : '')).join('')
      } catch {}
      // Extract citations from Claude web search outputs
      // Sources can appear in:
      // - text blocks: b.type==='text' with b.citations: [{ type:'web_search_result_location', url, title, ... }]
      // - web_search_tool_result blocks: with content entries of type 'web_search_result' (fallback)
      let citations
      let citationsMeta
      try {
        const blocks = Array.isArray(data.content) ? data.content : []
        const urls = []
        const titleMap = {}
        const pushUrl = (u, t) => {
          if (typeof u === 'string' && /^https?:\/\//i.test(u)) {
            urls.push(u)
            if (typeof t === 'string' && t) titleMap[u] = t
          }
        }
        for (const b of blocks) {
          if (!b || typeof b !== 'object') continue
          if (b.type === 'text' && Array.isArray(b.citations)) {
            for (const c of b.citations) {
              if (c && typeof c.url === 'string') pushUrl(c.url, c.title)
            }
          } else if (b.type === 'web_search_tool_result') {
            const cnt = b.content
            if (Array.isArray(cnt)) {
              for (const it of cnt) {
                if (it && it.type === 'web_search_result' && typeof it.url === 'string') {
                  pushUrl(it.url, it.title)
                }
              }
            } else if (cnt && cnt.type === 'web_search_result' && typeof cnt.url === 'string') {
              pushUrl(cnt.url, cnt.title)
            }
          }
        }
        if (urls.length) {
          // Deduplicate preserving order
          const seen = new Set()
          const dedup = []
          for (const u of urls) {
            if (!seen.has(u)) {
              seen.add(u)
              dedup.push(u)
            }
          }
          citations = dedup
          if (Object.keys(titleMap).length) citationsMeta = titleMap
        }
      } catch {}
      const usage = data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens:
              typeof data.usage.total_tokens === 'number' ? data.usage.total_tokens : undefined,
          }
        : undefined
      return { content: text, usage, citations, citationsMeta }
    },
  }
}
