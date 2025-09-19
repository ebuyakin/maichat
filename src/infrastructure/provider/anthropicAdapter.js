// Anthropic Messages API adapter (non-streaming)
import { ProviderError, classifyError } from './adapter.js'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

export function createAnthropicAdapter(){
  return {
    /** @param {import('./adapter.js').ChatRequest} req */
    async sendChat(req){
      const { model, messages, system, apiKey, signal, options } = req
      if(!apiKey) throw new ProviderError('missing api key','auth',401)
      // Translate universal envelope to Anthropic schema
      const msgPayload = messages.map(m=> ({ role: m.role, content: [{ type:'text', text: m.content }] }))
      const body = { model, messages: msgPayload }
      if(system) body.system = system
      if(options){
        if(typeof options.temperature === 'number') body.temperature = options.temperature
        if(typeof options.maxOutputTokens === 'number') body.max_tokens = options.maxOutputTokens
      }
      const payloadStr = JSON.stringify(body)
      let resp
      try {
        resp = await fetch(ANTHROPIC_URL, {
          method:'POST',
          headers:{
            'Content-Type':'application/json',
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_VERSION
          },
          body: payloadStr,
          signal
        })
      } catch(_){
        throw new ProviderError('network error','network')
      }
      if(!resp.ok){
        const kind = classifyError(resp.status)
        let msg = `${resp.status}`
        try {
          const j = await resp.json()
          if(j && j.error && j.error.message) msg = j.error.message
        } catch {}
        throw new ProviderError(msg, kind, resp.status)
      }
      const data = await resp.json()
      // Anthropic content can be an array of blocks; join text blocks
      let text = ''
      try {
        const blocks = data.content || []
        text = blocks.map(b=> (b && b.type==='text' ? b.text : '')).join('')
      } catch {}
      const usage = data.usage ? {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: typeof data.usage.total_tokens === 'number' ? data.usage.total_tokens : undefined
      } : undefined
      return { content: text, usage }
    }
  }
}
