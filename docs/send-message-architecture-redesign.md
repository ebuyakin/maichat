# Send Message Architecture - Clean Design

**Date:** 2025-11-16  
**Status:** Proposal for discussion  
**Purpose:** Clarify conceptual architecture for sending a message to an LLM provider

---

## Input Objects

### User Request
```
┌─────────────────────────────────┐
│ User Submits Message            │
├─────────────────────────────────┤
│ • userText: string              │
│ • attachments: string[]         │  (image IDs)
│ • topicId: string               │
│ • model: string                 │
│ • signal: AbortSignal           │
└─────────────────────────────────┘
```

### View State (WYSIWYG)
```
┌─────────────────────────────────┐
│ Visible Pairs (Filtered)        │
├─────────────────────────────────┤
│ • visiblePairs: MessagePair[]   │  (what user sees after filtering)
│                                 │
│ This is CRITICAL:               │
│ Budget calculation uses ONLY    │
│ what's visible in current view, │
│ respecting user's filters.      │
└─────────────────────────────────┘
```

### Application State
```
┌─────────────────────────────────┐
│ Topic                           │
├─────────────────────────────────┤
│ • id: string                    │
│ • systemMessage: string         │
│ • requestParams: object         │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Image Store                     │
├─────────────────────────────────┤
│ • images: Map<id, Image>        │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ MessagePair                     │
├─────────────────────────────────┤
│ • id: string                    │
│ • userText: string              │
│ • assistantText: string         │
│ • userChars: number             │
│ • assistantChars: number        │
│ • assistantProviderTokens: num  │
│ • imageBudgets: ImageBudget[]   │
│ • createdAt: number             │
│ • model: string                 │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Settings (AppSettings)          │
├─────────────────────────────────┤
│ • charsPerToken: number         │
│ • userRequestAllowance: number  │  (URA)
│ • assistantResponseAllowance    │  (ARA)
│ • maxTrimAttempts: number       │
└─────────────────────────────────┘
```

---

## Conceptual Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    SEND MESSAGE FLOW                         │
└──────────────────────────────────────────────────────────────┘

INPUT
  ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: BUDGET CALCULATION                                 │
│ (Provider-Agnostic)                                         │
├─────────────────────────────────────────────────────────────┤
│ Input:  • Visible pairs (WYSIWYG - respects user filters)  │
│         • Model metadata                                    │
│         • System message                                    │
│         • New user content (text + images)                  │
│         • Settings (URA, ARA, charsPerToken)                │
│                                                             │
│ Process: 1. Estimate tokens for new content                │
│          2. Get model context limit                         │
│          3. Calculate reserves (system, user, assistant)    │
│          4. Calculate available space for history           │
│          5. Select history pairs (newest→oldest)            │
│          6. Cache token counts (ONE calculation per pair)   │
│                                                             │
│ Output: Budget Object                                       │
│         • contextLimit: number                              │
│         • includedPairs: MessagePair[]                      │
│         • pairTokens: Map<id, number>  (cache)             │
│         • breakdown: {                                      │
│             systemTokens,                                   │
│             userTextTokens,                                 │
│             userImageTokens,                                │
│             historyTokens,                                  │
│             totalInputTokens,                               │
│             remainingForResponse                            │
│           }                                                 │
└─────────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: REQUEST BUILDING                                   │
│ (Provider-Agnostic Format)                                  │
├─────────────────────────────────────────────────────────────┤
│ Input:  • Budget (from Phase 1)                            │
│         • System message                                    │
│         • New user content                                  │
│                                                             │
│ Process: 1. Build chronological message array              │
│          2. Attach images to correct messages              │
│          3. Add new user message at end                     │
│                                                             │
│ Output: Universal Request                                   │
│         • model: string                                     │
│         • messages: Message[]                               │
│         • system: string                                    │
│         • options: object                                   │
└─────────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: PROVIDER TRANSLATION                               │
│ (Provider-Specific)                                         │
├─────────────────────────────────────────────────────────────┤
│ Input:  • Universal Request (from Phase 2)                 │
│         • Provider ID                                       │
│                                                             │
│ Process: Transform to provider-specific format             │
│          • OpenAI: messages[] format                        │
│          • Anthropic: messages[] + system param             │
│          • Gemini: contents[] format                        │
│                                                             │
│ Output: Provider Payload                                    │
│         • Provider-specific JSON structure                  │
└─────────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 4: SEND WITH RETRY                                    │
│ (Provider-Specific)                                         │
├─────────────────────────────────────────────────────────────┤
│ Input:  • Provider Payload                                 │
│         • API Key                                           │
│         • Retry settings                                    │
│         • Budget (for debug/telemetry)                      │
│                                                             │
│ Process: Loop (max attempts):                              │
│          1. Debug: Log attempt                              │
│          2. Send HTTP request                               │
│          3. Debug: Log response                             │
│          4. If success → return                             │
│          5. If context overflow:                            │
│             - Remove oldest pair                            │
│             - Rebuild payload                               │
│             - Retry                                         │
│          6. Other errors → throw                            │
│                                                             │
│ Output: Provider Response                                   │
│         • content: string                                   │
│         • usage: object (tokens)                            │
│         • metadata: object                                  │
└─────────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 5: RESPONSE PROCESSING                                │
│ (Provider-Agnostic)                                         │
├─────────────────────────────────────────────────────────────┤
│ Input:  • Provider Response                                │
│         • Original request context                          │
│                                                             │
│ Process: 1. Extract content                                │
│          2. Extract citations/metadata                      │
│          3. Create MessagePair                              │
│          4. Store in MessageStore                           │
│                                                             │
│ Output: MessagePair                                         │
│         • Complete pair with metadata                       │
└─────────────────────────────────────────────────────────────┘
  ↓
