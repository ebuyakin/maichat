# Settings Render Actions Analysis

## Problem
Changing `historyBgLightness` (background color) triggers scrolling/repositioning of the history, even though it only changes CSS color and doesn't affect layout.

## Root Cause
`historyBgLightness` has `renderAction: 'restyle'` in schema, which triggers the **'restyle' branch** in the settings subscriber that includes scroll repositioning.

---

## How Settings Changes Are Processed

### 1. **Settings Change Flow**
```
User changes setting in Settings overlay
  ↓
saveSettings(newValues) 
  ↓
Triggers subscribeSettings() listeners
  ↓
main.js listener (line 222-268)
  ↓
decideRenderAction(oldSettings, newSettings)
  ↓
Returns: 'none' | 'restyle' | 'rebuild'
```

### 2. **Decision Logic** (`renderPolicy.js`)

```javascript
function decideRenderAction(prev, next) {
  const changed = diffChangedKeys(prev, next)
  if (changed.length === 0) return 'none'
  
  for (const k of changed) {
    if (IGNORE_KEYS.has(k)) continue      // → 'none' (unless other keys changed)
    if (REBUILD_KEYS.has(k)) return 'rebuild'  // → 'rebuild' (highest priority)
    if (RESTYLE_KEYS.has(k)) needsRestyle = true // → 'restyle' (if no rebuild)
  }
  
  return needsRestyle ? 'restyle' : 'none'
}
```

**Keys are categorized by `renderAction` in schema**:
- `renderAction: 'rebuild'` → Added to `REBUILD_KEYS`
- `renderAction: 'restyle'` → Added to `RESTYLE_KEYS`
- `renderAction: 'none'` → Added to `IGNORE_KEYS`

---

## Three Action Branches

### Branch 1: `action === 'rebuild'`

**When**: Settings that change HTML structure or content
- `useInlineFormatting` (changes markdown rendering)

**What happens** (lines 235-249):
```javascript
applySpacingStyles(s)          // Update CSS variables
layoutHistoryPane()             // Recalculate historyPane top/bottom
renderCurrentView({ preserveActive: true })  // FULL RE-RENDER
alignTo(activeId, 'top', false) // Scroll active to top (non-animated)
```

**Result**: Complete HTML rebuild + repositioning

---

### Branch 2: `action === 'restyle'` ⚠️ **THE PROBLEM**

**When**: Settings that only change CSS/appearance
- All spacing settings: `fadeZonePx`, `messageGapPx`, `assistantGapPx`, `messagePaddingPx`, `metaGapPx`, `gutterLPx`, `gutterRPx`
- **`historyBgLightness`** (our new setting)

**What happens** (lines 250-265):
```javascript
applySpacingStyles(s)              // Update CSS variables (including --history-bg)
layoutHistoryPane()                 // Recalculate historyPane dimensions
scrollController.remeasure()       // ← MEASURES element heights/positions
scrollController.alignTo(activeId, 'top', false)  // ← SCROLLS to active message
```

**Why this causes scrolling**:

1. **`remeasure()`** → calls `measure()`:
   - Queries all `.message` and `.part` elements
   - Reads `offsetHeight` and `offsetTop` for each
   - Calculates `parts[]` array with positions

2. **`alignTo(activeId, 'top')`**:
   - Calculates scroll position to put active message at top
   - Sets `container.scrollTop` programmatically
   - Moves the view **even if layout didn't change**

**The issue**: Background color changes trigger remeasure + scroll repositioning, but **don't affect element dimensions or positions**.

---

### Branch 3: `action === 'none'`

**When**: Settings that don't affect current view
- All scroll animation settings: `scrollAnimMs`, `scrollAnimDynamic`, etc.
- All context assembly settings: `userRequestAllowance`, `charsPerToken`, etc.
- `topicOrderMode`

**What happens** (lines 266-268):
```javascript
// no-op for view; still allow other subscribers to react
```

**Result**: Nothing. Settings saved, but no visual update.

---

## Why Other Spacing Settings Need Repositioning

**Settings that change element dimensions**:
- `messageGapPx` → Changes gaps between messages → affects `offsetTop` of all messages
- `messagePaddingPx` → Changes height of messages → affects `offsetHeight`
- `gutterLPx/gutterRPx` → Changes historyPane width → might cause text reflow
- `fadeZonePx` → Changes container padding → affects scroll calculations

**These legitimately need**:
1. `remeasure()` - element positions/heights changed
2. `alignTo()` - keep active message in view after layout shift

**But `historyBgLightness` only changes**:
- `--history-bg` CSS variable (color)
- No element dimensions
- No positions
- No layout

---

## The Fix Options

### Option 1: Change to `renderAction: 'none'`

**In `schema.js`**:
```javascript
historyBgLightness: {
  defaultValue: 7,
  renderAction: 'none',  // ← Change from 'restyle'
  control: { type: 'number', min: 0, max: 20, step: 1 },
  ui: { label: 'History Background Lightness (%)', tab: 'spacing' },
},
```

**Result**: Setting changes don't trigger remeasure/scroll

**Problem**: `applySpacingStyles()` won't be called, so CSS variable won't update!

---

### Option 2: Create New Action Category

Add a fourth category: **`renderAction: 'recolor'`** (or `'css-only'`)

