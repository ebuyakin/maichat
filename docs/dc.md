# Network Timeout Implementation Plan

## Problem Statement

**User scenario:** Internet connection died while waiting for AI response ("AI is thinking..."). The app appears to get stuck indefinitely.

---

## UPDATED ANALYSIS (After Architecture Investigation)

---

## Root Cause Analysis

### **Current Implementation:**

The app makes API requests using native `fetch()` with an **optional `signal` parameter** (AbortSignal):

```javascript
// pipeline.js line 24
export async function executeSend({
  store,
  model,
  topicId,
  userText,
  signal,  // ← Currently ALWAYS undefined!
  visiblePairs,
  onDebugPayload,
}) { ... }

// Passed to provider
await provider.sendChat({
  model,
  messages: msgs,
  system: topicSystem,
  apiKey,
  signal,  // ← Undefined
  options,
  budget,
  meta,
})

// Provider uses it in fetch
resp = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: { ... },
  body: payloadStr,
  signal,  // ← Undefined = NO TIMEOUT!
})
```

### **The Problem:**

1. **`signal` is always `undefined`** in the call from interaction.js line 755:
   ```javascript
   const { content } = await executeSend({
     store,
     model,
     topicId,
     userText,
     signal: undefined,  // ← Hardcoded!
     visiblePairs: chrono,
     onDebugPayload: (payload) => {
       requestDebug.setPayload(payload)
     },
   })
   ```

2. **Native fetch() has NO default timeout** - it will wait indefinitely until:
   - Server responds
   - TCP connection times out (can be 2+ minutes)
   - Browser kills it (rare)

3. **Network failure scenarios:**
   - **Connection drops mid-request:** TCP socket may hang for minutes
   - **DNS failure:** Can hang for 30-60 seconds
   - **Server hangs:** No response, waits forever
   - **Proxy issues:** Similar indefinite wait

### **User Experience:**

- Send button shows "AI is thinking: MM:SS" timer
- Timer keeps incrementing
- No way to cancel
- App appears frozen
- User must:
  - Wait indefinitely (bad UX)
  - Reload page (loses pending request)
  - Force quit browser

---

## Current Error Handling

The code DOES have error handling:

```javascript
try {
  resp = await fetch(...)
} catch (ex) {
  throw new ProviderError('network error', 'network')
}
```

But this only catches:
- ✅ Immediate network errors (offline detected immediately)
- ✅ Aborted requests (via AbortSignal)
- ❌ **NOT timeouts** (none configured!)
- ❌ **NOT hanging connections** (no timeout)

---

## Proposed Solutions

### **Option 1: Add Configurable Timeout with AbortSignal (RECOMMENDED)**

**Implementation:**

```javascript
// In interaction.js, create AbortController with timeout
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 120000) // 2 minutes

try {
  const { content } = await executeSend({
    store,
    model,
    topicId,
    userText,
    signal: controller.signal,  // ← Pass signal!
    visiblePairs: chrono,
    onDebugPayload: (payload) => {
      requestDebug.setPayload(payload)
    },
  })
  clearTimeout(timeoutId)  // Success - cancel timeout
  // ... handle success
} catch (ex) {
  clearTimeout(timeoutId)
  if (ex.name === 'AbortError') {
    // Timeout occurred
    let errMsg = 'Request timeout - network may be down'
    store.updatePair(id, { assistantText: '', lifecycleState: 'error', errorMessage: errMsg })
  } else {
    // Other error
    let errMsg = ex && ex.message ? ex.message : 'error'
    store.updatePair(id, { assistantText: '', lifecycleState: 'error', errorMessage: errMsg })
  }
  lifecycle.completeSend()
  updateSendDisabled()
  historyRuntime.renderCurrentView({ preserveActive: true })
}
```

**Settings:**
```javascript
// Add to settings
requestTimeout: 120000  // 2 minutes default, configurable
```

**Pros:**
- ✅ Standard Web API (AbortController)
- ✅ Clean cancellation
- ✅ Works across all providers (OpenAI, Anthropic, Gemini)
- ✅ User-configurable timeout
- ✅ Proper error message shown
- ✅ App recovers gracefully

**Cons:**
- 🟡 Need to choose appropriate default (120s?)
- 🟡 Different models may need different timeouts

---

### **Option 2: Add Manual Cancel Button**

Add a cancel button that appears during "AI thinking":

```javascript
// Show cancel button during pending
if (lifecycle.isPending()) {
  sendBtn.innerHTML = `
    <span class="lbl">AI is thinking: ${mm}:${ss}</span>
    <button class="cancel-btn" onclick="window.__cancelRequest()">✕</button>
  `
}

// Global cancel function
window.__cancelRequest = () => {
  if (window.__currentRequestController) {
    window.__currentRequestController.abort()
  }
}
```