COMPLETE
```

---

## Phase Interfaces

### Phase 1 → Phase 2
```
Budget {
  contextLimit: number
  includedPairs: MessagePair[]
  pairTokens: Map<pairId, tokenCount>
  breakdown: {
    systemTokens: number
    userTextTokens: number
    userImageTokens: number
    historyTokens: number
    totalInputTokens: number
    remainingForResponse: number
  }
}
```

### Phase 2 → Phase 3
```
UniversalRequest {
  model: string
  messages: [
    { role: 'user' | 'assistant', content: string, attachments?: string[] }
  ]
  system: string
  options: {
    temperature?: number
    maxOutputTokens?: number
    webSearch?: boolean
  }
}
```

### Phase 3 → Phase 4
```
ProviderPayload {
  // Provider-specific structure
  // OpenAI:    { model, messages, ... }
  // Anthropic: { model, messages, system, ... }
  // Gemini:    { model, contents, systemInstruction, ... }
}
```

### Phase 4 → Phase 5
```
ProviderResponse {
  content: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
  citations?: Array<Citation>
  metadata: object
}
```

---

## Module Responsibilities

### Module: `budgetCalculator.js`
**Location:** `/src/core/context/`  
**Responsibility:** Calculate what fits in context  
**Provider-Agnostic:** ✅ Yes  
**Functions:**
- `calculateSendBudget({ visiblePairs, model, provider, systemText, newUserText, newUserImages, settings })`

**Owns:**
- Token estimation (calls tokenEstimator)
- Context limit calculation
- History selection logic (from VISIBLE pairs only)
- Token caching

**Does NOT:**
- Filter pairs (receives already-filtered visiblePairs)
- Build messages
- Know about provider APIs
- Handle retries

---

### Module: `requestBuilder.js`
**Location:** `/src/features/compose/`  
**Responsibility:** Build universal request format  
**Provider-Agnostic:** ✅ Yes  
**Functions:**
- `buildUniversalRequest({ budget, systemText, newUserText, newUserImages, options })`

**Owns:**
- Message array construction
- Image attachment placement
- Request options

**Does NOT:**
- Calculate tokens
- Know about provider formats
- Send requests

---

### Module: `providerAdapter.js` (per provider)
**Location:** `/src/infrastructure/provider/`  
**Responsibility:** Translate universal → provider-specific  
**Provider-Agnostic:** ❌ Provider-specific  
**Functions:**
- `translateRequest(universalRequest) → providerPayload`
- `sendChat({ payload, apiKey, signal }) → providerResponse`
- `parseResponse(rawResponse) → universalResponse`

**Owns:**
- Provider-specific format
- HTTP request/response
- Provider-specific error handling

**Does NOT:**
- Calculate budgets
- Decide what to send
- Handle retry logic (just throws errors)

---

### Module: `sendWithRetry.js`
**Location:** `/src/features/compose/`  
**Responsibility:** Retry coordination  
**Provider-Agnostic:** ⚠️ Mostly (knows about context overflow)  
**Functions:**
- `sendWithRetry({ universalRequest, provider, budget, maxAttempts })`

**Owns:**
- Retry loop
- Overflow detection
- Request trimming (remove oldest pair)
- Debug logging (attempt, error)

**Does NOT:**
- Calculate tokens
- Build messages
- Parse responses

---

### Module: `executeSend.js` (orchestrator)
**Location:** `/src/features/compose/`  
**Responsibility:** Coordinate entire flow  
**Provider-Agnostic:** ✅ Yes (uses adapters)  
**Functions:**
- `executeSend({ visiblePairs, model, topicId, userText, attachments, signal })`

**Owns:**
- Phase coordination
- Data flow between phases
- Final storage
- Receives visiblePairs from view layer (respects filtering)

**Does NOT:**
- Implement any phase logic
- Filter pairs (receives pre-filtered)
- Just coordinates

---

## Provider-Agnostic vs Provider-Specific Boundary

```
┌──────────────────────────────────────────────────────────┐
│                  PROVIDER-AGNOSTIC                       │
├──────────────────────────────────────────────────────────┤
│ • Budget calculation                                     │
│ • Request building (universal format)                    │
│ • Retry coordination                                     │
│ • Response storage                                       │
└──────────────────────────────────────────────────────────┘
                           ↕ 
        ┌──────────────────────────────────────┐
        │   ADAPTER INTERFACE (boundary)       │
        │   • sendChat(universalRequest)       │
        │   • Returns: universalResponse       │
        └──────────────────────────────────────┘
                           ↕
