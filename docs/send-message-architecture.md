# Send Message Architecture

## Module Responsibilities

### **1. inputKeys.js** (User Input Handler)
**Role:** Entry point for user interactions

**Responsibilities:**
- Listen for Enter key press
- Validate input (non-empty text)
- Check if send is already in progress
- Capture input context (topic, model, attachments)
- Clear input field immediately (UX responsiveness)
- Orchestrate the send process
- Handle post-send UI updates (focus, scroll)

**Key Actions:**
- Calls `lifecycle.beginSend()` to set "sending" flag
- Calls `executeSendWorkflow()` to start the send process
- Renders view after workflow completes
- Focuses and scrolls to user message

**Does NOT:**
- Create message pairs (delegates to sendWorkflow)
- Make API calls (delegates to pipeline)
- Handle errors directly (delegates to sendWorkflow)

---

### **2. newMessageLifecycle.js** (Send State Manager)
**Role:** Manage global send state and new message UX behavior

**Responsibilities:**
- Track if a send is in progress (`pendingSend` flag)
- Prevent multiple simultaneous sends
- Handle new assistant reply focus/scroll behavior
- Determine if pair is visible in current filter
- Manage mode switching (INPUT ↔ VIEW) based on message fit

**Key State:**
- `pendingSend` - Boolean flag (is send in progress?)
- `lastReplyPairId` - ID of most recent assistant reply

**Key Functions:**
- `beginSend()` - Set `pendingSend = true`
- `completeSend()` - Set `pendingSend = false`
- `handleNewAssistantReply(id)` - Complex focus/scroll logic for new messages
  - Checks if pair is visible in filter
  - Measures message height vs viewport
  - Switches to VIEW mode if message doesn't fit
  - Scrolls to show message
  - Activates assistant message part

**Does NOT:**
- Create or update pairs
- Make API calls
- Render the history view

---

### **3. sendWorkflow.js** (Send Orchestration)
**Role:** Coordinate the complete message send workflow

**Responsibilities:**
- Create message pair in store (with user text)
- Start async send process (fire-and-forget IIFE)
- Compute image budgets
- Call pipeline to execute send
- Process response (extract code, equations, sanitize)
- Update pair with response or error
- Call lifecycle hooks
- Render view on completion/error
- Handle trim notifications

**Key Flow:**
```
1. Create pair (idle state)
2. Return id immediately (for UX)
3. Async IIFE:
   a. Compute image budgets
   b. Call executeSend (pipeline)
   c. Process response
   d. Update pair (complete/error state)
   e. Render view
   f. Call lifecycle.handleNewAssistantReply (success only!)
```

**Critical Issue:**
- Returns `id` immediately (before async work completes)
- Async work happens in fire-and-forget IIFE
- Success path: renders + calls `lifecycle.handleNewAssistantReply(id)`
- Error path: renders but **DOES NOT call** `lifecycle.handleNewAssistantReply(id)`

**Does NOT:**
- Handle user input
- Know about filters or active parts (receives as dependencies)
- Make direct API calls (delegates to pipeline)

---

### **4. pipeline.js** (Provider Abstraction)
**Role:** Abstract away provider-specific details and handle retries

**Responsibilities:**
- Select appropriate provider adapter based on model
- Build context (select messages within boundary)
- Handle context overflow (retry with fewer messages)
- Convert message format to provider-specific format
- Call provider adapter
- Handle provider errors
- Emit debug payloads
- Return standardized response

**Key Features:**
- Context boundary management
- Automatic retry on context overflow
- Provider-agnostic error handling
- Debug instrumentation

