# Scroll & Alignment Investigation Report

**Date**: October 8, 2025  
**Context**: Response to questions about activation vs scrolling interaction and top alignment

---

## Question 1: Additional Scenarios (CONFIRMED)

Your corrections were accurate. I missed several important cases:

### Bottom Scroll Scenarios (Complete List):
1. **Bootstrap/Reload** ✓
2. **G key** ✓
3. **New message SENT** ⭐ (missed) - anchor sent user request to bottom
4. **New message arrival** ✓
5. **Topic switch with filter `t`** ✓
6. **Filter application** ✓
7. **Delete message** ✓
8. **Re-ask** ⭐ (missed) - focus shifts to last message
9. **D key special case** ⭐ (missed) - when focused message is last and less than screen height

### Top/Center Alignment Scenarios (Corrected):
1. **g key** - First message, align to top ✓
2. **u/d keys** ⭐ (CORRECTED) - align previous/next message to TOP (most frequent case!)
3. **o key** - Jump to oldest unread, align to center ✓
4. **j/k navigation** ❌ (REMOVED) - Reading mode no longer exists
5. **Long new message** - Context dependent (top or center)

---

## Question 2: Activation vs Scrolling Independence

### Current Implementation Analysis

**Pattern Found**: Activation and scrolling are **NOT independent** - they are tightly coupled in almost all call sites.

### Standard Pattern (95% of cases):
```javascript
// Step 1: Change active message
activeParts.setActiveById(id)  // or .last() or .first() etc.

// Step 2: Apply visual styling
historyRuntime.applyActiveMessage()

// Step 3: Scroll to position
scrollController.alignTo(id, position, animate)  // or scrollToBottom()
```

### Evidence from Codebase:

#### Example 1: u/d keys (viewKeys.js:133, 148)
```javascript
// d key - next message
activeParts.setActiveById(next.id)
historyRuntime.applyActiveMessage()
if(scrollController && scrollController.jumpToMessage){ 
  scrollController.jumpToMessage(next.id, isLast ? 'bottom' : 'top', animate) 
}

// u key - previous message
activeParts.setActiveById(prev.id)
historyRuntime.applyActiveMessage()
if(scrollController && scrollController.jumpToMessage){ 
  scrollController.jumpToMessage(prev.id, 'top', animate) 
}
```

#### Example 2: G key (viewKeys.js:98-99)
```javascript
activeParts.last()
historyRuntime.applyActiveMessage()
// Then scroll to bottom (in separate rAF)
```

#### Example 3: Filter apply (commandKeys.js:212)
```javascript
historyRuntime.renderCurrentView({ preserveActive: true })
historyRuntime.applyActiveMessage()
// Then double rAF → alignTo(id, 'bottom')
```

### The ONE Exception: User Scroll

**Location**: `historyRuntime.js` - `updateActiveOnScroll()`

When user scrolls manually (not programmatic scroll):
```javascript
function updateActiveOnScroll(){
  // Detects scroll direction
  // Finds which message is now in viewport
  // Changes activeParts.activeIndex directly
  // Calls applyActiveMessage() to update CSS
  // NO scroll call - user is already scrolling
}
```

This is the ONLY case where activation happens WITHOUT triggering scroll.

### Are They Independent?

**Answer: NO, they are tightly coupled by design**

**Rationale:**
1. **User expectation**: When you navigate to a message (g/G/u/d/o), you expect to SEE it
2. **Visual feedback**: The active message should be visible and properly positioned
3. **Consistency**: Every navigation command has a defined scroll position

**The Independence Exists At:**
- **API level**: `activeParts.setActiveById()` and `scrollController.alignTo()` are separate functions
- **Implementation level**: They are called sequentially, not bundled

**But NOT At:**
- **Usage level**: They are always called together (except for user scroll)
- **Behavioral level**: Changing active without scrolling would be confusing

### Recommendation

**Keep current coupling at usage level, but ensure API independence**

The pattern is correct:
```javascript
// Good: Clear separation of concerns
activeParts.setActiveById(id)      // State change
historyRuntime.applyActiveMessage() // Visual update  
scrollController.alignTo(id, pos)   // Viewport adjustment
```

NOT:
```javascript
// Bad: Hidden coupling
activeParts.setActiveAndScroll(id, pos)  // Too much magic
```

**Why this is good:**
1. ✅ **Testability**: Can test activation without DOM
2. ✅ **Flexibility**: Can add intermediate steps (logging, validation)
3. ✅ **Clarity**: Code shows explicit sequence
4. ✅ **Edge cases**: User scroll can update active without triggering scroll

---

## Question 3: Top Alignment Implementation

### Current Implementation

**Function**: `scrollController.alignTo(partId, 'top', animate)`

**How it works:**

1. **Measure** - Queries DOM for all message heights/positions
2. **Calculate** - Uses `anchorScrollTop(idx, 'top')`:
   ```javascript
   if(mode === 'top'){
     // Align top edge just below the top fade overlay
     S = padTop + part.start - fadeZone
   }
   ```
3. **Scroll** - Sets `container.scrollTop = S`

### Location in Code:

**File**: `src/features/history/scrollControllerV3.js`
**Line**: ~75-78 in `anchorScrollTop()` function

