# Request Timeout & Abort Specification

**Date:** 16 October 2025  
**Status:** Approved for Implementation

---

## Problem

When internet connection fails during AI response waiting ("AI is thinking..."), the app hangs indefinitely because:
- Native `fetch()` has no default timeout
- No way for user to cancel the request
- User must reload page, losing context

---

## Solution

Implement dual abort mechanism:
1. **Automatic timeout** after configurable duration (default 120 seconds)
2. **Manual abort** via keyboard command (Ctrl+C in INPUT mode)

Both use same `AbortController` API, same error handling path.

---

## Architecture

### Settings System (controlled by users exposed via settings overlay)
- **File:** `src/core/settings/schema.js`
- **Add setting:** `requestTimeoutMs`
  - Default: 120000 (2 minutes)
  - Range: 30000-600000 (30s to 10min)
  - Tab: `context` (with URA/ARA/NTA)
  - Render action: `none`

### Key Handling
- **File:** `src/features/interaction/inputKeys.js`
- **Add Ctrl+C handler** in INPUT mode
- **Location:** Before Enter handler (line ~160)
- **Constraint:** Must respect modal integrity - INPUT mode only
- **Behavior:** Check `lifecycle.isPending()` before aborting

### Request Flow
- **File:** `src/features/interaction/inputKeys.js`
- **Modify:** Enter key handler async block (line ~195-280)
- **Changes:**
  1. Create `AbortController` before `executeSend()`
  2. Set timeout to call `controller.abort()`
  3. Store controller reference for Ctrl+C access
  4. Pass `signal` to `executeSend()` (currently `undefined`)
  5. Clear timeout on success/error
  6. Handle `AbortError` specially

### Error Handling
- **Error name:** `AbortError` (standard fetch abort)
- **Error message:** "Request aborted" (same for timeout & user abort)
- **Error label:** `error: net` (existing label, no changes needed)
- **Display:** Standard error flow - meta line badge, resend/delete actions

---

## Current Behavior (Verified)

### Message Creation & Display
1. User presses Enter in INPUT mode
2. Pair created with `userText` and empty `assistantText`
3. Input field cleared
4. **History renders immediately** - user message appears
5. Async request begins
6. During wait: Send button shows "AI is thinking: MM:SS"
7. **Assistant message NOT displayed until response received**

### On Success
- `assistantText` populated
- `lifecycleState: 'complete'`
- History re-renders with response

### On Error (Current & After Implementation)
- Assistant message is displayed with empty assistant text, but withh populated meta line (!)
- `assistantText` remains empty
- `lifecycleState: 'error'`
- `errorMessage` set
- History re-renders showing error badge
- User can resend (E) or delete (W)

---

## Implementation Impact

### Abort Behavior
When timeout fires OR user presses Ctrl+C:
1. `controller.abort()` called
2. `fetch()` throws `AbortError`
3. Catch block detects `ex.name === 'AbortError'`
4. Store updated: `lifecycleState: 'error'`, `errorMessage: 'Request aborted'`
5. History re-renders showing user message + error badge
6. **No assistant message displayed** (never received response)

### User Experience
- User sees their question in history
- Meta line shows `error: net` badge (red)
- Hover shows "Request aborted"
- Can press E to resend or W to delete
- Identical to existing network error handling

---

## Files to Modify

### ARCHITECTURAL DECISION: Remove Legacy Send Button Handler (Option B - Simplified)

**Discovery:** Two send paths exist with significant duplication and feature gaps:
1. **`inputKeys.js`** - Enter key handler (CURRENT, COMPLETE) - All features implemented
2. **`interaction.js`** - Send button click handler (LEGACY, INCOMPLETE) - Missing features

**Decision:** Replace button handler with simple delegation to Enter key handler.

**Rationale:**
- ✅ DRY principle - single source of truth
- ✅ Fixes missing features (code/equation extraction, topic history, boundary management)
- ✅ Simplifies maintenance (one place to add timeout/abort)
- ✅ Reduces code by ~90 lines
- ✅ Button behavior: Only works in INPUT mode, delegates to Enter handler

---

## Files to Modify (Final)

1. **`src/core/settings/schema.js`** (~8 lines added)
   - Add `requestTimeoutMs` setting definition

