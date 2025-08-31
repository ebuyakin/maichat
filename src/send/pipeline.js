import { gatherContext } from '../context/gatherContext.js'
import { getProvider } from '../provider/adapter.js'
import { estimateTokens } from '../context/tokenEstimator.js'
import { getSettings } from '../settings/index.js'

/** Build chat messages array from included pairs plus new user text */
export function buildMessages({ includedPairs, newUserText }){
  const msgs = []
  // (Optional future: system/style messages)
  for(const p of includedPairs){
    if(p.userText) msgs.push({ role:'user', content:p.userText })
    if(p.assistantText) msgs.push({ role:'assistant', content:p.assistantText })
  }
  if(newUserText){ msgs.push({ role:'user', content:newUserText }) }
  return msgs
}

/** Execute send using provider; returns { assistantText, usage } or throws */
export async function executeSend({ store, model, userText, signal }){
  const visible = store.getAllPairs().sort((a,b)=> a.createdAt - b.createdAt) // later: pass filtered subset
  const ctx = gatherContext(visible, { charsPerToken:4 })
  // Re-run with actual user text allowance if needed (store already subtracted assumed allowance earlier)
  const settings = getSettings()
  // (We could recompute dropping more here if needed; for now rely on send-time earlier logic.)
  const included = ctx.included
  const messages = buildMessages({ includedPairs: included, newUserText: userText })
  // Large single prompt guard
  const userTokens = estimateTokens(userText, 4)
  const maxUsableRaw = ctx.stats.maxUsableRaw || (ctx.stats.maxUsable + (ctx.stats.assumedUserTokens||0))
  if(userTokens > maxUsableRaw){
    throw new Error('message too large for model window')
  }
  const provider = getProvider('openai')
  if(!provider) throw new Error('provider not registered')
  const apiKey = localStorage.getItem('maichat.openai.key') || ''
  if(!apiKey) throw new Error('missing_api_key')
  const res = await provider.sendChat({ model, messages, apiKey, signal })
  return res
}
