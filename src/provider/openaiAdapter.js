import { ProviderError, classifyError } from './adapter.js'

/** Simple non-streaming OpenAI Chat Completions adapter */
export function createOpenAIAdapter(){
  return {
    /** @param {import('./adapter.js').ChatRequest} req */
    async sendChat(req){
      const { model, messages, apiKey, signal } = req
      if(!apiKey) throw new ProviderError('missing api key','auth',401)
      const body = {
        model,
        messages: messages.map(m=> ({ role:m.role, content:m.content }))
      }
      let resp
      try {
        resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method:'POST',
          headers:{
            'Content-Type':'application/json',
            'Authorization':`Bearer ${apiKey}`
          },
          body: JSON.stringify(body),
            signal
        })
      } catch(ex){
        throw new ProviderError('network error','network')
      }
      if(!resp.ok){
        const kind = classifyError(resp.status)
        let msg = `${resp.status}`
        try { const j = await resp.json(); if(j.error?.message) msg = j.error.message }
        catch{}
        throw new ProviderError(msg, kind, resp.status)
      }
      const data = await resp.json()
      const content = data.choices?.[0]?.message?.content || ''
      const usage = data.usage || undefined
      return { content, usage }
    }
  }
}