**Does NOT:**
- Create or update pairs (caller's responsibility)
- Render UI
- Manage lifecycle state
- Process response content (returns raw)

---

### **5. Adapter (e.g., geminiAdapter.js)** (Provider Interface)
**Role:** Provider-specific API communication

**Responsibilities:**
- Convert universal message format to provider format
- Encode images to base64 (if needed)
- Make HTTP request to provider API
- Handle provider-specific errors
- Extract response content
- Extract citations/metadata (if available)
- Return standardized response

**Error Handling:**
- Catch network errors → throw ProviderError('network error')
- Catch HTTP errors → throw ProviderError with status/message
- Log debug information to localStorage

**Does NOT:**
- Know about pairs or store
- Render UI
- Retry logic (pipeline handles retries)

---

## Data Flow Diagram

```
User presses Enter
       ↓
┌──────────────────┐
│  inputKeys.js    │
│                  │
│  1. beginSend()  │──→ lifecycle.pendingSend = true
│  2. Clear input  │
│  3. Call:        │
│     executeSend  │
│     Workflow()   │
└────────┬─────────┘
         ↓
┌────────────────────────────┐
│  sendWorkflow.js           │
│                            │
│  1. Create pair (idle)     │──→ store.addMessagePair()
│  2. Return id IMMEDIATELY  │──→ back to inputKeys
│  3. Start async IIFE:      │
│     ├─ Compute budgets     │
│     ├─ Call executeSend    │──→ pipeline.js
│     ├─ Process response    │
│     ├─ Update pair         │
│     ├─ Render view         │
│     └─ handleNewReply (?)  │
└────────────────────────────┘
         ↓
┌────────────────────┐
│  pipeline.js       │
│                    │
│  1. Select adapter │
│  2. Build context  │
│  3. Call adapter   │──→ geminiAdapter.js
│  4. Handle retries │
│  5. Return result  │
└──────────┬─────────┘
           ↓
┌──────────────────────┐
│  geminiAdapter.js    │
│                      │
│  1. Format request   │
│  2. HTTP fetch       │──→ Gemini API
│  3. Parse response   │
│  4. Return content   │
└──────────────────────┘
```

---

## Execution Timeline (Success)

```
Time    inputKeys         sendWorkflow       pipeline/adapter    DOM/UI
────────────────────────────────────────────────────────────────────────
T0      Enter pressed
        beginSend()                                              "AI thinking..."
        
T1                        Create pair
                          (idle state)
                          
T2                        Return id ──→
        
T3      Render view                                             User msg appears
        Focus/scroll
        
T4                        Start async
                          IIFE
                          
T5                                           Call adapter
                                             HTTP request ──→    Network...
                                             
T6                                                               (waiting...)
                                             ←── 200 OK
                                             Parse response
                                             
T7                        Process response
                          Update pair
                          (complete state)
                          
T8                        Render view                           Assistant msg appears
                          handleNewReply()                      Scroll/focus
```

---

## Execution Timeline (Error - Current Bug)

```
Time    inputKeys         sendWorkflow       pipeline/adapter    DOM/UI
────────────────────────────────────────────────────────────────────────
T0      Enter pressed
        beginSend()                                              "AI thinking..."
        
T1                        Create pair
                          (idle state)
                          
T2                        Return id ──→
        
T3      Render view                                             User msg appears
        Focus/scroll
        
T4                        Start async
                          IIFE
                          
T5                                           Call adapter
                                             HTTP request ──→    Network...
                                             
T6                                                               (waiting...)
                                             ←── 503 Error
                                             Throw error
                                             
T7                        Catch error
                          Update pair
                          (error state)
                          
T8                        Render view                           ??? NOT APPEARING
                          (NO handleNewReply!)                  
                          
T9      (Later...)                                              Manual filter change
                                                                 ✓ Error appears!
```

---

## The Bug

**Hypothesis:** The error path renders the view but the assistant error message doesn't appear until a manual re-render.

**Key Difference:** Success path calls `lifecycle.handleNewAssistantReply(id)` but error path does not.

**What handleNewAssistantReply does:**
1. Checks if pair is visible in filter
2. Measures message vs viewport
3. Switches mode if needed
4. Activates message part
5. Scrolls to show message

**Possible causes:**
1. Error message not being rendered to DOM at all (filter issue?)
2. Error message rendered but not visible (scroll issue?)
3. Error message rendered but not in active parts (focus issue?)
4. Timing issue (render happens before pair state propagates?)

---

## Questions to Answer

1. **Does the error catch block run for BOTH error types?**
   - Network error: YES (we see error badge)
   - 503 error: UNKNOWN (need to verify)
   
2. **Does the render call happen (line 276)?**
   - Network error: YES (error appears)
   - 503 error: UNKNOWN
   
3. **Does the inline scroll/focus logic run (lines 278-298)?**
   - Queries for assistant element
   - Activates it
   - Scrolls to show it
   - Network error: Presumably YES (it works)
   - 503 error: UNKNOWN (maybe returns early?)

4. **Key difference to investigate:**
   - Both errors throw ProviderError
   - Both reach same catch block
   - BUT: 503 error happens AFTER parsing response body
   - Network error happens BEFORE any response
   - **Timing difference?** Does the render happen at different times relative to other code?

5. **Is there a race condition?**
   - Does inputKeys render happen AFTER error render for network but BEFORE for 503?
   - Is the assistant element queried (line 281) before or after it's rendered?

---

## Hypothesis

The inline error handling code (lines 278-298) works for network errors but fails for HTTP errors (503).

**Possible reasons:**
1. **Timing:** The querySelector (line 281) runs before the element is in DOM
2. **requestAnimationFrame:** Scroll happens asynchronously, might be racing
3. **Element doesn't exist yet:** Render at line 276 is async or doesn't complete immediately

**Test:** Add logging to see:
- Does querySelector find the element?
- What's the timing between render and querySelector?
- Is there a difference between network error and 503 error paths?

---

## Next Steps

1. **Add minimal debug logging to error catch block:**
   ```javascript
   console.log('[ERROR] Pair state:', store.pairs.get(id))
   console.log('[ERROR] About to render')
   historyRuntime.renderCurrentView({ preserveActive: true })
   console.log('[ERROR] Render complete')
   console.log('[ERROR] Querying for assistant element...')
   const assistantEls = pane?.querySelectorAll(...)
   console.log('[ERROR] Found elements:', assistantEls?.length)
   ```

2. **Compare logs for:**
   - Network error (works)
   - 503 error (broken)

3. **If querySelector finds element:**
   - Problem is in activation/scroll logic

4. **If querySelector doesn't find element:**
   - Problem is render not completing or element filtered out
   - Check if there's a difference in how renderCurrentView handles different error types

5. **If timing is issue:**
   - Consider wrapping in requestAnimationFrame or setTimeout
   - Or call lifecycle.handleNewAssistantReply(id) like success path does
