# Send Request Flow Analysis

**Date:** 2025-11-16  
**Purpose:** Document the complete flow of sending a request to understand token calculation duplication

---

## High-Level Flow

```
User submits message
  ↓
sendWorkflow.js: executeSendWorkflow()
  ↓
pipeline.js: executeSend()
  ├─→ Image token estimation (NEW user images)
  ├─→ predictHistory() - find pairs that fit
  ├─→ finalizeHistory() - trim if needed
  ├─→ Retry loop with provider
  │    ├─→ buildMessages() - convert pairs to API format
  │    ├─→ Debug: storePipelinePresend()
  │    └─→ provider.sendChat() (e.g., geminiAdapter)
  │         ├─→ Debug: storeRequestPayload()
  │         ├─→ fetch() to API
  │         └─→ Debug: storeFetchResponse()
  └─→ Success/Error handling
```

---

## Detailed Step-by-Step Flow

### PHASE 1: Initial Setup & Image Token Estimation

**File:** `pipeline.js` → `executeSend()`

**Lines ~110-130:**
```javascript
// 1. Get all pairs from store
const baseline = visiblePairs || store.getAllPairs().sort(...)

// 2. Estimate NEW user image tokens
let imageTokens = 0
for (const id of attachments) {
  const img = await getImage(id)
  imageTokens += estimateImageTokens({ w: img.w, h: img.h }, providerId, model)
}
```

**Calculations:**
- ✅ `imageTokens` - tokens for NEW user images only

---

### PHASE 2: Prediction (Before Knowing User Message)

**File:** `pipeline.js` calls → `budgetMath.js` → `predictHistory()`

**Lines ~145-148:**
```javascript
const pred = predictHistory({
  pairs: baseline,           // ALL pairs (chronological)
  model,
  systemText: topicSystem,
  provider: providerId,
  charsPerToken,
  URA,                       // User Request Allowance
  ARA,                       // Assistant Response Allowance
})
```

**Inside `predictHistory()` (budgetMath.js lines ~40-75):**
```javascript
// Calculate reserves
const systemTokens = estimateTokens(systemText, cpt)
const PARA = provider === 'openai' ? ARA : 0
const C = getModelBudget(model).maxContext
const HLP = C - URA - systemTokens - PARA

// Work backwards to fill HLP
const rev = []
let acc = 0
for (let i = pairs.length - 1; i >= 0; i--) {
  const p = pairs[i]
  const tok = estimatePairTokens(p, cpt)  // 🔴 CALCULATION #1
  if (acc + tok > HLP) break
  rev.push(p)
  acc += tok
}
const predicted = rev.reverse()
```

**Token Calculations:**
- 🔴 **CALC #1:** `estimatePairTokens()` called for EACH pair (newest→oldest until overflow)
- ✅ `systemTokens` - system message tokens
- ✅ `predictedTokenSum` (acc) - total tokens in predicted pairs

**Returns:**
```javascript
{ C, HLP, systemTokens, PARA, predicted, predictedTokenSum }
```

---

### PHASE 3: User Message Token Estimation

**File:** `pipeline.js`

**Lines ~150-151:**
```javascript
const systemTokens = pred.systemTokens
const userTokens = estimateTokens(userText || '', charsPerToken) + imageTokens
```

**Calculations:**
- ✅ `userTokens` - NEW user text + NEW user images

---

### PHASE 4: Finalization (After Knowing User Message)

**File:** `pipeline.js` calls → `budgetMath.js` → `finalizeHistory()`

**Lines ~177-186:**
```javascript
const finalResult = finalizeHistory({
  predicted: working,        // Already trimmed in Stage 2.1
  userText,
  systemTokens,
  C: pred.C,
  PARA: pred.PARA,
  URA,
  charsPerToken,
})
```

**Inside `finalizeHistory()` (budgetMath.js lines ~82-113):**
```javascript
const cpt = charsPerToken ?? settings.charsPerToken ?? 4
const userTokens = estimateTokens(userText || '', cpt)

// Calculate H0 (original predicted history tokens)
const H0 = predicted.reduce((a, p) => a + estimatePairTokens(p, cpt), 0)  // 🔴 CALCULATION #2

const HLA = Math.max(0, C - userTokens - systemTokens - PARA)

// Trim if needed
let included = predicted.slice()
if (H0 > HLA) {
  let total = H0
  while (included.length && total > HLA) {
    const first = included[0]
    total -= estimatePairTokens(first, cpt)  // 🔴 CALCULATION #3
    included.shift()
  }
}

// Calculate H (final included history tokens)
const H = included.reduce((a, p) => a + estimatePairTokens(p, cpt), 0)  // 🔴 CALCULATION #4

const inputTokens = systemTokens + userTokens + H
const R = Math.max(0, C - inputTokens)
```

