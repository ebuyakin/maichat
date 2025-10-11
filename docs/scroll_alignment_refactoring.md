# History Scroll & Alignment Refactoring

**Date**: October 6-10, 2025  
**Status**: ✅ COMPLETE (Implemented October 10, 2025)  
**Context**: Post-migration from part-based to message-based navigation

---

## Completion Summary

**Problem Solved:** Eliminated async measurement timing issues by adding dedicated `scrollToBottom()` function that doesn't depend on element measurements.

**Implementation:**
- Added `scrollToBottom()` - calculates max scroll position from container dimensions only
- Added `expectScrollToBottom()` - defers scroll until after KaTeX/layout settles  
- Deployed in 12 locations: bootstrap, G key, topic switch, new messages, filter application
- Original `alignTo()` preserved for top/center alignment scenarios (g, u/d, o keys)

**Result:** Reliable bottom-scrolling regardless of async content rendering. All navigation patterns preserved (j/k, u/d, g/G, o).

---

## Problem Statement (Original Analysis)

After migrating from part-based to message-based navigation and eliminating partitioning, we discovered a critical issue: **bottom-aligning the last message with embedded content (KaTeX equations) fails due to measurement timing**.

### Root Cause
- KaTeX equations are rendered asynchronously
- ScrollController measures element heights before KaTeX layout settles
- Last message measured at 1233px, actual height 1561px (328px difference)
- Results in incorrect scroll position (off by ~228-328px)

### Key Observation
We no longer need to **anchor arbitrary messages to the bottom**. We only need to **scroll to the maximum position** (bottom of history) in multiple scenarios.

---

## Current Architecture Analysis

### ScrollController API (`scrollControllerV3.js`)

**Current Functions:**
```javascript
alignTo(partId, position='bottom', animate=false)
  - position: 'top' | 'center' | 'bottom'
  - Uses anchorScrollTop() to calculate scroll position based on measurements
  
ensureVisible(partId, animate=false)
  - Minimal scroll to make element visible
  
stepScroll(deltaPx)
  - Relative scroll by pixels
```

**Current Workflow:**
1. `measure()` - Queries DOM, captures all element heights/positions
2. `anchorScrollTop(idx, position)` - Calculates scroll position
3. `scrollTo(target, animate)` - Sets scrollTop

# Current Usage Patterns

**Scenarios requiring "scroll to bottom":**
1. **Bootstrap/Reload** - `bootstrap.js` line ~60
2. **G key** - Navigate to last message (`viewKeys.js`)
3. **New message sent** - anchor the sent user request to the bottom
4. **New message arrival** - After assistant response (`interaction.js`)
5. **Topic switch with filter `t`** - Focus last in filtered set (`interaction.js`)
6. **Filter application** - Command mode (`commandKeys.js`)
   
   **6a. Pure filter (no colon commands):**
   - **Active message survives filtering** → Preserve active message AND scroll the active message to top
   - **Active message doesn't survive** → Focus last message, scroll to bottom
   
   **6b. Colon commands with filter:**
   - **`:export`** → No data changes, no re-render, no scroll (just download file)
   - **`:tchange` (topic change)** → Re-render with `preserveActive: true` to update topic badges, preserve scroll position, no re-filtering
   - Future commands → Decide behavior per command

7. **Delete message** - Focus shifts to next/last 
8. **Re-ask** - focus shifts to last message
9. **D key special case** - when the focused message is the last message and it's less than a screen height
10. **Settings change** - when user changes settings and closes settings overlay - triggers re-rendering/re-positioning
11. **Refresh** - user-triggered re-rendering (Ctrl-r) from any mode - if the current active survives - no scrolling, if it doesn't - scroll to the bottom. - deferred (unclear if it's really necessary)

**Scenarios requiring top/center alignment:**
1. **g key** - First message, align to top
2. **u/d** - align previous / next message to the top (this is the most frequent and important case)
3. **o key** - Jump to oldest unread, align to center
4. **Long new message** - Center or top-align if tall

**Scrolling without alignment (IMPORTANT - must preserve current behavior):**
1. **j/k keys** - scroll by fixed (pre-configured by the user) step (incremental scrolling)
2. **J/K keys** (Shift+j/k) - scroll by larger fixed (pre-configured) step (incremental scrolling)
   
These commands scroll the history container while updating the active message according to viewport rules. They do NOT trigger alignment - the scroll amount is fixed regardless of message positions.

---

## Architectural Issues

### 1. **Conflating Two Distinct Operations**

`alignTo(partId, 'bottom')` conflates:
- **Aligning a specific message's bottom edge to viewport bottom** (needs measurement)
- **Scrolling to the maximum scroll position** (no measurement needed)

These are fundamentally different operations with different requirements.

### 2. **Unnecessary Coupling**

Bottom-scrolling requires knowing:
- `container.scrollHeight` 
- `container.clientHeight`

It does NOT require:
- Individual element heights
- Element positions
- Part ID lookup

Yet current implementation forces all of this.

### 3. **Timing Vulnerability**