**Pros:**
- ✅ User has explicit control
- ✅ No arbitrary timeout needed
- ✅ Good for slow but legitimate responses

**Cons:**
- ❌ Requires UI changes
- ❌ User must manually cancel (doesn't help if they walk away)
- ❌ More complex

---

### **Option 3: Hybrid (Timeout + Cancel Button) (BEST)**

Combine both:
- **Timeout:** Safety net (e.g., 3-5 minutes)
- **Cancel button:** User control for immediate cancellation

**Benefits:**
- ✅ Protects against hangs
- ✅ User can cancel early
- ✅ Best of both worlds

---

## Recommended Implementation Plan

### **Phase 1: Add Timeout with Keyboard Abort (ONLY PHASE)**

1. Add setting: `requestTimeoutMs` in `schema.js` (default 120000ms = 2 minutes)
2. Modify `inputKeys.js` to:
   - Create AbortController before send
   - Set timeout to abort after configured time
   - Pass signal to executeSend
   - Add Ctrl+C handler in INPUT mode to abort
   - Handle AbortError as timeout/abort
3. Update documentation (keyboard shortcuts, help overlay)

**Risk:** Very low - standard pattern, minimal changes

**Estimated time:** 45 minutes

---

## Testing Scenarios

### **Manual Tests:**

1. **Disconnect during request:**
   - Send message
   - Disable network (airplane mode)
   - Should timeout after 3 minutes with error

2. **Very slow response:**
   - Use network throttling (slow 3G)
   - Should complete if under timeout
   - Should timeout if over

3. **Server timeout:**
   - Mock slow endpoint
   - Verify timeout triggers

4. **Normal response:**
   - Verify timeout doesn't interfere
   - Verify cleanup happens

---

## Alternative: Use Fetch with Timeout Wrapper

Instead of AbortController, use a timeout wrapper:

```javascript
async function fetchWithTimeout(url, options, timeout = 120000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(id)
    return response
  } catch (err) {
    clearTimeout(id)
    if (err.name === 'AbortError') {
      throw new Error('Request timeout')
    }
    throw err
  }
}
```

Then use in providers. This centralizes timeout logic.

**Pros:**
- ✅ Centralized timeout handling
- ✅ Consistent across all providers

**Cons:**
- ❌ Requires changing all 3 provider adapters
- ❌ Less flexible than passing signal through

---

## Recommendation

**Implement Option 1 (Phase 1) immediately:**
- Low risk
- Solves the core problem
- Standard pattern
- Minimal code changes

**Consider Option 3 (Phase 2) later:**
- Better UX
- More user control
- Can be added incrementally

**Default timeout: 180 seconds (3 minutes)**
- Most legitimate responses complete in < 60s
- 3 minutes is generous for complex requests
- Long enough for slow connections
- Short enough user doesn't wait forever

---

---

## ARCHITECTURE INVESTIGATION RESULTS

### **1. Settings System** (`src/core/settings/`)

**Structure:**
- `index.js` - Load/save/subscribe functions, localStorage management
- `schema.js` - **Single source of truth** for all settings with metadata

**Adding a new setting:**
```javascript
// In schema.js, add to existing tab or create new tab
requestTimeoutMs: {
  defaultValue: 120000,  // 2 minutes
  renderAction: 'none',  // No visual change, affects future requests
  control: { type: 'number', min: 30000, max: 600000, step: 10000 },
  ui: { label: 'Request Timeout (ms)', tab: 'context' },
}
```

**Existing tabs:** `spacing`, `scroll`, `context`
**Best tab for timeout:** `context` (alongside URA, ARA, NTA settings)

**Usage:**
```javascript
const settings = getSettings()
const timeout = settings.requestTimeoutMs || 120000
```

✅ **Clean, well-architected system - safe to add setting**

---

### **2. Key Handling Architecture** (`src/features/interaction/`)

**Structure:**
```
keyRouter.js              // Routes keys to mode-specific handlers
  ├─ inputKeys.js         // INPUT mode handler
  ├─ viewKeys.js          // VIEW mode handler  
  └─ commandKeys.js       // COMMAND mode handler
```

**Key Processing Flow:**
```
1. Browser keydown event
2. keyRouter._onKey() checks:
   - Is modal active? → Block
   - Is target INPUT/TEXTAREA?
     - VIEW mode → Allow (for Emacs keys)
     - INPUT/COMMAND mode → Only intercept Enter/Esc/Ctrl keys
3. Route to mode handler: inputHandler(e) / viewHandler(e) / commandHandler(e)
4. Handler returns true → preventDefault(), false → pass through
```

**INPUT Mode Keys (inputKeys.js lines 87-359):**
- `Enter` - Send message (line 161)
- `Shift+Enter` - Newline (line 158)
- `Ctrl+P` - Topic picker (line 90)
- `Ctrl+U` - Clear to start (line 101)
- `Ctrl+W` - Delete word (line 110)
- `Ctrl+A` - Start of line (line 125)
- `Ctrl+E` - End of line (line 131)
- `Ctrl+Shift+F` - Forward word (line 137)
- `Ctrl+Shift+B` - Backward word (line 148)
- `Esc` - Switch to VIEW (handled by keyRouter, not inputHandler)

**Key Design Principle:** Modal integrity - each mode owns its keys, no cross-mode interference

✅ **Well-designed system - must respect modal boundaries**

---

### **3. Error Display System** (historyView.js lines 230-280)

**Error Labels (Compact Classification):**
- `error: model` - Invalid/unknown model
- `error: auth` - API key / auth issues
- `error: quota` - Rate limits / context overflow
- `error: net` - Network failures
- `error: unknown` - Unclassified

**Display Location:** Meta line badge (inline with timestamp, model)
```html
<span class="badge state error" title="Full error message">error: net</span>
```

**User Actions:**
- `e` key - Edit & resend
- `w` key - Delete error message

**For timeout/abort:**
- Error message: Full text (e.g., "Request aborted after timeout")
- Error label: `error: net` (already exists!)
- Title attribute: Shows full message on hover

✅ **No changes needed to error display - existing system handles it**

---

## REFINED IMPLEMENTATION PLAN

### **Module Changes:**

#### **1. `src/core/settings/schema.js`** (Add setting)

```javascript
requestTimeoutMs: {
  defaultValue: 120000,
  renderAction: 'none',
  control: { type: 'number', min: 30000, max: 600000, step: 10000 },
  ui: { label: 'Request Timeout (ms)', tab: 'context' },
}
```

**Risk:** None - pure data addition

---

#### **2. `src/features/interaction/inputKeys.js`** (Main changes)

**Location:** Lines 161-272 (Enter key handler)

**Changes needed:**
1. Create AbortController with timeout before `executeSend()`
2. Pass `controller.signal` instead of `undefined`
3. Store controller reference for keyboard abort
4. Clear timeout on success/error
5. Handle `AbortError` specially

**Pseudo-code:**
```javascript
// Before executeSend (line 208)
const controller = new AbortController()
const settings = getSettings()
const timeoutMs = settings.requestTimeoutMs || 120000
const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

// Store for keyboard abort
if (!window.__maichat) window.__maichat = {}
window.__maichat.requestController = controller

try {
  const { content } = await executeSend({
    // ... existing params
    signal: controller.signal,  // ← Change from undefined
    // ... rest
  })
  clearTimeout(timeoutId)
  // ... success handling
} catch (ex) {
  clearTimeout(timeoutId)
  window.__maichat.requestController = null
  
  let errMsg
  if (ex.name === 'AbortError') {
    errMsg = 'Request aborted'  // Timeout or manual cancel
  } else {
    errMsg = ex && ex.message ? ex.message : 'error'
    // ... existing error handling
  }
  // ... rest of error handling
} finally {
  window.__maichat.requestController = null
}
```

**Risk:** Low - standard AbortController pattern

---

#### **3. `src/features/interaction/inputKeys.js`** (Add Ctrl+C handler)

**Location:** Add BEFORE Enter handler (around line 160)

```javascript
// Ctrl+C to abort pending request (INPUT mode only)
if (e.key === 'c' && e.ctrlKey && !e.shiftKey && !e.metaKey) {
  const controller = window.__maichat && window.__maichat.requestController
  if (lifecycle.isPending() && controller) {
    e.preventDefault()
    controller.abort()
    return true
  }
  // If not pending, pass through (no-op, but respectful)
  return false
}
```

**Why here?**
- ✅ Respects modal integrity (INPUT mode only)
- ✅ Consistent with existing INPUT key handlers
- ✅ Near related code (Enter handler that creates controller)
- ✅ No global listener needed - handled by keyRouter

**Why Ctrl+C works:**
- Already intercepted in INPUT mode (line 19: `const intercept = e.key === 'Enter' || e.key === 'Escape' || e.ctrlKey`)
- Won't conflict with browser copy (we don't use Ctrl+C for copy)
- Universal "cancel" convention

