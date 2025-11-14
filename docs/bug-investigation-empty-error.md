# Bug Investigation: Empty Response on Network Failure

## Problem Statement
When Gemini API request fails with "Failed to fetch" (network error), the UI shows:
- ❌ NO assistant message at all
- ❌ NO error badge/indicator
- ✅ "Send" button returns (not stuck in "AI is thinking...")
- ✅ User message appears in history

**Expected:** Assistant message with RED error badge and error message.

## Evidence Collected

### 1. The Error
```json
{
  "timestamp": 1763143153771,
  "timestampISO": "2025-11-14T17:59:13.771Z",
  "name": "TypeError",
  "message": "Failed to fetch",
  "stack": "TypeError: Failed to fetch\n    at Object.sendChat (geminiAdapter.js:111:22)"
}
```

### 2. The Pair State (CRITICAL)
```json
{
  "id": "6587a7d6-b253-4cfb-9440-4ff18dbbf590",
  "lifecycleState": "idle",  // ← Should be 'error'!
  "assistantText": "",
  "errorMessage": undefined,  // ← Should have error message!
  "userText": "ok, do you have an information..."
}
```

**Key Finding:** Pair never transitioned from `"idle"` to `"error"` state.

## Code Flow Analysis

### Flow Diagram
```
inputKeys.js Enter handler (line 423)
├─ Line 449: lifecycle.beginSend() → "AI is thinking..."
├─ Line 458-519: Async IIFE (no error handler!) ← BUG LOCATION
│  └─ Line 461: await executeSendWorkflow()
│     │
│     └─ sendWorkflow.js (line 66)
│        ├─ Line 91-101: Create pair with lifecycleState: 'idle'
│        ├─ Line 114-322: ANOTHER Async IIFE ← NESTED!
│        │  ├─ Line 126: try {
│        │  ├─ Line 164: executeSend() → geminiAdapter
│        │  │  └─ Line 111: fetch() throws "Failed to fetch"
│        │  ├─ Line 254: } catch (ex) {
│        │  │  ├─ Line 262-266: Update pair with lifecycleState: 'error'
│        │  │  ├─ Line 269: lifecycle.completeSend()
│        │  │  └─ Line 271: historyRuntime.renderCurrentView()
│        │  └─ Line 299: } finally { trim notification }
│        └─ Line 322: return id  ← RETURNS IMMEDIATELY!
│
└─ Line 521-528: Immediate cleanup (clear input)
```

### The Critical Issue

**sendWorkflow.js has NESTED async execution:**

```javascript
export async function executeSendWorkflow({...}) {
  // Synchronous: Create pair
  const id = store.addMessagePair({...}) // lifecycleState: 'idle'
  
  // Fire-and-forget async IIFE
  ;(async () => {
    try {
      await executeSend()  // This can take seconds and can fail
    } catch (ex) {
      // Handle error, update pair
    }
  })()
  
  return id  // ← Returns IMMEDIATELY, doesn't wait for async IIFE!
}
```

**This means:**
1. `executeSendWorkflow()` returns the `id` instantly
2. The actual send happens in background (fire-and-forget)
3. inputKeys.js thinks the workflow completed successfully
4. inputKeys.js does post-send UI updates with pair in "idle" state

## Root Cause Analysis

**The bug happens in sendWorkflow.js line 114:**

```javascript
;(async () => {
  try {
    // ... send logic ...
  } catch (ex) {
    // ... error handling ...
  }
})()  // ← Fire-and-forget! Parent function doesn't wait!

return id  // ← Returns BEFORE async work completes
```

**Why this exists:**
- Comment says "async IIFE to avoid blocking" but that's already achieved by `executeSendWorkflow` being async
- This creates a race condition between error handler and caller

**Why pair stays in "idle":**
- When sendWorkflow returns `id`, pair is still in "idle" state
- The try/catch error handler runs LATER (in background)
- But by then, inputKeys has already done UI updates

## Why This Doesn't Always Fail

**When it works (most cases):**
- Network is fast, executeSend() completes in ~1 second
- Error handler runs before inputKeys does post-send updates
- Race condition resolves in correct order

**When it fails (intermittent):**
- Network timeout/failure happens
- Exception thrown from deep in call stack
- Error handler updates pair to "error" state
- BUT: Timing is unpredictable

## Questions to Answer

1. **WHY does sendWorkflow have nested async IIFE?**
   - Was this intentional for non-blocking?
   - Or accidental complexity from refactoring?

