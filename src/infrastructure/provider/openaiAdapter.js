// Moved from src/provider/openaiAdapter.js (Phase 3 infrastructure move)
import { ProviderError, classifyError } from './adapter.js'

/** Simple non-streaming OpenAI Chat Completions adapter */
export function createOpenAIAdapter(){
  return {
    /** @param {import('./adapter.js').ChatRequest} req */
    async sendChat(req){
      const { model, messages, apiKey, signal } = req
      const now = (typeof performance!=='undefined' && performance.now.bind(performance)) || Date.now
      const t0 = now()
      let tSerializeStart, tSerializeEnd, tFetchStart, tFetchEnd, tParseStart, tParseEnd
      if(!apiKey) throw new ProviderError('missing api key','auth',401)
      tSerializeStart = now()
      const body = { model, messages: messages.map(m=> ({ role:m.role, content:m.content })) }
      const payloadStr = JSON.stringify(body)
      try {
        // Expose last outbound payload (excluding auth headers) for debug HUD.
        // Overwrites each request; minimal memory footprint.
        if (typeof window !== 'undefined') {
          window.__maichatLastRequest = { at: Date.now(), model, json: payloadStr }
        }
      } catch {}
      tSerializeEnd = now()
      let resp
      try {
        tFetchStart = now()
        resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method:'POST',
          headers:{
            'Content-Type':'application/json',
            'Authorization':`Bearer ${apiKey}`
          },
          body: payloadStr,
            signal
        })
        tFetchEnd = now()
      } catch(ex){
        tFetchEnd = now()
        throw new ProviderError('network error','network')
      }
      if(!resp.ok){
        const kind = classifyError(resp.status)
        let msg = `${resp.status}`
        let code = undefined
        try {
          tParseStart = now()
          const j = await resp.json()
          tParseEnd = now()
          if(j.error){
            if(j.error.message) msg = j.error.message
            if(j.error.code) code = j.error.code // e.g. context_length_exceeded
          }
        } catch{}
        const err = new ProviderError(msg, kind, resp.status)
        if(code) err.providerCode = code
        err.__timing = { t0, tSerializeStart, tSerializeEnd, tFetchStart, tFetchEnd, tParseStart, tParseEnd }
        throw err
      }
      tParseStart = now()
      const data = await resp.json()
      tParseEnd = now()
      const content = data.choices?.[0]?.message?.content || ''
      const usage = data.usage || undefined
      return { content, usage, __timing: { t0, tSerializeStart, tSerializeEnd, tFetchStart, tFetchEnd, tParseStart, tParseEnd } }
    }
  }
}
