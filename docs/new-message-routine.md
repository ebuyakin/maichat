# new message routine dev notes

## Development Strategy

1. We don't touch existing infrastructure including Enter handler (in inputKeys.js) until we designed and tested the new routine in full. The app works and the current Enter handler is the critical component of it, do not touch it. 
2. We are creating the new routine in parallel. It is triggered by a different key (Ctrl-G). 
3. For a while we can use both old and new routines. The old is triggered by Enter, the new by Ctrl-G. 
4. When we finish the new, polish it, we wire it to Enter instead of Ctrl-G.

---

## Complete Flow Structure

### **Phase 0: Initialize Pair**

**Purpose:** Create or identify the message pair before any async operations

**True New Message:**
1. Create new pair with `userText + attachments`, empty `assistantText`
2. Set `lifecycleState: 'sending'`
3. Store pair ID for phases 1-5
4. **UI:** Render new user message, show "AI is thinking..." badge
5. Clear input fields (done by Ctrl+G handler)

**Re-ask (Second Opinion):**
1. Identify editing pair from `editingPairId` or last visible pair
2. Extract `userText + attachments` from editing pair
3. Store old assistant response in temporary holding
4. Set editing pair `lifecycleState: 'sending'`
5. **UI:** Show "AI is thinking..." badge (no new message, re-use existing)
6. **Don't** clear input fields

**Implementation:**
```javascript
function initializePair({ userText, imageIds, topicId, model, store, editingPairId }) {
  let pairId
  let isReask = false
  let previousResponse = null
  
  if (editingPairId) {
    // Re-ask flow
    isReask = true
    pairId = editingPairId
    const pair = store.pairs.get(pairId)
    
    // Preserve old response
    previousResponse = {
      assistantText: pair.assistantText,
      model: pair.model,
      assistantProviderTokens: pair.assistantProviderTokens,
      responseMs: pair.responseMs,
    }
    
    // Update to sending state
    store.updatePair(pairId, {
      lifecycleState: 'sending',
      errorMessage: undefined,
    })
  } else {
    // New message flow
    pairId = store.addMessagePair({
      topicId,
      model,
      userText,
      assistantText: '',
    })
    
    // Add attachments and set state
    store.updatePair(pairId, {
      attachments: imageIds,
      lifecycleState: 'sending',
    })
  }
  
  return { pairId, isReask, previousResponse }
}
```

---

### **Phase 1: Prepare Input Data**

**Purpose:** Gather all data needed for the request

**Inputs:**
- `userText`, `imageIds` (from Phase 0 or editing pair)
- `topicId`, `model`
- `store`

**Outputs:**
```javascript
{
  systemMessage: string,
  contextPairs: Array<Pair>,  // History pairs in order
}
```

**Implementation:** Use existing `prepareInputData.js`

---

### **Phase 2: Select Context Pairs**

**Purpose:** Determine which history fits in budget

**Inputs:**
- `contextPairs` from Phase 1
- `systemMessage`, `userText`, `imageIds`
- `model`, `provider`, `settings`
- Token estimators

**Outputs:**
```javascript
{
  selectedPairs: Array<Pair>,  // Pairs that fit
  historyAllowance: number,
}
```

**Implementation:** Use existing `selectContextPairs.js`

---

### **Phase 3: Encode Images**

**Purpose:** Convert image IDs to base64 data

**Inputs:**
- `selectedPairs` (with `attachments` arrays)
- `imageIds` for new user message
- `getImageMetadata` function

**Outputs:**
```javascript
{
  request: {
    system: string,
    messages: Array<{
      role: 'user' | 'assistant',
      content: string,
      images?: Array<{ mime: string, data: string }>
    }>
  }
}
```

**Implementation:** Use existing `encodeImages.js`

---

### **Phase 4: Send with Retry**

**Purpose:** Send to provider, retry on context overflow

**Inputs:**
- `request` from Phase 3
- `provider`, `model`, `apiKey`
- `options` (temperature, webSearch)
- `signal` (AbortController)

**Outputs:**
```javascript
{
  content: string,
  tokenUsage: { promptTokens, completionTokens, totalTokens },
  responseMs: number,
}
```

**Error handling:**
- `exceededUsageLimit` → Trim oldest pair, retry (up to maxRetries)
- Other errors → Throw immediately

