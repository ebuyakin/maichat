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
export async function executeSend({ store, model, userText, signal, visiblePairs, boundarySnapshot, onDebugPayload }){
  const settings = getSettings()
  const { userRequestAllowance=100, maxTrimAttempts=10, charsPerToken=3.5 } = settings
  // Baseline (chronological filtered list)
  const baseline = visiblePairs ? visiblePairs.slice() : store.getAllPairs().sort((a,b)=> a.createdAt - b.createdAt)
  const t0 = (typeof performance!=='undefined'? performance.now(): Date.now())
  let predicted = []
  let allowance = userRequestAllowance
  let maxContext
  const timing = { t0, tAfterPrediction:null, attempts:[] }
  if(boundarySnapshot){
    // Use provided predicted boundary (Phase 1 integration)
    predicted = boundarySnapshot.included ? boundarySnapshot.included.slice() : []
    allowance = boundarySnapshot.stats ? (boundarySnapshot.stats.URA ?? userRequestAllowance) : userRequestAllowance
    // Derive maxContext from snapshot if present
    maxContext = boundarySnapshot.stats ? boundarySnapshot.stats.maxContext : getModelBudget(model).maxContext
  } else {
    const budget = getModelBudget(model)
    maxContext = budget.maxContext
    allowance = userRequestAllowance
    const predictedRev=[]
    let historyEstimate=0
    for(let i=baseline.length-1;i>=0;i--){
      const p = baseline[i]
      const tok = estimatePairTokens(p, charsPerToken)
      if(historyEstimate + tok + allowance > maxContext) break
      predictedRev.push(p)
      historyEstimate += tok
    }
    predicted = predictedRev.reverse()
  }
  const userTokens = estimateTokens(userText, charsPerToken)
  timing.tAfterPrediction = (typeof performance!=='undefined'? performance.now(): Date.now())
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
    const attemptHistoryTokens = currentIncluded.reduce((acc,p)=> acc + estimatePairTokens(p, charsPerToken), 0)
    const attemptTotalTokens = attemptHistoryTokens + userTokens
    const predictedHistoryTokens = predicted.reduce((acc,p)=> acc + estimatePairTokens(p, charsPerToken), 0)
    const predictedTotalTokens = predictedHistoryTokens + allowance // conceptual envelope using reserved URA, not actual AUT
    onDebugPayload({
      model,
      budget: { maxContext, maxUsableRaw: maxContext },
      selection: currentIncluded.map(p=> ({ id:p.id, model:p.model, tokens: estimatePairTokens(p,charsPerToken) })),
      predictedMessageCount: predicted.length,
      trimmedCount,
      attemptsUsed,
      AUT: userTokens,
      charsPerToken,
      predictedHistoryTokens,
      predictedTotalTokens,
      attemptHistoryTokens,
      attemptTotalTokens,
      remainingReserve: maxContext - attemptHistoryTokens - userTokens,
      messages: buildMessages({ includedPairs: currentIncluded, newUserText: userText }),
      timing: { ...timing },
      ...extra
    })
  }
  async function attemptSend(){
    const idx = attemptsUsed // current attempt index before increment (0 for first attempt)
    const aStart = (typeof performance!=='undefined'? performance.now(): Date.now())
    timing.attempts.push({ attempt: idx+1, start: aStart, end: null, duration: null, trimmedCount })
    emitDebug()
    const provider = getProvider('openai')
    if(!provider) throw new Error('provider_not_registered')
    const apiKey = getApiKey('openai')
    if(!apiKey) throw new Error('missing_api_key')
    const result = await provider.sendChat({ model, messages: buildMessages({ includedPairs: currentIncluded, newUserText: userText }), apiKey, signal })
    const aEnd = (typeof performance!=='undefined'? performance.now(): Date.now())
    const rec = timing.attempts[timing.attempts.length-1]
    if(rec){
      rec.end = aEnd; rec.duration = aEnd - rec.start
      if(result && result.__timing){
        rec.provider = {
          serialize_ms: result.__timing.tSerializeEnd - result.__timing.tSerializeStart,
          fetch_ms: result.__timing.tFetchEnd - result.__timing.tFetchStart,
          parse_ms: result.__timing.tParseEnd - result.__timing.tParseStart
        }
      }
    }
    emitDebug({ stage: 'attempt_success' })
    return result
  }
  function isOverflowError(e){
    if(!e) return false
    // Provider-specific explicit code
    if(e.providerCode && e.providerCode === 'context_length_exceeded') return true
    const msg = (e.message||'').toLowerCase()
    // Expanded pattern list (doc §7.5) – include variants observed in newer API responses
    const patterns = [
      'context_length',
      'maximum context length',
      'too many tokens',
      'context too long',
      'exceeds context window',
      'request too large',
      'too large for'
    ]
    return patterns.some(s=> msg.includes(s))
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
  err.predictedMessageCount = predicted.length
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