Measurement-based approach is vulnerable to:
- Async content rendering (KaTeX, images, tables)
- Browser layout timing
- CSS transitions/animations

For "scroll to max", we don't care about individual elements - we only care about the container's final scrollHeight.

---

## Proposed Solution

**Add new function:**
```javascript
scrollToBottom(animate=false) {
  const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight)
  scrollTo(maxScroll, !!animate && animationEnabled)
  scheduleValidate()
}
```

**Modify alignTo to remove 'bottom' option:**
```javascript
alignTo(partId, position='top'|'center', animate=false) {
  // 'bottom' option removed entirely
  if(!metrics) measure()
  // ... rest of implementation for top/center only
}
```

**Benefits:**
- ✅ Clear separation of concerns
- ✅ Explicit intent in caller code
- ✅ No measurement overhead for scroll-to-bottom
- ✅ Eliminates timing issues completely
- ✅ Simpler to understand and maintain

**API Change Example:**

**Before:**
```javascript
activeParts.last()
historyRuntime.applyActiveMessage()
scrollController.alignTo(lastAssistant.id, 'bottom', false)
```

**After:**
```javascript
activeParts.last()
historyRuntime.applyActiveMessage()  
scrollController.scrollToBottom(false)
```

The new version is **clearer** - we're scrolling to bottom, not aligning something.

---

## Implementation Plan

### Phase 1: Disable Old Functionality & Add New Function

**Step 1.1**: Modify `alignTo()` to remove 'bottom' support
- Remove 'bottom' from position parameter
- Add validation/error if 'bottom' is passed
- This ensures old code paths are disabled

**Step 1.2**: Add `scrollToBottom()` function
- Implement new function in scrollControllerV3.js
- Export in return object
- Document behavior

**Step 1.3**: Initial test
- Verify application still loads
- Verify no console errors
- Confirm old bottom-align calls are disabled

### Phase 2: Update Call Sites (One at a Time with Testing)

**CRITICAL**: After each change, user will test the specific scenario before proceeding to the next one.

**Order of implementation** (grouped by call site when same function):

# Scenarios Implementation (NB)

1. **bootstrap.js** (line ~60) [x]
   - Scenario: Reload with filter showing message with equations
   - Priority: HIGH - fixes primary bug
   - Testing: Reload multiple times, check alignment
   
2. **viewKeys.js** - G key handler [x]
   - Scenario: Press G key from any position
   - Priority: HIGH - common operation
   - Testing: Navigate away, press G, check alignment
   
3. **viewKeys.js** - D key handler (last message special case) [x]
   - Scenario: Focus last message (shorter than screen), press D
   - Priority: HIGH - same file as #2
   - Testing: Test D key on last vs non-last messages

4. **interaction.js** - new message sent [x]
   - Scenario: Send a message from input
   - Priority: MEDIUM
   - Testing: Send message, check user message alignment

5. **interaction.js** - new message arrival [x] 
   - Scenario: Receive assistant response
   - Priority: MEDIUM - same file as #4
   - Testing: Complete send→receive cycle

6. **interaction.js** - topic switch with filter `t` [x]
   - Scenario: Ctrl+T, select topic
   - Priority: MEDIUM - same file as #4-5
   - Testing: Switch between topics

7. **interaction.js** - delete handlers [x]
   - Scenario: Delete message, focus shifts to last
   - Priority: MEDIUM - same file as #4-6
   - Testing: Delete various messages

8. **interaction.js** - re-ask handler [x]
   - Scenario: Re-ask previous question
   - Priority: MEDIUM - same file as #4-7
   - Testing: Use re-ask feature

9. **commandKeys.js** - filter application [x]
   - Priority: MEDIUM
   - Testing: Apply various filters and colon commands
   
   **9a. Pure filter (no colon commands):**
   - Scenario: Apply filter like `t` or `s2` or `t'Study>Computer science'`
   - Active survives → scroll active to top.
   - Active doesn't survive → Scroll to bottom (make last message active)
   - Testing: Apply filters with/without active surviving
   
   **9b. Colon commands with filter:**
   - **`:export`** → No re-render, no scroll (just download)
   - **`:tchange`** → Re-render with preserveActive (update badges, preserve position)
   - Testing: Export messages, change topics, verify no unwanted scrolling

10. **settings overlay** - settings change handler [x]
    - Scenario: Change settings, close overlay
    - Priority: LOW
    - Testing: Change different settings, verify re-positioning

**Process for each call site:**
1. Identify the exact location and code
2. Make the minimal change (replace alignTo with scrollToBottom)
3. Commit the change
4. User tests the specific scenario
5. If issues found, debug before moving to next
6. If successful, proceed to next call site

### Phase 3: Cleanup & Documentation

1. Remove any deprecated code comments
2. Update inline documentation
3. Update related spec documents
4. Final regression test of all scenarios

---

## Testing Strategy

### Critical Scenarios (Must Work After Changes)