┌──────────────────────────────────────────────────────────┐
│                  PROVIDER-SPECIFIC                       │
├──────────────────────────────────────────────────────────┤
│ OpenAI Adapter:                                          │
│ • Translate to OpenAI messages format                    │
│ • POST to api.openai.com                                 │
│ • Parse OpenAI response                                  │
│                                                          │
│ Anthropic Adapter:                                       │
│ • Translate to Anthropic format                          │
│ • POST to api.anthropic.com                              │
│ • Parse Anthropic response                               │
│                                                          │
│ Gemini Adapter:                                          │
│ • Translate to Gemini contents format                    │
│ • POST to generativelanguage.googleapis.com             │
│ • Parse Gemini response                                  │
└──────────────────────────────────────────────────────────┘
```

---

## Separation of Concerns

### Budget Calculation
- **What:** Determine what fits in context
- **Why separate:** Pure math, no side effects, highly testable
- **Dependencies:** Token estimator, model metadata
- **No knowledge of:** Providers, HTTP, retries

### Request Building
- **What:** Transform budget → message array
- **Why separate:** Pure transformation, no business logic
- **Dependencies:** Budget output
- **No knowledge of:** Tokens, providers, HTTP

### Provider Adapters
- **What:** Provider-specific translation & communication
- **Why separate:** Isolate provider differences
- **Dependencies:** HTTP client, API keys
- **No knowledge of:** Budget, retry logic, storage

### Retry Coordination
- **What:** Handle overflow, retry attempts
- **Why separate:** Retry logic independent of budget/provider
- **Dependencies:** Provider adapter, budget (for trimming)
- **No knowledge of:** Token estimation, message building

### Orchestration
- **What:** Wire everything together
- **Why separate:** Single place to see entire flow
- **Dependencies:** All phases
- **No knowledge of:** Implementation details of any phase

---

## Data Flow Summary

```
User Input + Visible Pairs (filtered view)
    ↓
