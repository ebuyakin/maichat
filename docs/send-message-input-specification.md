# Send Message Input Specification

**Date:** 2025-11-16  
**Purpose:** Definitive specification of inputs to the send message routine

---

## Call Chain

```
User presses Enter
  ↓
inputKeys.js: Enter handler
  ↓
sendWorkflow.js: executeSendWorkflow()
  ↓
pipeline.js: executeSend()
  ↓
provider adapter (e.g., geminiAdapter.js)
```

---

## Level 1: executeSendWorkflow() Input

**File:** `src/features/compose/sendWorkflow.js`

**Function signature:**
```javascript
executeSendWorkflow({
  // === USER INPUT (from UI) ===
  text,                 // string - user message text
  topicId,              // string - current topic ID
  model,                // string - selected model ID
  attachments,          // string[] - image IDs attached to new message
  editingId,            // string|null - pair ID if re-asking/editing
  webSearchOverride,    // boolean|undefined - topic-level web search toggle
  beforeIncludedIds,    // Set<string> - pre-send boundary included pair IDs
  
  // === INJECTED DEPENDENCIES (app state/services) ===
  store,                // MemoryStore - message pair storage
  lifecycle,            // Lifecycle - app lifecycle manager
  boundaryMgr,          // BoundaryManager - context boundary manager
  historyRuntime,       // HistoryRuntime - history state manager
  activeParts,          // ActiveParts - active UI parts manager
  scrollController,     // ScrollController - scroll control
  requestDebug,         // RequestDebug - debug overlay manager
  updateSendDisabled,   // Function - update send button state
  getSettings,          // Function - get app settings
  sanitizeDisplayPreservingTokens,  // Function
  escapeHtmlAttr,       // Function
  escapeHtml,           // Function
})
```

### Where These Variables Come From

**User Input (from UI state):**
- `text` ← `textarea` value
- `topicId` ← current topic in view
- `model` ← model selector dropdown
- `attachments` ← image uploader state
- `editingId` ← editing state variable (if re-asking)
- `webSearchOverride` ← topic settings
- `beforeIncludedIds` ← boundary manager state snapshot

**Injected Dependencies:**
- `store` ← global `window.__store` (MessageStore instance)
- `lifecycle` ← global lifecycle manager
- `boundaryMgr` ← global boundary manager
- `historyRuntime` ← global history runtime
- `activeParts` ← global active parts manager
- All others ← imported/injected functions

### What executeSendWorkflow Does

1. Creates empty pair in store
2. Computes image budgets
3. Builds `visiblePairs` from `activeParts`
4. Calls `executeSend()` with filtered data

---

## Level 2: executeSend() Input

**File:** `src/features/compose/pipeline.js`

**Function signature:**
```javascript
executeSend({
  // === REQUIRED ===
  store,                // MemoryStore - for topics/settings lookup
  model,                // string - model ID
  topicId,              // string - topic ID
  userText,             // string - new user message text
  signal,               // AbortSignal - for cancellation
  visiblePairs,         // MessagePair[] - FILTERED pairs (WYSIWYG)
  
  // === OPTIONAL ===
  attachments,          // string[] - image IDs for new user message
  topicWebSearchOverride, // boolean|undefined - web search override
  onDebugPayload,       // Function - debug callback
})
```

### Critical: visiblePairs

**What it is:**
```javascript
// Built in executeSendWorkflow (line ~130)
const currentPairs = activeParts.parts
  .map(pt => store.pairs.get(pt.pairId))
  .filter(Boolean)

const chrono = [...new Set(currentPairs)]
  .sort((a, b) => a.createdAt - b.createdAt)

// chrono is passed as visiblePairs
```

**Key points:**
- `visiblePairs` = pairs currently visible in UI
- Already filtered by user's CLI commands
- Already sorted chronologically
- This is WYSIWYG - what user sees is what gets sent

### What executeSend Does

1. Gets system message from topic
2. Estimates image tokens
3. Calls budget calculation (`predictHistory` + `finalizeHistory`)
4. Builds messages
5. Retries send to provider

---

## Actual Variables at executeSend Entry Point

**When executeSend() is called, these variables exist:**

### From Parameters
```javascript
{
  store: MemoryStore,           // Has .topics, .pairs, .getAllPairs()
  model: string,                // e.g., "gemini-2.0-flash-exp"
  topicId: string,              // e.g., "topic_abc123"
  userText: string,             // e.g., "What is the weather?"
  signal: AbortSignal,          // From AbortController
  visiblePairs: MessagePair[],  // e.g., [pair1, pair2, pair3] (chronological)
  attachments: string[],        // e.g., ["img_xyz"] or []
  topicWebSearchOverride: boolean|undefined,
  onDebugPayload: Function
}
```

### Derived Immediately
```javascript
const settings = getSettings()  // AppSettings object
const baseline = visiblePairs.slice()  // Copy of visible pairs
const topic = store.topics.get(topicId)  // Topic object or null
const topicSystem = topic?.systemMessage?.trim() || ''  // string
```

---

## MessagePair Structure