2. **`src/features/interaction/inputKeys.js`** (~50 lines modified)
   - Add Ctrl+C handler for manual abort
   - Modify Enter handler async block:
     - Create AbortController before executeSend
     - Set timeout to call controller.abort()
     - Store controller reference for Ctrl+C access
     - Pass signal to executeSend (currently undefined)
     - Clear timeout on success/error
     - Handle AbortError specially

3. **`src/features/interaction/interaction.js`** (~100 lines deleted, ~10 lines added = -90 net)
   - DELETE: Entire legacy send button handler (lines 725-807)
   - DELETE: Redundant scroll listener (lines 814-826)
   - ADD: Simple delegation to Enter key (10 lines)
   ```javascript
   if (sendBtn) {
     sendBtn.addEventListener('click', () => {
       // Only work in INPUT mode
       if (modeManager.mode !== 'input') return
       
       // Dispatch Enter key event - delegates to inputKeys.js handler
       const enterEvent = new KeyboardEvent('keydown', {
         key: 'Enter',
         code: 'Enter',
         bubbles: true,
         cancelable: true
       })
       inputField.dispatchEvent(enterEvent)
     })
   }
   ```

4. **Documentation** (~15 lines total)
   - `docs/keyboard_reference.md` - Add Ctrl+C to INPUT mode keys
   - `src/features/config/helpOverlay.js` - Add Ctrl+C to Input Mode section
   - `src/tutorial/tutorial-content.md` - Mention abort capability (optional)

**Total:** ~70 lines added, ~100 lines deleted = **-30 net lines** (code reduction!)

---

## Risk Assessment

**Very Low:**
- Standard Web API (AbortController)
- Follows existing architecture patterns
- Respects modal system
- No breaking changes
- Error handling already exists

---

## Testing Scenarios

1. **Normal request** - completes before timeout
2. **Slow network** - times out after 2 minutes, shows error
3. **User abort** - Ctrl+C stops request, shows error
4. **Ctrl+C when not pending** - no effect, key ignored
5. **Settings change** - new timeout duration applied
6. **Already offline** - fails immediately (existing behavior, no timeout needed)

---

## Open Questions

1. **Error message differentiation:**
   - Same message for both? "Request aborted" ✓ Simpler
   - Different messages? "Request timed out" vs "Cancelled by user"

2. **Timeout duration:**
   - 120s confirmed ✓
   - User configurable via settings ✓

---

## Summary

**Dual win: Fix timeout AND clean up architecture**

### Primary Goal: Timeout & Abort
- Add configurable timeout (default 120s)
- Add Ctrl+C manual abort in INPUT mode
- Both use AbortController API
- Reuse existing error display (error: net)

### Bonus: Remove Legacy Code
- Discovered duplicate send logic (button vs Enter key)
- Button handler missing features (code/equations/topic history)
- Replace with simple delegation to Enter handler
- **Net code reduction: -30 lines**

### Changes:
1. Add timeout setting to schema
2. Add AbortController + Ctrl+C to Enter handler (inputKeys.js)
3. Replace legacy button handler with delegation (interaction.js)
4. Update documentation

### Risk: Very Low
- Standard AbortController pattern
- Simple event delegation
- No architectural changes
- Existing error handling
- Actually SIMPLIFIES codebase

### Implementation Plan Overview:
**Phase 1**: Add Timeout Setting (Foundation)
Add setting to schema.js
Test in Settings UI
Risk: None (pure data)
**Phase 2**: Replace Send Button Handler (Cleanup)
Remove 100 lines of legacy code
Add 10 lines of delegation
6 tests to verify all features work
Risk: Medium (behavior change, but well-tested)
**Phase 3**: Add Timeout to Enter Handler (Core Feature)
Add AbortController
Set timeout
Pass signal
Handle AbortError
4 tests including timeout simulation
Risk: Medium (core change, but standard pattern)
**Phase 4**: Add Ctrl+C Manual Abort (Quick Win)
Add Ctrl+C handler
4 tests for abort behavior
Risk: Low (isolated addition)
**Phase 5**: Update Documentation (Completeness)
Update keyboard reference
Update help overlay
Risk: None (docs only)