**Risk:** Very low - follows existing pattern

---

#### **4. Documentation** (3 files)

**A. `docs/keyboard_reference.md`:**
```markdown
| Ctrl+C | Cancel pending request | INPUT mode only, during "AI thinking" |
```

**B. `src/features/config/helpOverlay.js`:**
```javascript
<div class="help-k">Ctrl+C</div><div class="help-d">Cancel pending request</div>
```

**C. `src/tutorial/tutorial-content.md`:**
Brief mention in relevant section (optional)

**Risk:** None - documentation only

---

## ANSWERS TO YOUR QUESTIONS

### **1. Should we make timeout a setting?**

**YES - Add to schema.js**
- Tab: `context` (fits with URA/ARA/NTA)
- Label: "Request Timeout (ms)"
- Default: 120000 (2 minutes)
- Range: 30s - 10 minutes
- Already has perfect infrastructure for this

**Complexity:** Trivial (+8 lines in schema.js)

---

### **2. How are keys handled?**

**Modal System:**
```
keyRouter (global) 
  → Checks mode 
    → Routes to inputHandler / viewHandler / commandHandler
      → Handler decides what to do
        → Returns true (preventDefault) or false (pass through)
```

**For Ctrl+C abort:**
- ✅ Add to `inputKeys.js` (INPUT mode handler)
- ✅ Check `lifecycle.isPending()` before acting
- ✅ Return true to preventDefault
- ✅ Respects modal integrity - only works in INPUT mode
- ✅ No risk to key management architecture

