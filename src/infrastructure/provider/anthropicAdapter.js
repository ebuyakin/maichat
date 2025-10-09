// Anthropic Messages API adapter (non-streaming)
import { ProviderError, classifyError } from './adapter.js'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_PROXY_URL = 'https://anthropic-proxy-phi.vercel.app/api/anthropic'
const ANTHROPIC_VERSION = '2023-06-01'

export function createAnthropicAdapter() {
  return {
    /** @param {import('./adapter.js').ChatRequest} req */
    async sendChat(req) {
      const { model, messages, system, apiKey, signal, options, budget, userOverrides } = req
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
      const msgPayload = normalized.map((m) => ({
        role: m.role,
        content: [{ type: 'text', text: m.content }],
      }))
      const body = { model, messages: msgPayload }
      if (system) body.system = system
      if (options && typeof options.temperature === 'number') body.temperature = options.temperature
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
      // Anthropic content can be an array of blocks; join text blocks
      let text = ''
      try {
        const blocks = data.content || []
        text = blocks.map((b) => (b && b.type === 'text' ? b.text : '')).join('')
      } catch {}
      const usage = data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens:
              typeof data.usage.total_tokens === 'number' ? data.usage.total_tokens : undefined,
          }
        : undefined
      return { content: text, usage }
    },
  }
}