**Token Calculations:**
- 🔴 **CALC #2:** `estimatePairTokens()` for ALL predicted pairs (to get H0)
- 🔴 **CALC #3:** `estimatePairTokens()` for EACH trimmed pair (during removal)
- 🔴 **CALC #4:** `estimatePairTokens()` for ALL included pairs (to get H)
- ✅ `userTokens` - NEW user text only (no images - calculated separately in pipeline)
- ✅ `inputTokens` - system + user + history (total input)
- ✅ `R` - remaining context for assistant response

**Returns:**
```javascript
{ C, H0, H, HLA, userTokens, inputTokens, remainingContext: R, included }
```

---

### PHASE 5: Build Messages for API

**File:** `pipeline.js` → `buildMessages()`

**Lines ~291-295:**
```javascript
const msgs = buildMessages({ 
  includedPairs: workingProviderPairs, 
  newUserText: userText,
  newUserAttachments: attachments 
})
```

**Process:**
- Iterates through `includedPairs`
- For each pair: creates user message + assistant message
- Attaches image IDs to correct messages
- Appends new user message at end

**NO token calculations** - just message formatting

---

### PHASE 6: Debug Emit (Preflight)

**File:** `pipeline.js`

**Lines ~228-241:**
```javascript
emitDebug({
  ...baseDebugCore(),
  status: 'preflight',
  selection: includedPairs.map((p) => ({
    id: p.id,
    model: p.model,
    tokens: estimatePairTokens(p, charsPerToken),  // 🔴 CALCULATION #5
  })),
  messages: topicSystem ? [{ role: 'system', content: topicSystem }, ...baseMessages] : baseMessages,
})
```

**Token Calculations:**
- 🔴 **CALC #5:** `estimatePairTokens()` for ALL included pairs (for debug display)

---

### PHASE 7: Retry Loop with Provider

**File:** `pipeline.js` (loop starts ~289)**

Each attempt:

#### 7.1 Rebuild Messages
```javascript
const msgs = buildMessages({ 
  includedPairs: workingProviderPairs, 
  newUserText: userText,
  newUserAttachments: attachments 
})
```

#### 7.2 Debug Emit (Attempt)
**Lines ~298-311:**
```javascript
emitDebug({
  ...baseDebugCore(),
  status: 'attempt',
  attemptNumber: attemptsUsed,
  selection: workingProviderPairs.map((p) => ({
    id: p.id,
    model: p.model,
    tokens: estimatePairTokens(p, charsPerToken),  // 🔴 CALCULATION #6 (per attempt)
  })),
  messages: topicSystem ? [{ role: 'system', content: topicSystem }, ...msgs] : msgs,
})
```

**Token Calculations:**
- 🔴 **CALC #6:** `estimatePairTokens()` for ALL working pairs (EVERY retry attempt)

#### 7.3 Pipeline Debug Storage
**Lines ~315-325:**
```javascript
storePipelinePresend(
  providerId, 
  model, 
  topicSystem, 
  msgs, 
  systemTokens,
  userTokens,
  imageTokens
)
```

**Inside `storePipelinePresend()` (apiDebug.js):**
```javascript
// Count images per message
let totalImages = 0
const messagesWithImages = []
for (let i = 0; i < messages.length; i++) {
  const m = messages[i]
  const imageCount = Array.isArray(m.attachments) ? m.attachments.length : 0
  if (imageCount > 0) {
    totalImages += imageCount
    messagesWithImages.push({ index: i, role: m.role, imageCount, imageIds: m.attachments })
  }
}
```

**NO token calculations** - uses tokens passed from pipeline

#### 7.4 Provider API Call
**File:** `geminiAdapter.js` → `sendChat()`

```javascript
// Build payload (converts messages to provider format)
const contents = []
for (const msg of messages) {
  // ... format conversion
}

// Debug: store request
storeRequestPayload('gemini', model, body)

// Fetch
resp = await fetch(...)

// Debug: store response
storeFetchResponse(resp, 'gemini', parsedBody)
```

**NO token calculations** - just API interaction

---

## Duplication Summary

### Token Calculation Counts (Per Send Request)

**For a single pair in the included set:**