### Usage Patterns:

#### 1. u/d Keys (Most Frequent!)
```javascript
// viewKeys.js:148
activeParts.setActiveById(prev.id)
historyRuntime.applyActiveMessage()
scrollController.jumpToMessage(prev.id, 'top', animate)
```

**Note**: Uses `jumpToMessage()` which internally calls `alignTo(..., 'top')`

#### 2. g key (First Message)
```javascript
// viewKeys.js:86-87
activeParts.first()
historyRuntime.applyActiveMessage()
// Then alignTo() with 'top' in separate rAF
```

#### 3. Long New Message
```javascript
// newMessageLifecycle.js:58
if(firstId && alignTo){ 
  alignTo(firstId, 'top', false) 
}
```

### Issues With Current Top Alignment

**Similar to bottom alignment:**
1. **Measurement dependency** - Requires accurate message heights
2. **Timing sensitivity** - Must measure AFTER DOM fully rendered
3. **KaTeX equations** - Could affect measurement if equations in earlier messages

**But LESS problematic because:**
- Top-aligned messages are typically earlier in history
- User scroll usually gives time for content to render
- u/d navigation is incremental (content already visible)

### Top Alignment in Proposed Redesign

**With scrollToBottom() added, should we add scrollToTop()?**

**Recommendation: NO**

**Rationale:**
1. **Top alignment needs message ID** - Unlike bottom scroll, we're aligning a SPECIFIC message's top
2. **No timing issues in practice** - Top-aligned messages don't have equation rendering problems
3. **Current implementation works** - `alignTo(id, 'top')` is functioning correctly
4. **Semantic clarity preserved** - "Align message X to top" is semantically correct

**Keep current API:**
```javascript
scrollController.alignTo(messageId, 'top', animate)  // KEEP
scrollController.scrollToBottom(animate)              // NEW
```

NOT:
```javascript
scrollController.scrollToTop(animate)  // WRONG - which message?
```

### Center Alignment (o key)

**Current**: `alignTo(id, 'center', animate)` 
**Status**: Works correctly
**Change needed**: None

Formula:
```javascript
if(mode === 'center'){
  S = (part.start + padTop) + part.h/2 - (paneH/2)
}
```

---

## Summary & Recommendations

### 1. Additional Scenarios ✅
- **Confirmed**: Your corrections were accurate
- **Action**: Update Phase 2 call sites in refactoring doc

### 2. Activation vs Scrolling 🔄
- **Current**: Tightly coupled at usage level, independent at API level
- **Assessment**: **This is correct design**
- **Action**: Keep current pattern, document it clearly

### 3. Top Alignment ✅  
- **Current**: Works via `alignTo(id, 'top')`
- **Issues**: Minimal, no timing problems in practice
- **Action**: **No changes needed** - keep using alignTo()

### Updated Refactoring Scope

**Phase 1**: Add `scrollToBottom()` only
- Replaces: `alignTo(lastId, 'bottom')` calls
- Keeps: `alignTo(id, 'top')` and `alignTo(id, 'center')` unchanged

**Phase 2**: Update 9 call sites (was 6):
1. Bootstrap reload
2. G key
3. **New message sent** (added)
4. New message arrival
5. Topic switch
6. Filter application
7. Delete message
8. **Re-ask** (added)
9. **D key last message** (added)

**No changes needed for:**
- u/d keys (use 'top' correctly)
- g key (use 'top' correctly)
- o key (use 'center' correctly)
- Long message handling (use 'top'/'center' correctly)

---

## Architectural Insights

### Good Patterns Found:

1. **Clear API boundaries** - activeParts, historyRuntime, scrollController are separate
2. **Explicit sequencing** - Code shows: activate → style → scroll
3. **User scroll handling** - Special case that updates active without triggering scroll
4. **Double rAF for re-renders** - Ensures measurements are fresh

### Potential Improvements:

1. **Document the standard pattern** - Create a "Navigation Pattern Guide"
2. **Helper function** (optional):
   ```javascript
   function navigateAndAlign(messageId, position, animate) {
     activeParts.setActiveById(messageId)
     historyRuntime.applyActiveMessage()
     
     if(position === 'bottom' && isLastMessage(messageId)){
       scrollController.scrollToBottom(animate)
     } else {
       scrollController.alignTo(messageId, position, animate)
     }
   }
   ```
3. **Timing utilities** - Standardize the double rAF pattern:
   ```javascript
   function afterRender(callback) {
     requestAnimationFrame(() => {
       requestAnimationFrame(callback)
     })
   }
   ```

---

## Next Steps

1. **Update refactoring doc** with 9 call sites (not 6)
2. **Document standard navigation pattern** in new guide
3. **Proceed with Phase 1** implementation (scrollToBottom)
4. **Test each scenario** individually during Phase 2
5. **No changes needed** for top/center alignment

---

## Related Files

- `/docs/scroll_alignment_refactoring.md` - Main refactoring plan
- `/docs/scrolling_patterns.md` - Current patterns reference
- `/src/features/history/scrollControllerV3.js` - Scroll implementation
- `/src/features/history/historyRuntime.js` - Active message styling
- `/src/features/interaction/viewKeys.js` - Navigation keys (u/d/g/G/o)
