# Scrolling Patterns Reference

Date: 2025-10-05
Status: Living document describing current implementation patterns

## Overview

Three independent operations that can be combined:
1. **Re-render history** - rebuild DOM based on filter/settings/new data
2. **Change active message** - update which message/part is focused
3. **Scroll/anchor** - position viewport to show target message

## Core Components

### ScrollController (`src/features/history/scrollControllerV3.js`)
- **Purpose**: Single owner of `scrollTop`, provides stateless alignment API
- **Key methods**:
  - `alignTo(partId, 'top'|'bottom'|'center', animate)` - align specific part to position
  - `ensureVisible(partId, animate)` - minimal scroll to make part visible
  - `remeasure()` - update internal metrics after DOM changes

### HistoryRuntime (`src/features/history/historyRuntime.js`)
- **Purpose**: Renders message history DOM
- **Key methods**:
  - `renderCurrentView({ preserveActive })` - rebuild history view
  - `applyActiveMessage()` - apply CSS classes to active message (no scroll)

### ActiveParts (`src/features/history/activeParts.js`)
- **Purpose**: Tracks which message part is currently focused
- **Key methods**:
  - `active()` - get current active part
  - `setActiveById(id)` - change active part
  - `last()` - focus last part (fallback when preserved part not found)

## Critical Timing Pattern

### Problem: Stale Measurements
When you render history and immediately call `alignTo`, the DOM may not be fully laid out yet, causing incorrect scroll positioning.

### Solution: Double requestAnimationFrame
```javascript
// After rendering:
historyRuntime.renderCurrentView({ preserveActive: true })

// Wait for layout to complete:
requestAnimationFrame(() => {           // 1st rAF: DOM rendered
  requestAnimationFrame(() => {         // 2nd rAF: layout complete
    const act = activeParts.active()
    if (act && scrollController && scrollController.alignTo) {
      scrollController.alignTo(act.id, 'bottom', false)
    }
  })
})
```

**Why double rAF?**
- 1st rAF: Browser has rendered new DOM
- 2nd rAF: Browser has completed layout and measurements
- Now `scrollController.alignTo` → `measure()` gets accurate positions

## Common Patterns by Scenario

### Pattern A: Filter Apply (Command Mode → Enter)
**Operations**: Re-render + Change active (preserve or last) + Scroll (bottom-align)

**Location**: `src/features/interaction/commandKeys.js`

**Code**:
```javascript
historyRuntime.renderCurrentView({ preserveActive: true })
// preserveActive: keeps focused part if still present, else falls back to last

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const act = activeParts.active()
    const id = act && act.id
    if (id && scrollController && scrollController.alignTo) {
      scrollController.alignTo(id, 'bottom', false)
    }
  })
})
```

### Pattern B: Topic Selection (Changes pending topic, may refresh if filter active)
**Operations**: Update metadata + Maybe re-render + Maybe scroll

**Location**: `src/features/interaction/interaction.js` → `openQuickTopicPicker`, `openChronoTopicPicker`

**Code**:
```javascript
pendingMessageMeta.topicId = topicId
renderPendingMeta()

// If filter contains bare 't', refresh history:
const currentFilter = lifecycle.getFilterQuery()
if (currentFilter) {
  const ast = parse(currentFilter)
  if (hasUnargumentedTopicFilter(ast)) {
    historyRuntime.renderCurrentView({ preserveActive: true })
    
    // Align after render completes:
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const act = activeParts.active()
        if (act && scrollController && scrollController.alignTo) {
          scrollController.alignTo(act.id, 'bottom', false)
        }
      })
    })
  }
}
```

### Pattern C: Send Message
**Operations**: Re-render + Focus new message + Scroll (bottom-align meta)

**Location**: `src/features/interaction/inputKeys.js`

**Code**:
```javascript
// After creating new message pair and rendering:
historyRuntime.renderCurrentView({ preserveActive: false })

// Focus last user part and align:
if (id && scrollController && scrollController.alignTo) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      scrollController.alignTo(`${id}:u`, 'bottom', false)
    })
  })
}
```

### Pattern D: Navigation (j/k keys)
**Operations**: Change active + Scroll (ensure visible - minimal movement)

**Location**: `src/features/interaction/viewKeys.js`