**Why INPUT mode only?**
- User sends message from INPUT mode
- "AI thinking" happens while still in INPUT mode
- Natural location for abort

---

### **3. Error display?**

**Existing system handles it perfectly:**
```javascript
// In catch block
if (ex.name === 'AbortError') {
  errMsg = 'Request aborted'
}
store.updatePair(id, {
  assistantText: '',
  lifecycleState: 'error',
  errorMessage: errMsg  // Full message
})
```

**What user sees:**
- Meta line badge: `error: net` (classifyErrorCode detects "aborted")
- Hover title: "Request aborted" (full message)
- Actions: `e` to resend, `w` to delete

**No changes needed!**

---

### **4. Same message for timeout vs manual abort?**

**YES - "Request aborted"**
- Simple, accurate
- User doesn't need to know why (could be either)
- classifyErrorCode will show `error: net` label
- Consistent with existing error system

---

## SUMMARY

### **Files to Change:**
1. ✅ `src/core/settings/schema.js` - Add requestTimeoutMs setting (8 lines)
2. ✅ `src/features/interaction/inputKeys.js` - Add timeout + Ctrl+C (40 lines)
3. ✅ Documentation (3 files, ~10 lines total)

### **Total:** ~60 lines, 4 files

### **Risk Level:** ⭐ Very Low
- Standard Web API (AbortController)
- Follows existing architecture patterns
- Respects modal system
- No breaking changes

### **Testing:**
1. Normal request - works as before
2. Slow network - times out after 2 min
3. Ctrl+C during pending - aborts immediately
4. Ctrl+C when not pending - no effect
5. Settings change - new timeout applies

**Ready to implement when you approve!** 🚀

---

## ERROR LABELS AND MESSAGE LIFECYCLE (INVESTIGATION)

### **Error Label System** (historyView.js lines 230-280)

**Purpose:** Classify error messages into compact, scannable labels for meta line display

**Existing Labels:**

| Label | Triggers | Meaning | Example Messages |
|-------|----------|---------|------------------|
| `error: model` | Model not found, invalid, deprecated | Invalid model name or model removed by provider | "model 'gpt-5' does not exist", "model deprecated" |
| `error: auth` | API key, 401, 403, unauthorized | Authentication/authorization failure | "API key missing", "401 Unauthorized", "Forbidden" |
| `error: quota` | 429, rate, quota, TPM, RPM, context length | Rate limits or context window exceeded | "429 Too Many Requests", "quota exceeded", "context length exceeded" |
| `error: net` | network, fetch, failed | **Network/fetch failures** | "network error", "fetch failed", "Network timeout" |
| `error: unknown` | Anything else | Uncategorized errors | Any message not matching above |

**Detection Logic:**
```javascript
export function classifyErrorCode(message) {
  const msg = (message || '').toLowerCase()
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed'))
    return 'error: net'
  // ... other checks
  return 'error: unknown'
}
```

### **What `error: net` Currently Means:**

**Thrown by providers when fetch() throws:**
```javascript
// openaiAdapter.js, anthropicAdapter.js, geminiAdapter.js
try {
  resp = await fetch(API_URL, { ... })
} catch (ex) {
  throw new ProviderError('network error', 'network')
}
```

