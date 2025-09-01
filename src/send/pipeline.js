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
export async function executeSend({ store, model, userText, signal, visiblePairs, onDebugPayload }){
  const settings = getSettings()
  const { userRequestAllowance=100, maxTrimAttempts=10, charsPerToken=3.5 } = settings
  // Baseline (chronological filtered list)
  const baseline = visiblePairs ? visiblePairs.slice() : store.getAllPairs().sort((a,b)=> a.createdAt - b.createdAt)
  // Predicted context (X) – reserve URA (userRequestAllowance); gatherContext currently still uses legacy budgeting but we override selection here.
  // We'll recompute a prediction: accumulate newest→oldest until (history + URA) exceeds raw maxUsable.
  const budget = getModelBudget(model)
  const maxContext = budget.maxContext
  // For this revised model we ignore responseReserve for prediction.
  const allowance = userRequestAllowance
  const predictedRev=[]
  let historyEstimate=0
  for(let i=baseline.length-1;i>=0;i--){
    const p = baseline[i]
    const tok = estimatePairTokens(p, charsPerToken)
    if(historyEstimate + tok + allowance > maxContext) break
    predictedRev.push(p)
    historyEstimate += tok
  }
  const predicted = predictedRev.reverse() // X
  const userTokens = estimateTokens(userText, charsPerToken)
  if(userTokens > maxContext){
    const err = new Error('message too large for model window')
    err.code='user_prompt_too_large'
    throw err
  }
  // Initial attempt uses full predicted context regardless of AUT > URA.
  let trimmedCount = 0
  let attemptsUsed = 0
  let currentIncluded = predicted.slice()
  // helper to build and optionally debug
  function emitDebug(extra={}){
    if(typeof onDebugPayload !== 'function') return
    const historyTokens = currentIncluded.reduce((acc,p)=> acc + estimatePairTokens(p, charsPerToken), 0)
    const totalTokensEstimate = historyTokens + userTokens
    onDebugPayload({
      model,
      budget: { maxContext, maxUsableRaw: maxContext },
      selection: currentIncluded.map(p=> ({ id:p.id, model:p.model, tokens: estimatePairTokens(p,charsPerToken) })),
      predictedCount: predicted.length,
      trimmedCount,
      attemptsUsed,
      userTokens,
      charsPerToken,
      predictedHistoryTokens: predicted.reduce((acc,p)=> acc + estimatePairTokens(p, charsPerToken), 0),
      historyTokens,
      totalTokensEstimate,
      remainingReserve: maxContext - historyTokens - userTokens,
      messages: buildMessages({ includedPairs: currentIncluded, newUserText: userText }),
      ...extra
    })
  }
  async function attemptSend(){
    emitDebug()
    const provider = getProvider('openai')
    if(!provider) throw new Error('provider_not_registered')
    const apiKey = getApiKey('openai')
    if(!apiKey) throw new Error('missing_api_key')
    return provider.sendChat({ model, messages: buildMessages({ includedPairs: currentIncluded, newUserText: userText }), apiKey, signal })
  }
  function isOverflowError(e){
    if(!e) return false
    const msg = (e.message||'').toLowerCase()
    return ['context_length','maximum context length','too many tokens','context too long','exceeds context window'].some(s=> msg.includes(s))
  }
  try {
    return await attemptSend()
  } catch(ex){
    if(isOverflowError(ex)){
      // initial overflow before trimming
      emitDebug({ lastErrorMessage: ex.message, overflowMatched:true, stage:'overflow_initial' })
      while(trimmedCount < maxTrimAttempts && currentIncluded.length){
        currentIncluded.shift() // drop oldest
        trimmedCount++
        attemptsUsed = trimmedCount
        try { return await attemptSend() } catch(inner){
          if(isOverflowError(inner)){
            emitDebug({ lastErrorMessage: inner.message, overflowMatched:true, stage:'overflow_retry' })
            continue
          } else {
            // Non-overflow error encountered during trimming retries
            emitDebug({ lastErrorMessage: inner.message, overflowMatched:false, stage:'retry_non_overflow' })
            if(inner instanceof ProviderError && inner.kind==='auth'){
              const err = new Error('api_key_auth_failed'); err.__original = inner; throw err
            }
            throw inner
          }
        }
      }
      const err = new Error('context_overflow_after_trimming')
      err.code='context_overflow_after_trimming'
      err.trimmedCount = trimmedCount
      err.predictedCount = predicted.length
      emitDebug({ lastErrorMessage: err.message, overflowMatched:true, stage:'overflow_exhausted' })
      throw err
    }
    // Non-overflow path
    if(ex instanceof ProviderError && ex.kind==='auth'){
      const err = new Error('api_key_auth_failed'); err.__original = ex; emitDebug({ lastErrorMessage: err.message, overflowMatched:false, stage:'auth_error' }); throw err
    }
    // Possibly rate limit / network / 429 etc.
    emitDebug({ lastErrorMessage: ex.message, overflowMatched:false, stage:'other_error' })
    throw ex
  }
}