**Scroll to bottom scenarios** (using new scrollToBottom):
1. ✅ Bootstrap/reload with equations in last message
2. ✅ G key navigation
3. ✅ D key on last message (when shorter than screen)
4. ✅ New message sent
5. ✅ New message arrival
6. ✅ Topic switch
7. ✅ Filter application (when active doesn't survive)
8. ✅ Delete message (shifts to last)
9. ✅ Re-ask
10. ✅ Settings change

**Top/center alignment** (unchanged, but verify no regression):
1. ✅ g key (first message, top align)
2. ✅ u/d keys (previous/next, top align) - MOST FREQUENT
3. ✅ o key (oldest unread, center align)
4. ✅ Long new message (top or center)

**Scrolling without alignment** (MUST NOT BREAK):
1. ✅ j/k keys - fixed step scroll with active message update
2. ✅ J/K keys (Shift+j/k) - large fixed step scroll with active message update

**Edge cases:**
1. ✅ Empty history
2. ✅ Single message
3. ✅ Filter application when active message survives (no scroll should occur)
4. ✅ User manual scroll (should update active message only)

---

## Code Changes Required

### 1. scrollControllerV3.js

```javascript
// Add new function after alignTo()
function scrollToBottom(animate=false){
  const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight)
  scrollTo(maxScroll, !!animate && animationEnabled)
  scheduleValidate()
}

// Update return object
return {
  measure: remeasure,
  alignTo,
  scrollToBottom,  // NEW
  ensureVisible,
  // ... rest
}
```

### 2. bootstrap.js

```javascript
// Before:
if(lastMessageAssistant && sc.alignTo){ 
  sc.alignTo(lastMessageAssistant.id, 'bottom', false) 
}

// After:
if(sc.scrollToBottom){ 
  sc.scrollToBottom(false) 
}
```

### 3. viewKeys.js (G key)

```javascript
// Before:
if(act && sc.alignTo){
  sc.alignTo(act.id, 'bottom', false)
}

// After:
if(sc.scrollToBottom){
  sc.scrollToBottom(false)
}
```

### 4. Similar pattern for other call sites

---

## Timeline Estimate

- **Phase 1** (Disable old + add new function): 30-45 minutes
- **Phase 2** (Update 10 call sites with testing): 2-3 hours
  - Each call site: ~15-20 minutes (change + test + debug if needed)
  - Grouped call sites faster (same file)
- **Phase 3** (Cleanup & documentation): 30 minutes
- **Total**: 3-4 hours for complete implementation with thorough testing

---

## Summary

This refactoring addresses a critical bug where messages with embedded KaTeX equations are incorrectly positioned on page load. The solution separates two conceptually different operations:

1. **Aligning a specific message** to a viewport position (top/center) - keeps using `alignTo()`
2. **Scrolling to the maximum position** (bottom of history) - new `scrollToBottom()`

The implementation will be done incrementally, with user testing after each call site change to ensure no regressions are introduced. The approach prioritizes:

- **Safety**: Disable old code first, add new functionality second
- **Testing**: User validates each scenario before proceeding
- **Clarity**: Clean separation of concerns in the API
- **Preservation**: All existing navigation patterns (j/k/u/d/g/G/o) continue to work

---

## Benefits Summary

### Immediate
- ✅ **Fixes equation alignment bug** (primary goal)
- ✅ **Improves performance** (no unnecessary measurements)
- ✅ **More reliable** (immune to content timing)

### Long-term
- ✅ **Cleaner API** (semantic clarity)
- ✅ **Easier maintenance** (separation of concerns)
- ✅ **Better encapsulation** (callers don't need to know "last partId")
- ✅ **Foundation for future improvements** (e.g., smooth scroll to bottom)

---

## Important Notes

### Exceptions to Activation+Scrolling Pattern

The document `/docs/scroll_alignment_investigation.md` notes that activation and scrolling are typically coupled, but there are important exceptions:

1. **User manual scroll** - `updateActiveOnScroll()` updates active message WITHOUT triggering scroll
2. **Filter application with surviving active** - When filter is applied and the currently active message remains in the filtered set, NO activation change and NO scrolling occurs
3. **j/k/J/K scrolling** - Fixed-step scrolling that updates active message according to viewport rules, but does NOT trigger alignment

### Preserved Functionality

**CRITICAL**: The following must continue to work exactly as before:
- j/k keys (small step scroll)
- J/K keys (large step scroll)  
- u/d keys (message navigation with top alignment)
- g/G keys (boundary navigation)
- o key (unread navigation with center alignment)
- User manual scrolling (mouse/trackpad)

---

## Next Steps

1. **Review & approval** of this document
2. **Implement Phase 1** (add scrollToBottom function)
3. **Test** with bootstrap reload scenario
4. **Iterate** through Phase 2 call sites one by one
5. **Update documentation** as we go

---

## Related Documents

- `/docs/ui_view_reading_behaviour.md` - Reading mode navigation
- `/docs/scroll_positioning_spec.md` - Scroll positioning requirements
- `/docs/new_message_workflow.md` - New message handling
- `/docs/focus_management.md` - Focus and active message management