**In `schema.js`**:
```javascript
renderAction: 'recolor',
```

**In `renderPolicy.js`**, add:
```javascript
export const RECOLOR_KEYS = new Set(
  Object.entries(SETTINGS_SCHEMA)
    .filter(([_, config]) => config.renderAction === 'recolor')
    .map(([key]) => key)
)
```

**In `main.js`**, add new branch:
```javascript
} else if (action === 'recolor') {
  applySpacingStyles(s)  // Update CSS variables only
  // NO layoutHistoryPane()
  // NO remeasure()
  // NO alignTo()
}
```

**Problem**: Adds complexity for one setting. Overkill.

---

### Option 3: Split `applySpacingStyles()` ✅ **RECOMMENDED**

Keep `renderAction: 'restyle'`, but make remeasure/scroll **conditional**.

**Current problem**: ALL 'restyle' settings trigger remeasure + scroll

**Solution**: Only trigger remeasure/scroll for settings that **affect layout**.

#### Implementation:

**In `schema.js`**, add metadata:
```javascript
historyBgLightness: {
  defaultValue: 7,
  renderAction: 'restyle',
  affectsLayout: false,  // ← NEW metadata
  control: { type: 'number', min: 0, max: 20, step: 1 },
  ui: { label: 'History Background Lightness (%)', tab: 'spacing' },
},
```

**Mark other spacing settings**:
```javascript
fadeZonePx: {
  renderAction: 'restyle',
  affectsLayout: true,  // Changes container padding → affects scroll
  ...
},
messageGapPx: {
  renderAction: 'restyle',
  affectsLayout: true,  // Changes element positions
  ...
},
// etc.
```

**In `renderPolicy.js`**, add:
```javascript
export function decideRestyleType(prev, next) {
  const changed = diffChangedKeys(prev, next)
  let affectsLayout = false
  
  for (const k of changed) {
    if (RESTYLE_KEYS.has(k)) {
      const config = SETTINGS_SCHEMA[k]
      if (config.affectsLayout) {
        affectsLayout = true
        break
      }
    }
  }
  
  return affectsLayout ? 'restyle-layout' : 'restyle-appearance'
}
```

**In `main.js`**, split the branch:
```javascript
} else if (action === 'restyle') {
  applySpacingStyles(s)
  layoutHistoryPane()
  
  const restyleType = decideRestyleType(__prevSettings, s)
  
  if (restyleType === 'restyle-layout') {
    // Settings that change dimensions/positions
    scrollController.remeasure()
    scrollController.alignTo(activeId, 'top', false)
  }
  // else: appearance-only changes (like background color) - no scroll
}
```

**Benefits**:
- ✅ Preserves existing architecture
- ✅ Extensible (future CSS-only settings can use `affectsLayout: false`)
- ✅ Clear semantics ("does this setting move things around?")
- ✅ Minimal changes

---

### Option 4: Check Changed Keys Directly ✅ **SIMPLEST**

Skip the metadata, just check which specific keys changed.

**In `main.js`**, modify restyle branch:
```javascript
} else if (action === 'restyle') {
  applySpacingStyles(s)
  layoutHistoryPane()
  
  // Only remeasure/scroll if layout-affecting settings changed
  const changed = diffChangedKeys(__prevSettings, s)
  const layoutKeys = ['fadeZonePx', 'messageGapPx', 'assistantGapPx', 
                      'messagePaddingPx', 'metaGapPx', 'gutterLPx', 'gutterRPx']
  const layoutChanged = changed.some(k => layoutKeys.includes(k))
  
  if (layoutChanged) {
    scrollController.remeasure()
    scrollController.alignTo(activeId, 'top', false)
  }
  // else: only appearance changed (like historyBgLightness) - no scroll
}
```

**Benefits**:
- ✅ Simplest to implement
- ✅ No schema changes
- ✅ Clear and explicit
- ✅ Easy to maintain (just update the array when adding layout-affecting settings)

**Tradeoff**:
- ⚠️ Hardcoded list in main.js (not schema-driven)
- ⚠️ Must remember to update list when adding new spacing settings

---

## Recommendation

**Use Option 4** (simplest):
- Add conditional logic in main.js restyle branch
- Check if changed keys include layout-affecting settings
- Only remeasure/scroll if layout changed
- Background color changes apply CSS only, no scroll

**Future**: If more CSS-only settings are added, consider Option 3 (metadata-driven).

---

## Summary

| Setting Type | renderAction | Affects Layout? | Current Behavior | Desired Behavior |
|--------------|--------------|-----------------|------------------|------------------|
| `useInlineFormatting` | `rebuild` | Yes | Full rebuild + scroll | ✅ Correct |
| `messageGapPx` etc. | `restyle` | Yes | CSS + remeasure + scroll | ✅ Correct |
| `historyBgLightness` | `restyle` | **No** | CSS + remeasure + scroll | ❌ Should be: CSS only |
| `scrollAnimMs` etc. | `none` | No | Nothing | ✅ Correct |

**Root issue**: 'restyle' conflates two different needs:
1. CSS updates that change layout (need remeasure)
2. CSS updates that don't change layout (just apply CSS)

**Solution**: Differentiate within the 'restyle' branch.