**What's in each pair:**
```javascript
{
  id: string,                      // "pair_123"
  topicId: string,                 // "topic_abc"
  userText: string,                // User message content
  assistantText: string,           // Assistant response
  userChars: number,               // Character count
  assistantChars: number,          // Character count
  assistantProviderTokens: number, // Provider-reported tokens
  createdAt: number,               // Timestamp
  model: string,                   // Model used
  
  // Image metadata (NEW in S18)
  attachments: string[],           // ["img_1", "img_2"]
  attachmentTokens: number,        // Legacy: sum of all image tokens
  imageBudgets: ImageBudget[],     // Denormalized token costs per provider
}
```

**ImageBudget structure:**
```javascript
{
  id: string,              // "img_1"
  w: number,               // Width in pixels
  h: number,               // Height in pixels
  tokenCost: {             // Precomputed costs per provider
    openai: number,        // e.g., 765
    anthropic: number,     // e.g., 1600
    gemini: number,        // e.g., 258
  }
}
```

---

## Settings Structure

**AppSettings (from getSettings()):**
```javascript
{
  charsPerToken: number,              // e.g., 4
  userRequestAllowance: number,       // URA (e.g., 4000)
  assistantResponseAllowance: number, // ARA (e.g., 4000)
  maxTrimAttempts: number,            // e.g., 10
  requestTimeoutSec: number,          // e.g., 120
  // ... other settings
}
```

---

## Topic Structure

**Topic object:**
```javascript
{
  id: string,              // "topic_abc"
  systemMessage: string,   // System instruction text
  requestParams: {         // Topic-specific overrides
    temperature?: number,
    webSearch?: boolean,
    // ...
  },
  // ... other metadata
}
```

---

## Summary: What Pipeline Actually Receives

### Concrete Example

When user types "Explain quantum physics" with one image attached:

```javascript
executeSend({
  store: <MemoryStore instance>,
  model: "gemini-2.0-flash-exp",
  topicId: "topic_physics_001",
  userText: "Explain quantum physics",
  signal: <AbortSignal instance>,
  visiblePairs: [
    { 
      id: "pair_001", 
      userText: "What is physics?", 
      assistantText: "Physics is...",
      imageBudgets: [],
      // ... metadata
    },
    { 
      id: "pair_002", 
      userText: "Tell me about Einstein", 
      assistantText: "Einstein was...",
      imageBudgets: [{ id: "img_einstein", w: 800, h: 600, tokenCost: {...} }],
      // ... metadata
    }
  ],  // Only pairs user can see (after filtering)
  attachments: ["img_quantum_diagram"],
  topicWebSearchOverride: undefined,
  onDebugPayload: <function>
})
```

**After budget calculation, the function might:**
- Include both pairs (if they fit)
- Include only pair_002 (if tight on space)
- Include neither (if new message + system fills context)

---

## Key Architectural Points

### 1. WYSIWYG Filtering Happens Before Pipeline
```
User filters → activeParts → visiblePairs → executeSend
```
**NOT:**
```
executeSend → filter internally ❌
```

### 2. Store Is Only for Lookup
- Pipeline doesn't iterate `store.getAllPairs()`
- Pipeline receives pre-filtered `visiblePairs`
- Store used only for: topic lookup, settings, image metadata

### 3. New Message Is NOT in visiblePairs
- `visiblePairs` = existing conversation history
- New message passed separately as `userText` + `attachments`
- Pipeline combines them when building request

### 4. Image Data Flow
```
User uploads → imageStore
  ↓
sendWorkflow computes imageBudgets
  ↓
Stores in pair.imageBudgets
  ↓
Pipeline reads from pair.imageBudgets for token estimation
```

---

## What This Means for Budget Calculation

**Input to budget calculation:**
```javascript
{
  visiblePairs: MessagePair[],   // History (filtered, chronological)
  systemText: string,             // From topic
  newUserText: string,            // New message text
  newUserImages: string[],        // New message images (IDs)
  model: string,                  // Model ID
  provider: string,               // Provider ID (from model metadata)
  settings: AppSettings           // URA, ARA, charsPerToken
}
```

**Budget calculation does NOT receive:**
- ❌ All pairs from store (unfiltered)
- ❌ UI state
- ❌ AbortSignal
- ❌ Debug callbacks

**Budget calculation ONLY:**
- ✅ Estimates tokens
- ✅ Selects which pairs fit
- ✅ Returns selection + breakdown

---

## Next Step: Clean Budget Calculator Interface

Now that we know exactly what exists, we can design:

```javascript
function calculateSendBudget({
  visiblePairs,      // MessagePair[] - from executeSend
  systemText,        // string - from topic.systemMessage
  newUserText,       // string - from executeSend.userText
  newUserImages,     // string[] - from executeSend.attachments
  model,             // string - from executeSend.model
  provider,          // string - from getModelMeta(model).provider
  charsPerToken,     // number - from settings
  URA,               // number - from settings.userRequestAllowance
  ARA,               // number - from settings.assistantResponseAllowance
}) {
  // Calculate budget
  // Return: { includedPairs, tokenBreakdown, pairTokenCache }
}
```

All inputs are simple values - no complex dependencies!