2. **Should executeSendWorkflow await the inner async work?**
   - PRO: Guarantees error handling completes
   - CON: Loses fire-and-forget behavior (if that's desired)

3. **Is this pattern used elsewhere?**
   - Does interaction.js have the same pattern?
   - Will fixing this break other call sites?

## Next Steps

1. ✅ Document the issue (this file)
2. ✅ **ROOT CAUSE CONFIRMED**
3. ⏳ Determine correct architectural fix
4. ⏳ Implement fix
5. ⏳ Test fix doesn't break normal flow
6. ⏳ Check if other providers have same issue

---

## ROOT CAUSE CONFIRMED ✅

**File:** `src/features/compose/sendWorkflow.js`  
**Line:** 114 and 320

```javascript
export async function executeSendWorkflow({...}) {
  const id = store.addMessagePair({...})  // Pair created in "idle" state
  
  ;(async () => {  // ← Line 114: Fire-and-forget async IIFE
    try {
      await executeSend()  // Can take seconds, can fail
    } catch (ex) {
      store.updatePair(id, { lifecycleState: 'error', errorMessage: ... })
    }
  })()  // ← Line 320: NO AWAIT! Function continues immediately
  
  return id  // ← Line 322: Returns BEFORE async work completes!
}
```

**The bug:**
- `executeSendWorkflow` returns `id` **immediately** without waiting for send to complete
- inputKeys.js receives the `id` and does post-send UI updates while pair is still "idle"
- Meanwhile, the send happens in background (fire-and-forget)
- If send fails, error handler runs but UI has already moved on

## Proposed Solutions

### Solution A: Make executeSendWorkflow truly async (RECOMMENDED)
**Change:** Add `await` before the async IIFE

```javascript
export async function executeSendWorkflow({...}) {
  const id = store.addMessagePair({...})
  
  await (async () => {  // ← ADD AWAIT
    try {
      await executeSend()
    } catch (ex) {
      store.updatePair(id, { lifecycleState: 'error', errorMessage: ... })
    }
  })()
  
  return id  // Now returns AFTER send completes (success or error)
}
```

**Pros:**
- ✅ Simple one-line fix
- ✅ Guarantees error handling completes before return
- ✅ Caller (inputKeys) gets correct pair state
- ✅ No race conditions

**Cons:**
- ❓ Changes timing - inputKeys now waits for send to complete
- ❓ May affect UI responsiveness (but it's already async at inputKeys level)
- ❓ Need to verify this doesn't break other behaviors

### Solution B: Remove nested IIFE entirely
**Change:** Just use the try/catch directly (no IIFE)

```javascript
export async function executeSendWorkflow({...}) {
  const id = store.addMessagePair({...})
  
  const controller = new AbortController()
  // ... setup ...
  
  try {
    await executeSend()
  } catch (ex) {
    store.updatePair(id, { lifecycleState: 'error', errorMessage: ... })
  } finally {
    // trim notification
  }
  
  return id
}
```

**Pros:**
- ✅ Cleaner code, less nesting
- ✅ Same fix as Solution A but more readable
- ✅ Removes unnecessary async IIFE

**Cons:**
- ⚠️ Larger change, more risk
- ❓ Need to verify why IIFE was there originally

### Solution C: Add error handler to inputKeys IIFE
**Change:** Catch errors in inputKeys.js

```javascript
// inputKeys.js
;(async () => {
  try {
    const id = await executeSendWorkflow({...})
    // post-send UI updates
  } catch (ex) {
    // Handle error if executeSendWorkflow throws
  }
})()
```

**Pros:**
- ✅ Defensive programming
- ✅ Catches errors from executeSendWorkflow itself

**Cons:**
- ❌ Doesn't fix root cause
- ❌ executeSendWorkflow still has fire-and-forget async IIFE
- ❌ Doesn't solve the race condition

## Detailed Solution Comparison

### Solution A: Add `await` (Minimal)

**Change size:** 1 word  
**Files affected:** 1  
**Lines changed:** 1  
**Complexity impact:** No change (keeps nested IIFE)  
**Risk level:** ⭐ Very Low

**What changes:**
```diff
- ;(async () => {
+ await (async () => {
    // ... 206 lines of existing code unchanged ...
  })()
```

**Pros:**
- ✅ Minimal risk - only timing changes
- ✅ 5-second fix
- ✅ Easy to review
- ✅ Easy to revert if needed

**Cons:**
- ❌ **Keeps unnecessary complexity** (nested IIFE serves no purpose)
- ❌ Future developers will be confused why IIFE exists
- ❌ Doesn't improve code quality
- ❌ Technical debt remains

---

### Solution B: Remove Nested IIFE (Simplification)

**Change size:** ~210 lines need un-indenting  
**Files affected:** 1  
**Lines changed:** ~210 (all in sendWorkflow.js)  
**Complexity impact:** -1 nesting level  
**Risk level:** ⭐⭐ Low-Medium

**What changes:**

```diff
  export async function executeSendWorkflow({...}) {
    const id = store.addMessagePair({...})
    
-   ;(async () => {
-     const controller = new AbortController()
-     const settings = getSettings()
-     // ... 200 lines ...
-   })()
-   
-   return id

+   const controller = new AbortController()
+   const settings = getSettings()
+   // ... 200 lines (un-indented by 2 spaces) ...
+   
+   return id
  }
```

**Structural changes needed:**
1. **Lines 114-320:** Remove IIFE wrapper (`(async () => {` and `})()`)
2. **Lines 116-318:** Un-indent all code by 2 spaces
3. **Line 115-123:** Move controller/timeout setup to function level
4. **No logic changes** - just remove wrapper

**Variables that move to function scope:**
- `controller` (line 116)
- `settings` (line 117)
- `timeoutSec`, `timeoutMs`, `timeoutId` (lines 118-120)
- All other variables already local to try/catch blocks

**Pros:**
- ✅ **Removes unnecessary complexity**
- ✅ Cleaner code structure
- ✅ Easier to understand for future developers
- ✅ One less level of nesting
- ✅ No functional difference from Solution A
- ✅ Pays down technical debt

**Cons:**
- ⚠️ Larger diff (harder to review)
- ⚠️ More lines touched (slightly higher risk)
- ⚠️ Takes 15-20 minutes instead of 5 seconds

---

### Risk Analysis for Solution B

**What could go wrong:**

1. **Variable scope issues?**
   - ❌ NO RISK - All variables are local to try/catch blocks
   - `controller`, `settings`, `timeoutId` moving to function scope is safe

2. **Timing changes?**
   - ❌ NO RISK - Adding `await` (implicit in both solutions) is the only timing change
   - Removing IIFE wrapper has ZERO timing impact

3. **Error handling changes?**
   - ❌ NO RISK - try/catch structure remains identical
   - Just un-indented by 2 spaces

4. **Breaking other code?**
   - ❌ NO RISK - Function signature unchanged
   - Return value unchanged (`return id`)
   - Behavior identical to Solution A

5. **Testing burden?**
   - ⚠️ SLIGHTLY HIGHER - Same tests, but reviewers need to verify structure change
   - Git diff will be noisy (210 lines changed due to un-indenting)

**Mitigation:**
- Use `git diff -w` (ignore whitespace) to see actual changes
- Only ~10 lines of actual structural changes (remove IIFE, move variables)

---

### Effort Comparison

| Aspect | Solution A | Solution B |
|--------|-----------|------------|
| **Time to implement** | 5 seconds | 15 minutes |
| **Time to review** | 30 seconds | 5 minutes |
| **Time to test** | Same | Same |
| **Risk if wrong** | Revert 1 line | Revert ~10 lines |
| **Long-term value** | 0 (debt remains) | High (cleaner code) |

---

### Recommendation: **Solution B** ✅

**Reasoning:**

1. **The IIFE serves NO purpose**
   - It was probably added accidentally during refactoring
   - The parent function (`executeSendWorkflow`) is already `async`
   - The IIFE doesn't provide non-blocking (that's handled by inputKeys.js)
   - It only adds confusion

2. **Low actual risk**
   - Most of the 210-line diff is just un-indenting (whitespace)
   - Only ~10 lines of actual structural change
   - No logic changes whatsoever

3. **Pays technical debt**
   - Makes code more maintainable
   - Removes confusing pattern
   - One less "why is this here?" question

4. **Minor extra effort**
   - 15 minutes vs 5 seconds is negligible
   - The value of cleaner code is permanent

**The only reason to choose A:** If you're in emergency hotfix mode and need the absolute minimum change. But this isn't an emergency - it's a known intermittent bug.

---

### Implementation Plan for Solution B

1. Remove line 114: `;(async () => {`
2. Remove line 320: `})()`
3. Un-indent lines 115-319 by 2 spaces (IDE can do this automatically)
4. Verify try/catch/finally structure intact
5. Test all 4 providers
6. Commit with clear message

**Estimated time:** 15-20 minutes  
**Actual risk:** Very low (structural change only)

---

**Status:** Solution B recommended  
**Last Updated:** 2025-11-14 19:00 UTC
