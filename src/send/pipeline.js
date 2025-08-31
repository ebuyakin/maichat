import { gatherContext } from '../context/gatherContext.js'
import { getProvider, ProviderError } from '../provider/adapter.js'
import { estimateTokens, getModelBudget, estimatePairTokens } from '../context/tokenEstimator.js'
import { getSettings } from '../settings/index.js'
import { getApiKey } from '../api/keys.js'

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
export async function executeSend({ store, model, userText, signal, visiblePairs }){
  // visiblePairs should be the currently filtered chronological list (already sorted)
  const baseline = visiblePairs ? visiblePairs.slice() : store.getAllPairs().sort((a,b)=> a.createdAt - b.createdAt)
  const ctx = gatherContext(baseline, { charsPerToken:4 })
  // Re-trim with actual user text: allow any assumedUserTokens to be replaced by real size; if overflow drop oldest.
  const userTokens = estimateTokens(userText, 4)
  const budget = getModelBudget(model)
  const maxUsableRaw = budget.maxContext - budget.responseReserve - budget.safetyMargin
  if(userTokens > maxUsableRaw){
    throw new Error('message too large for model window')
  }
  // Build list of included pairs newest→oldest until fits with userTokens
  let total= userTokens
  const selectedRev=[]
  for(let i=baseline.length-1;i>=0;i--){
    const p = baseline[i]
    const tok = estimatePairTokens(p,4)
    if(total + tok > maxUsableRaw) break
    selectedRev.push(p)
    total += tok
  }
  const finalIncluded = selectedRev.reverse()
  const messages = buildMessages({ includedPairs: finalIncluded, newUserText: userText })
  const provider = getProvider('openai')
  if(!provider) throw new Error('provider_not_registered')
  const apiKey = getApiKey('openai')
  if(!apiKey) throw new Error('missing_api_key')
  try {
    const res = await provider.sendChat({ model, messages, apiKey, signal })
    return res
  } catch(ex){
    if(ex instanceof ProviderError){
      // Normalize auth errors to a stable code the UI can act on.
      if(ex.kind === 'auth'){
        const err = new Error('api_key_auth_failed')
        err.__original = ex
        throw err
      }
    }
    throw ex
  }
}