1. **predictHistory():** 1 call to `estimatePairTokens()` ✅
2. **finalizeHistory() - H0 calc:** 1 call to `estimatePairTokens()` 🔴
3. **finalizeHistory() - H calc:** 1 call to `estimatePairTokens()` 🔴
4. **Debug preflight:** 1 call to `estimatePairTokens()` 🔴
5. **Debug attempt (per retry):** 1 call to `estimatePairTokens()` 🔴 × retry count

**Total:** 4-7+ calls per pair (depending on retries and trimming)

### What's Calculated Where

| What | Where | How Many Times | Notes |
|------|-------|----------------|-------|
| NEW user image tokens | pipeline.js | 1 | ✅ Calculated once |
| System tokens | predictHistory() | 1 | ✅ Cached in `pred.systemTokens` |
| NEW user text tokens | finalizeHistory() + pipeline | 2 | 🟡 Calculated twice |
| Pair tokens (each pair) | Multiple places | 4-7+ | 🔴 MAJOR duplication |
| History total (H0, H) | finalizeHistory() | 2-3 | 🔴 Sum recalculated |

---

## Problems Identified

### 1. `estimatePairTokens()` Called Repeatedly
**Why it's expensive:**
- Iterates through pair's `imageBudgets` array
- Looks up provider-specific token costs
- Sums text + image tokens

**Called for each pair:**
- predictHistory: 1×
- finalizeHistory (H0): 1×
- finalizeHistory (H): 1×
- Debug preflight: 1×
- Debug attempt: 1× per retry

### 2. History Token Sum Recalculated
- H0 in `finalizeHistory()`
- H in `finalizeHistory()`
- Already have `predictedTokenSum` from `predictHistory()`

### 3. No Caching Between Steps
- Each function recalculates from scratch
- Results discarded after each step

### 4. Debug Functions Re-iterate
- `emitDebug()` maps over pairs to add tokens
- Could pass pre-calculated tokens

---

## Potential Solutions

### Option 1: Cache on Pairs (Mutable)
```javascript
// In predictHistory or executeSend start
for (const p of pairs) {
  if (!p._cachedTokens) {
    p._cachedTokens = estimatePairTokens(p, charsPerToken, providerId)
  }
}
```
**Pros:** Simple, works everywhere  
**Cons:** Mutates pair objects, cache invalidation issues

### Option 2: Token Map (Pure)
```javascript
// Calculate once in executeSend
const tokenMap = new Map()
for (const p of baseline) {
  tokenMap.set(p.id, estimatePairTokens(p, charsPerToken, providerId))
}
// Pass tokenMap through all functions
```
**Pros:** Pure, explicit  
**Cons:** Need to thread through all functions

### Option 3: Return Enriched Data
```javascript
// predictHistory returns pairs with tokens
return { 
  predicted: predicted.map(p => ({ 
    pair: p, 
    tokens: estimatePairTokens(p, cpt, provider) 
  })),
  predictedTokenSum: acc 
}
```
**Pros:** Clean API, no mutations  
**Cons:** Requires changes to all consumers

### Option 4: Memoization
```javascript
// In tokenEstimator.js
const pairTokenCache = new Map()
export function estimatePairTokens(pair, charsPerToken, providerId) {
  const key = `${pair.id}-${charsPerToken}-${providerId}`
  if (pairTokenCache.has(key)) return pairTokenCache.get(key)
  // ... calculation
  pairTokenCache.set(key, result)
  return result
}
```
**Pros:** Transparent, works everywhere  
**Cons:** Memory management, cache invalidation

### Option 5: Pre-calculate & Return Breakdown
```javascript
// predictHistory calculates all tokens upfront
const pairTokens = pairs.map(p => estimatePairTokens(p, cpt, provider))
// Work backwards using pre-calculated tokens
// Return tokens along with pairs
```
**Pros:** Single pass, clear intent  
**Cons:** Memory for large histories

---

## Recommendations

**Short-term (Quick Win):**
1. **Memoization** in `estimatePairTokens()` with request-scoped cache
2. **Pass token totals** from budgetMath to pipeline (avoid recalculating H)

**Medium-term (Refactor):**
1. **Calculate tokens once** at start of `executeSend()`
2. **Pass token map** through pipeline and budgetMath
3. **Return enriched data** from budgetMath with tokens attached

**Long-term (Architecture):**
1. **Budget calculation module** that owns all token math
2. **Single source of truth** for "what tokens are we using"
3. **Immutable data structures** with tokens as properties

---

## Next Steps

1. ✅ Document current flow (this document)
2. ⏳ Decide on approach
3. ⏳ Implement changes
4. ⏳ Update tests
5. ⏳ Verify no behavior changes