**Code**:
```javascript
// j/k just changes active, scrollController handles ensure-visible automatically
activeParts.next() // or prev()
historyRuntime.applyActiveMessage() // updates CSS only, no scroll

// ScrollController's internal logic applies ensure-visible on next frame
```

**Note**: Navigation does NOT use double rAF because no re-render happens - just CSS changes

### Pattern E: Jump to Boundary (o/O key)
**Operations**: Change active + Scroll (center-align)

**Location**: `src/features/interaction/viewKeys.js`

**Code**:
```javascript
// Jump to first in-context message:
const boundary = boundaryMgr.getBoundary()
const firstIncludedId = boundary.included[0]?.id
if (firstIncludedId) {
  activeParts.setActiveByPairId(firstIncludedId)
  historyRuntime.applyActiveMessage()
  
  const act = activeParts.active()
  if (act && scrollController && scrollController.alignTo) {
    scrollController.alignTo(act.id, 'center', false)
  }
}
```

**Note**: No double rAF needed - no re-render, just focus change

### Pattern F: Settings Change (requires rebuild)
**Operations**: Re-render + Preserve active + Scroll (bottom-align)

**Location**: `src/main.js` settings subscriber

**Code**:
```javascript
historyRuntime.renderCurrentView({ preserveActive: true })

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const act = activeParts.active()
    if (act && scrollController && scrollController.alignTo) {
      scrollController.alignTo(act.id, 'bottom', false)
    }
  })
})
```

## Decision Tree

### When to use double rAF?
```
Does the operation call historyRuntime.renderCurrentView()?
├─ YES → Use double rAF before alignTo
└─ NO → Direct call to alignTo is fine
```

### When to use preserveActive: true?
```
Should the currently focused message stay focused after render?
├─ YES (filter apply, settings change, topic switch)
│   └─ Use preserveActive: true
│       (falls back to last if current not in new set)
└─ NO (new message sent, explicit navigation)
    └─ Use preserveActive: false or omit
```

### Which alignment position?
- **'bottom'**: Most common - filter apply, send, topic switch, G key
- **'top'**: First message (g key), boundary jump context display
- **'center'**: Boundary jump (o key), typewriter mode

## Common Mistakes to Avoid

### ❌ Calling alignTo immediately after renderCurrentView
```javascript
// WRONG - measurements will be stale:
historyRuntime.renderCurrentView({ preserveActive: true })
scrollController.alignTo(id, 'bottom', false) // ← too early!
```

### ❌ Single rAF when re-rendering
```javascript
// WRONG - layout might not be complete:
historyRuntime.renderCurrentView({ preserveActive: true })
requestAnimationFrame(() => {
  scrollController.alignTo(id, 'bottom', false) // ← needs 2nd rAF!
})
```

### ❌ Double rAF when NOT re-rendering
```javascript
// UNNECESSARY - wastes frames:
activeParts.next()
historyRuntime.applyActiveMessage() // just CSS, no DOM rebuild
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    scrollController.alignTo(id, 'bottom', false) // ← overkill
  })
})
```

### ✅ Correct: Match timing to operation
```javascript
// Re-render? → double rAF
// Just CSS/focus? → direct call or single rAF
```

## When Things Go Wrong

### Symptom: Scroll position is incorrect after history change
**Likely cause**: Missing double rAF after `renderCurrentView`
**Fix**: Add double rAF wrapper around `alignTo` call

### Symptom: Scroll jumps unexpectedly during navigation
**Likely cause**: Calling `alignTo` when `ensureVisible` should be used
**Fix**: Review - navigation should use ensure-visible (automatic), not explicit alignTo

### Symptom: Active message not visible after filter apply
**Likely cause**: Not calling `alignTo` after render, or wrong timing
**Fix**: Ensure double rAF pattern is used after `renderCurrentView`

## Future Improvements (Not Now)

Ideas for later consideration:
- Centralized "align after render" helper function
- Unified rendering + alignment coordinator
- Better separation of concerns between runtime and scroll

For now: **Follow the patterns above consistently**

## See Also

- `docs/scroll_positioning_spec.md` - Behavioral specification
- `docs/focus_management.md` - Focus and modal handling
- `src/features/history/scrollControllerV3.js` - Implementation