[ Budget Calculator ]
    ↓ Budget Object
[ Request Builder ]
    ↓ Universal Request
[ Provider Adapter ] ←→ [ Retry Handler ]
    ↓ Universal Response
[ Response Processor ]
    ↓
Store Updated
```

**Key principle:** 
- Data flows in one direction
- Each phase produces output for next phase
- No backwards dependencies
- **WYSIWYG:** Budget calculation uses only visible pairs (respects user's filters)

---

## Token Calculation Strategy

**Current Problem:** Calculated 4-7× per pair

**Proposed Solution:**

```
Phase 1: Budget Calculation
  │
  ├─→ For each pair:
  │    └─→ tokens = estimatePairTokens(pair)
  │    └─→ pairTokens.set(pair.id, tokens)  ← CACHE
  │
  └─→ Return: { includedPairs, pairTokens, breakdown }

Phase 2-5: Use cached values
  │
  └─→ Need tokens? → pairTokens.get(pair.id)  ← LOOKUP
```

**Result:** 1× calculation per pair, all other phases use cache

---

## Debug/Telemetry Integration

**Where it happens:**

```
Phase 1: Budget Calculation
  └─→ Debug: storeBudgetCalculation(breakdown)

Phase 4: Send with Retry
  ├─→ Before send: storePipelinePresend(request, budget)
  ├─→ Adapter:     storeRequestPayload(payload)
  ├─→ Adapter:     storeFetchResponse(response)
  └─→ On error:    storePipelineError(error)
```

**Principle:** Debug code in phases that own the data, not scattered

---

## Testing Strategy

Each phase is independently testable:

```
Budget Calculator:
  ✓ Given pairs + settings → returns correct selection
  ✓ Given overflow → returns error
  ✓ Token cache is populated correctly

Request Builder:
  ✓ Given budget → builds correct message array
  ✓ Images attached to correct messages
  ✓ New user message at end

Provider Adapter:
  ✓ Translates universal → provider format correctly
  ✓ Handles provider errors correctly
  ✓ Parses response correctly

Retry Handler:
  ✓ Retries on overflow
  ✓ Removes oldest pair correctly
  ✓ Stops at max attempts

Orchestrator:
  ✓ Integration test: full flow works
  ✓ Data passes correctly between phases
```

---

## Migration Path

**Phase-by-phase replacement:**

1. ✅ Extract budget calculation
   - Create `budgetCalculator.js`
   - Replace `predictHistory()` + `finalizeHistory()` calls
   - Verify same pairs selected

2. ✅ Extract request builder
   - Create `requestBuilder.js`
   - Replace `buildMessages()` calls
   - Verify same messages built

3. ✅ Standardize provider adapters
   - Already exist, just standardize interface
   - Ensure they accept universal format

4. ✅ Extract retry handler
   - Create `sendWithRetry.js`
   - Replace retry loop in pipeline
   - Verify same retry behavior

5. ✅ Simplify orchestrator
   - Rewrite `executeSend()` as thin coordinator
   - Remove all business logic

**Each step:**
- Can be tested independently
- Can be rolled back
- Minimal risk

---

## Benefits of This Design

1. **Clear separation:** Each module has one job
2. **Easy to test:** Pure functions, no hidden state
3. **Easy to debug:** Data flow is explicit
4. **Easy to extend:** Add provider = add adapter
5. **Efficient:** Tokens calculated once
6. **Maintainable:** Code matches mental model
7. **Documentable:** Architecture is self-evident

---

## Questions for Discussion

1. Does this conceptual model match what the app actually needs to do?
2. Are there any requirements missing from this flow?
3. Is the phase separation clear and logical?
4. Does the provider-agnostic/specific boundary make sense?
5. Any concerns about the migration path?