**Implementation:** Use existing `sendWithRetry.js`

---

### **Phase 5: Update Pair**

**Purpose:** Store the result (success or error)

**Success:**
```javascript
store.updatePair(pairId, {
  assistantText: response.content,
  assistantChars: response.content.length,
  assistantProviderTokens: response.tokenUsage?.completionTokens,
  responseMs: response.responseMs,
  lifecycleState: 'complete',
  errorMessage: undefined,
})

// If re-ask: store previous response
if (isReask && previousResponse) {
  store.updatePair(pairId, {
    previousAssistantText: previousResponse.assistantText,
    previousModel: previousResponse.model,
    replacedAt: Date.now(),
    replacedBy: model,
  })
}
```

**Error:**
```javascript
store.updatePair(pairId, {
  assistantText: '',  // Empty on error
  lifecycleState: 'error',
  errorMessage: error.message || String(error),
})
```

**UI Updates:**
- Re-render history
- Activate new/updated message
- Scroll to show assistant response
- Clear "AI is thinking..." badge
- Update message counter

---

## Main Function Signature

```javascript
/**
 * Send new message or re-ask with new model
 * 
 * @param {Object} params
 * @param {string} params.userText - User message text
 * @param {string[]} params.imageIds - Attached image IDs
 * @param {string} params.topicId - Topic ID
 * @param {string} params.model - Model ID
 * @param {string[]} params.visiblePairIds - Currently visible pair IDs
 * @param {string|null} params.activePartId - Currently active part ID
 * @param {string|null} params.editingPairId - If re-asking, original pair ID
 * @param {boolean} [params.webSearchOverride] - Override model's webSearch setting
 * 
 * @param {Object} params.store - Message store
 * @param {Object} params.lifecycle - Lifecycle manager
 * @param {Object} params.boundaryMgr - Boundary manager
 * @param {Object} params.historyRuntime - History runtime
 * @param {Object} params.activeParts - Active parts manager
 * @param {Object} params.scrollController - Scroll controller
 * 
 * @returns {Promise<string>} Created/updated pair ID
 */
export async function sendNewMessage({ ... }) {
  // Phase 0: Initialize pair
  // Phase 1: Prepare input data
  // Phase 2: Select context pairs
  // Phase 3: Encode images
  // Phase 4: Send with retry
  // Phase 5: Update pair
}
```

---

## Error Handling Strategy

**All errors are caught and stored in the pair:**

```javascript
try {
  // Phases 1-4
} catch (error) {
  // Always update pair with error
  store.updatePair(pairId, {
    assistantText: '',
    lifecycleState: 'error',
    errorMessage: formatError(error),
  })
  
  // UI updates (same as success)
  renderAndActivate()
  
  // Don't rethrow - error is now visible in UI
}
```

**Error message formatting:**
```javascript
function formatError(error) {
  if (error instanceof AdapterError) {
    return `${error.code}: ${error.message}`
  }
  return error.message || String(error)
}
```

---

## UI Update Sequence

**After Phase 5 (success or error):**

1. **Re-render history:** `historyRuntime.renderCurrentView({ preserveActive: false })`
2. **Activate message:**
   - New message: Find and activate last user part of new pair
   - Re-ask: Keep current active message (already correct)
3. **Scroll:** `scrollController.scrollToBottom(false)` or align to active
4. **Clear badge:** `lifecycle.completeSend()`
5. **Update counter:** `updateSendDisabled()`

---

## Dependencies Injection

All external dependencies passed as parameters (no imports of runtime/UI):

```javascript
{
  // Data
  store,
  
  // State managers
  lifecycle,
  boundaryMgr,
  historyRuntime,
  activeParts,
  scrollController,
  
  // Functions
  getImageMetadata,
  estimateTextTokens,
  estimateImageTokens,
  getModelBudget,
  getApiKey,
  
  // Settings
  settings,
}
```

---

## Testing Strategy

1. **Ctrl+G triggers new routine** (parallel to Enter)
2. **Test cases:**
   - True new message (text only)
   - True new message (with images)
   - Re-ask (change model)
   - Network error
   - Context overflow (retry)
   - Invalid API key
3. **Verify UI updates** after each scenario
4. **Once stable:** Wire to Enter key