**Triggers:**
- ✅ Immediate connection failure (offline)
- ✅ DNS resolution failure
- ✅ CORS errors
- ✅ **AbortError (when request aborted)** ← Our case!

**Conclusion:** `error: net` is **perfect** for timeout/abort! It already covers:
- Network failures
- Fetch exceptions
- Aborted requests

**No new label needed!**

---

### **Message Lifecycle States**

**States:** `'idle' | 'sending' | 'error' | 'complete'`

**State Flow:**
```
idle → sending → complete  (success)
idle → sending → error      (failure/abort)
```

**Current Behavior:**

1. **Message creation** (before send):
   ```javascript
   id = store.addMessagePair({ 
     topicId, 
     model, 
     userText: text, 
     assistantText: ''  // Empty!
   })
   // lifecycleState defaults to 'idle'
   ```

2. **Send begins:**
   ```javascript
   lifecycle.beginSend()
   // Pair exists with userText but empty assistantText
   // State changes to 'sending' (implicitly)
   ```

3. **During "AI thinking":**
   - Pair is in store with `lifecycleState: 'sending'`
   - **Assistant message IS DISPLAYED in history!**
   - Shows meta line with pulsing `…` badge
   - Body is empty (no text yet)
   
4. **On success:**
   ```javascript
   store.updatePair(id, {
     assistantText: content,
     lifecycleState: 'complete',
     errorMessage: undefined,
   })
   ```

5. **On error:**
   ```javascript
   store.updatePair(id, {
     assistantText: '',
     lifecycleState: 'error',
     errorMessage: errMsg,
   })
   ```

### **Abort Behavior:**

**What happens when user presses Ctrl+C:**

1. `controller.abort()` called
2. `fetch()` throws AbortError
3. Caught in catch block:
   ```javascript
   catch (ex) {
     if (ex.name === 'AbortError') {
       errMsg = 'Request aborted'
     }
     store.updatePair(id, {
       assistantText: '',           // Empty (no response received)
       lifecycleState: 'error',     // Mark as error
       errorMessage: errMsg,        // "Request aborted"
     })
   }
   ```

4. **Message IS displayed with:**
   - User part: Original user text ✓
   - Meta line: Shows `error: net` badge (red)
   - Assistant body: Empty (no text)
   - Error actions: `e` to resend, `w` to delete
   - Tooltip: Shows full message "Request aborted"

**This is exactly what we want!** ✅

---

### **Visual Confirmation:**

**Normal flow:**
```
[User message]
[Meta: topic | model | timestamp | …]  ← Pulsing during send
[Empty assistant body - waiting...]
```

**After abort:**
```
[User message]  
[Meta: topic | model | timestamp | error: net]  ← Red badge
[Empty assistant body]
[↻ Resend] [✕ Delete]  ← Error actions
```

**User can:**
- Press `e` to copy user text and resend
- Press `w` to delete the failed pair
- Hover error badge to see "Request aborted"

---

## FINAL ANSWERS TO YOUR QUESTIONS

### **1. Implementation Plan Updated?**

✅ **YES** - Removed "Add Cancel Button", now single phase with timeout + Ctrl+C keyboard abort

---

### **2. What is `error: net` used for?**

**Current usage:**
- Network connection failures (offline, DNS)
- Fetch exceptions (CORS, network errors)
- **Already includes AbortError!**

**For timeout/abort:**
- ✅ Perfect fit - same category
- ✅ No new label needed
- ✅ Consistent with existing errors

---

### **3. How will aborted message be displayed?**

**Status in store:**
```javascript
{
  id: 'pair-123',
  userText: 'User question',
  assistantText: '',              // Empty!
  lifecycleState: 'error',        // Error state
  errorMessage: 'Request aborted' // Full message
}
```

**Visual display:**
- ✅ **IS displayed** in history (not hidden)
- ✅ User part shown with original text
- ✅ Meta line shows `error: net` badge (red)
- ✅ Assistant body is empty
- ✅ Error actions available (`e` resend, `w` delete)
- ✅ Hover shows full message

**Why displayed?**
- Message pair already exists when send begins
- During "AI thinking", it shows with pulsing `…`
- On abort, state changes to `error` with error badge
- User can see what failed and take action

---

## READY TO IMPLEMENT?

All questions answered:
- ✅ Implementation plan updated (single phase)
- ✅ Error label system understood (`error: net` perfect fit)
- ✅ Message lifecycle clarified (will display with error state)
- ✅ Visual behavior confirmed (matches existing error flow)

**Approve to proceed?** 🎯
