# Bug Fix: Response Not Rendered When User Is Typing

**Status:** Root cause identified, fix designed  
**Date:** 2025-11-15  
**File:** `src/features/history/newMessageLifecycle.js`

---

## Problem Statement

When a user sends a request and starts typing a new message while waiting for the response, the assistant's response is **not rendered** on screen when it arrives, even though:
- ✅ The response is successfully received
- ✅ The pair is updated in the store with correct data
- ✅ The response is logged to localStorage
- ✅ Manual re-render (changing filter) shows the response correctly

**Trigger:** Typing in input field while response is being processed.

---

## Investigation Summary

### Initial Hypothesis (INCORRECT)
Initially suspected this was an error handling issue where certain HTTP errors (503, model overloaded) weren't being caught and displayed.

### Actual Root Cause (CONFIRMED)
The bug occurs in **successful responses**, not errors. The issue is in `handleNewAssistantReply()` function which has conditional logic based on input field state.

### Evidence

**Test Results:**
| Error Type | Behavior | Console Logs |
|------------|----------|--------------|
| Network error (WiFi off) | ✅ Works correctly | Error caught, rendered, displayed |
| Invalid API key | ✅ Works correctly | Error caught, rendered, displayed |
| Rate limit (429) | ✅ Works correctly | Error caught, rendered, displayed |
| **Success + typing** | ❌ **BROKEN** | Success logged, but not displayed |

**Console output from broken case:**
```
[SUCCESS-27aed0b7] About to update pair with response
[SUCCESS-27aed0b7] Pair updated, state: complete
[SUCCESS-27aed0b7] Render complete, calling handleNewAssistantReply
[LIFECYCLE-27aed0b7] handleNewAssistantReply called
[LIFECYCLE-27aed0b7] Input state: {exists: true, value: 'sdfsdflkjddjdfffkdjdjdk...', inputEmpty: false}
[LIFECYCLE-27aed0b7] Found 1 reply parts
[LIFECYCLE-27aed0b7] Message metrics: {currentMode: 'input', inputEmpty: false, fits: true, ...}
[LIFECYCLE-27aed0b7] Decision: shouldSwitch=false
[LIFECYCLE-27aed0b7] NO ACTION TAKEN - input not empty or other condition
```

**Key finding:** When `inputEmpty: false`, both code branches return early without setting active message or scrolling.

---

## Root Cause Analysis

**File:** `src/features/history/newMessageLifecycle.js`  
**Function:** `handleNewAssistantReply(pairId)`  
**Lines:** 85-114

The function has two conditional branches for handling new replies:

```javascript
// Branch 1: Message doesn't fit - switch to VIEW mode
const shouldSwitch = currentMode === 'input' && inputEmpty && !fits
if (shouldSwitch && modeMgr && MODES) {
  // Switch to VIEW, align to top
}
// Branch 2: Message fits - stay in INPUT mode  
else if (currentMode === 'input' && inputEmpty && fits) {
  // Stay in INPUT, scroll to bottom
}
// ELSE: Do nothing!
```

**Both branches require `inputEmpty === true`!**

When the user is typing (`inputEmpty === false`), neither branch executes, so:
- ❌ Active message is NOT set to the new response
- ❌ No scrolling/alignment happens
- ❌ Response remains invisible off-screen

---

## Desired Behavior

### Terminology Clarification

**Mode:** One of {INPUT, VIEW, COMMAND} - determines available key bindings  
**Active Message:** The message with blue contour - independent of mode  
**Active Message Alignment:** How active message is positioned (top or bottom of viewport)  
**Browser Focus:** Which HTML element receives keyboard input (input field has DOM focus in INPUT mode)

### Behavior Matrix

| Input State | Message Fits | **Mode** | **Active Message** | **Active Message Alignment** | **Browser Focus** |
|-------------|--------------|----------|-------------------|------------------------------|-------------------|
| Empty | Yes | INPUT | New response | Bottom | Input field |
| Empty | No | VIEW | New response | Top | Body/none |
| **Typing** | **Yes** | **INPUT** | **New response** | **Bottom** | **Input field** |
| **Typing** | **No** | **INPUT** | **New response** | **Top** | **Input field** |

**Key requirement when user is typing:**
- ✅ Set active message to new response (blue contour)
- ✅ Align response (bottom if fits, top if doesn't fit)
- ✅ **Keep mode = INPUT** (don't interrupt typing)
- ✅ Keep browser focus in input field

---

## Solution

### Implementation

**File:** `src/features/history/newMessageLifecycle.js`  
**Function:** `handleNewAssistantReply(pairId)`  
**Change:** Add third branch to handle case when input is not empty

**Current code structure (lines 85-114):**
```javascript
const shouldSwitch = currentMode === 'input' && inputEmpty && !fits
if (shouldSwitch && modeMgr && MODES) {
  // Branch 1: Empty input, doesn't fit → Switch to VIEW, align top
}
else if (currentMode === 'input' && inputEmpty && fits) {
  // Branch 2: Empty input, fits → Stay INPUT, align bottom
}
// Missing: Branch 3 for non-empty input!
```

**Proposed fix - Add third branch:**
```javascript
else if (currentMode === 'input' && !inputEmpty) {
  // Branch 3: User is typing → Stay INPUT, align based on fit
  const firstId = first.getAttribute('data-part-id')
  if (firstId) {
    activeParts.setActiveById(firstId)
  }
  
  if (fits) {
    // Message fits → align to bottom
    if (scrollController && scrollController.scrollToBottom) {
      scrollController.scrollToBottom(false)
    }
  } else {
    // Message doesn't fit → align to top
    if (firstId && alignTo) {
      alignTo(firstId, 'top', false)
    }
  }
  
  if (firstId) {
    _applyActivePart()
    const raf3 = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (fn) => setTimeout(fn, 0)
    raf3(() => _applyActivePart())
  }
}
```

### Changes Required

1. **Add new `else if` branch** (after line 114) to handle `!inputEmpty` case
2. **Set active message** to new response (same as other branches)
3. **Conditional alignment:**
   - If message fits → `scrollController.scrollToBottom(false)`
   - If doesn't fit → `alignTo(firstId, 'top', false)`
4. **Keep INPUT mode** (don't call `modeMgr.set()`)
5. **Apply active part** (same as other branches)

### Testing Checklist

- [ ] Normal response (input empty, fits) → Stays INPUT, aligns bottom
- [ ] Long response (input empty, doesn't fit) → Switches VIEW, aligns top
- [ ] **Response while typing (fits)** → Stays INPUT, aligns bottom, shows response
- [ ] **Response while typing (doesn't fit)** → Stays INPUT, aligns top, shows response
- [ ] Multiple rapid requests → All responses visible
- [ ] Error responses → Still work as before

---

## Files Modified

1. `src/features/history/newMessageLifecycle.js` - Add third branch to `handleNewAssistantReply()`

## Debug Logging

Temporary debug logging added to verify fix (can be removed after testing):
- `src/features/compose/sendWorkflow.js` - Success/error path logging
- `src/features/history/newMessageLifecycle.js` - Input state and decision logging

---

**Next Steps:**
1. Implement the fix (add third branch)
2. Test all scenarios from checklist
3. Remove debug logging
4. Commit with clear message

**Estimated effort:** 15-20 minutes
