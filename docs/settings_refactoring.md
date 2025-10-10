# Settings Architecture Refactoring

**Date**: October 10, 2025  
**Status**: Analysis & Planning  
**Priority**: HIGH - Settings changes don't take effect immediately

---

## Problem Statement

Settings architecture has **multiple sources of truth** causing maintenance issues and bugs. When users change settings in the overlay and save them, changes are persisted to localStorage but don't take effect until the next reload or manual re-render trigger (like applying a filter).

### Root Cause

Settings keys are defined in **three separate locations** without synchronization:

1. **`core/settings/index.js`** - DEFAULTS object (source of truth for values)
2. **`runtime/renderPolicy.js`** - Classification for render behavior (rebuild/restyle/ignore)
3. **`features/config/settingsOverlay.js`** - HTML form controls for user input

When new settings are added, all three must be updated manually, leading to:
- ❌ Keys in DEFAULTS but missing from renderPolicy → no immediate re-render
- ❌ Legacy keys in renderPolicy but removed from DEFAULTS → dead code
- ❌ Form controls out of sync with available settings

---

## Current Architecture

### Settings Flow

```
User Opens Overlay
    ↓
Reads: getSettings() → DEFAULTS + localStorage
    ↓
Displays form with current values
    ↓
User modifies values
    ↓
User presses Ctrl+S (Save & Close)
    ↓
saveSettings(newValues) called
    ↓
├─ Writes to localStorage ✅
├─ Notifies all listeners (subscribeSettings callbacks)
│   ↓
│   main.js listener runs:
│   ├─ decideRenderAction(old, new)
│   │   ↓
│   │   Checks changed keys against renderPolicy.js
│   │   ├─ If in REBUILD_KEYS → 'rebuild' (full re-render)
│   │   ├─ If in RESTYLE_KEYS → 'restyle' (CSS update only)
│   │   ├─ If in IGNORE_KEYS → 'none' (no visual change)
│   │   └─ If NOT FOUND → 'none' ❌ BUG!
│   │
│   └─ Takes action based on result
└─ Overlay closes
```

### The Bug

**New spacing keys** (`messageGapPx`, `assistantGapPx`, etc.) are:
- ✅ Defined in DEFAULTS
- ✅ Have form controls in settingsOverlay
- ✅ Saved to localStorage correctly
- ❌ **Missing from renderPolicy.js**

**Result:** `decideRenderAction()` returns `'none'` instead of `'restyle'`, so no re-render happens.

**Settings work, but only after manual re-render** (reload, filter change, etc.)

---

## Legacy Settings Investigation

### Fade System (DEPRECATED - Not Used):
- `fadeMode` - Legacy fade visibility system (replaced by CSS gradients)
- `fadeHiddenOpacity` - Legacy fade system
- `fadeInMs` - Legacy fade system
- `fadeOutMs` - Legacy fade system
- `fadeTransitionMs` - Legacy fade system

**Evidence:** 
- `updateFadeVisibility()` is disabled everywhere (see historyRuntime.js comments)
- `applyFadeVisibility()` only called from disabled function
- CSS gradient overlays replaced this system

**Action:** Remove from schema, add migration to clean from localStorage

### Partition System (DEPRECATED - Not Used):
- `partFraction` - Legacy partition-based rendering (replaced by message-based)
- `partPadding` - Legacy partition system

**Evidence:**
- Message-based rendering replaced partition system
- Comments throughout codebase note removal

**Action:** Remove from schema, add migration to clean from localStorage

### Other Legacy Settings:
- `showTrimNotice` - Not found in use anywhere

**Action:** Remove from schema

---

## Discrepancies Audit

### Keys in DEFAULTS (31 total):
```javascript
// Composition (legacy)
partFraction

// Spacing (NEW - user-facing)
fadeZonePx, messageGapPx, assistantGapPx, messagePaddingPx, 
metaGapPx, gutterLPx, gutterRPx

// Visual/Fade - is this obsolete? we don't use fading anymore, do we?
fadeMode, fadeHiddenOpacity, fadeInMs, fadeOutMs, fadeTransitionMs

// Scroll Animation - is this used?
scrollAnimMs, scrollAnimEasing, scrollAnimDynamic, 
scrollAnimMinMs, scrollAnimMaxMs

// Navigation Animation - this is ok. 
animateSmallSteps, animateBigSteps, animateMessageJumps

// Context Assembly - ok
assumedUserTokens, userRequestAllowance, assistantResponseAllowance,
maxTrimAttempts, charsPerToken, showTrimNotice

// Other
topicOrderMode, useInlineFormatting
```

### Keys in renderPolicy.js (25 total):

**REBUILD_KEYS (5):**
```javascript
partFraction, partPadding*, userRequestAllowance, 
charsPerToken, useInlineFormatting
```
*partPadding = LEGACY (removed)

**RESTYLE_KEYS (15):**
```javascript
gapOuterPx*, gapMetaPx*, gapIntraPx*, gapBetweenPx*,
fadeMode, fadeHiddenOpacity, fadeInMs, fadeOutMs, fadeTransitionMs,
scrollAnimMs, scrollAnimEasing, scrollAnimDynamic, 
scrollAnimMinMs, scrollAnimMaxMs, showTrimNotice
```
*All gap keys = LEGACY (replaced by new spacing keys)

**IGNORE_KEYS (5):**
```javascript
topicOrderMode, assumedUserTokens, maxTrimAttempts,
assistantResponseAllowance, animateSmallSteps
```

### Missing from renderPolicy.js (11 NEW keys):

**Should be RESTYLE:**
- `fadeZonePx` - Fade zone size (spacing)
- `messageGapPx` - Gap between message pairs (spacing)
- `assistantGapPx` - Gap between user and assistant in pair (spacing)
- `messagePaddingPx` - Padding inside messages (spacing)
- `metaGapPx` - Gap for metadata line (spacing)
- `gutterLPx` - Left gutter (spacing)
- `gutterRPx` - Right gutter (spacing)

**Should be IGNORE:**
- `animateSmallSteps` - j/k animation preference (doesn't affect current display)
- `animateBigSteps` - J/K animation preference (doesn't affect current display)
- `animateMessageJumps` - u/d animation preference (doesn't affect current display)
- `assistantResponseAllowance` - Context assembly (future requests only)

### Legacy Keys in renderPolicy.js (5 OLD keys):

**Should be REMOVED:**
- `partPadding` - Removed from DEFAULTS (legacy)
- `gapOuterPx` - Replaced by messageGapPx
- `gapMetaPx` - Replaced by metaGapPx
- `gapIntraPx` - Replaced by assistantGapPx
- `gapBetweenPx` - Replaced by messageGapPx

---

## Proposed Solution

### Schema-Driven Architecture

**Single source of truth** for all settings with metadata:

```javascript
// core/settings/schema.js
export const SETTINGS_SCHEMA = {
  // Spacing
  fadeZonePx: {
    defaultValue: 20,
    category: 'spacing',
    renderAction: 'restyle',
    control: { type: 'number', min: 0, max: 120, step: 1 },
    label: 'Fade Zone (px)',
    tab: 'spacing',
  },
  messageGapPx: {
    defaultValue: 10,
    category: 'spacing',
    renderAction: 'restyle',
    control: { type: 'number', min: 0, max: 60, step: 1 },
    label: 'Message Gap (px)',
    tab: 'spacing',
  },
  // ... all settings defined here
  
  useInlineFormatting: {
    defaultValue: false,
    category: 'formatting',
    renderAction: 'rebuild',  // Affects rendering
    control: { type: 'checkbox' },
    label: 'Inline Markdown Formatting (experimental)',
    tab: 'visibility',
  },
  
  topicOrderMode: {
    defaultValue: 'manual',
    category: 'ui',
    renderAction: 'none',  // Overlay-only preference
    control: { type: 'select', options: ['manual', 'alpha', 'recent'] },
    label: 'Topic Order Mode',
    tab: 'context',
  },
}

// Derived automatically:
export const DEFAULTS = Object.fromEntries(
  Object.entries(SETTINGS_SCHEMA).map(([key, config]) => [key, config.defaultValue])
)

export const REBUILD_KEYS = new Set(
  Object.entries(SETTINGS_SCHEMA)
    .filter(([_, config]) => config.renderAction === 'rebuild')
    .map(([key]) => key)
)

export const RESTYLE_KEYS = new Set(
  Object.entries(SETTINGS_SCHEMA)
    .filter(([_, config]) => config.renderAction === 'restyle')
    .map(([key]) => key)
)

export const IGNORE_KEYS = new Set(
  Object.entries(SETTINGS_SCHEMA)
    .filter(([_, config]) => config.renderAction === 'none')
    .map(([key]) => key)
)
```

### Form Generation

**IMPORTANT:** We'll use a **hybrid approach** to preserve existing styling:

#### What We DON'T Auto-Generate:
- Overall form structure (tabs, fieldsets, buttons)
- CSS classes and styling
- Layout and spacing
- Tab structure and navigation
- Keyboard shortcuts (j/k, +/-, etc.)

#### What We DO Auto-Generate:
- **Form controls content only** - the `<label><input></label>` elements
- Input attributes (name, type, min, max, step, value)
- Labels and help text

#### Implementation Approach:

**Keep existing HTML structure:**
```javascript
// settingsOverlay.js - KEEP THIS
root.innerHTML = `
  <div class="overlay-panel settings-panel compact">
    <header>Settings</header>
    <div class="settings-tabs" role="tablist">
      ${tabButtons}  <!-- Keep manual -->
    </div>
    <div class="settings-body">
      <form id="settingsForm">
        <div class="tab-section" data-tab-section="spacing">
          <fieldset class="spacing-fieldset">
            <legend>Spacing</legend>
            ${generateControlsForTab('spacing')}  <!-- AUTO-GENERATE -->
          </fieldset>
        </div>
        <!-- More tabs... -->
      </form>
    </div>
  </div>
`
```

**Auto-generate only control HTML:**
```javascript
function generateControlsForTab(tabName) {
  return Object.entries(SETTINGS_SCHEMA)
    .filter(([_, config]) => config.tab === tabName)
    .map(([key, config]) => {
      const value = existing[key] ?? config.defaultValue
      
      if (config.control.type === 'number') {
        return `<label>${config.label}
          <input name="${key}" type="number" 
                 step="${config.control.step}" 
                 min="${config.control.min}" 
                 max="${config.control.max}" 
                 value="${value}" />
        </label>`
      }
      
      if (config.control.type === 'checkbox') {
        return `<label>
          <input type="checkbox" name="${key}" ${value ? 'checked' : ''} />
          ${config.label}
        </label>`
      }
      
      if (config.control.type === 'select') {
        const options = config.control.options
          .map(opt => `<option value="${opt}" ${opt === value ? 'selected' : ''}>${opt}</option>`)
          .join('')
        return `<label>${config.label}
          <select name="${key}">${options}</select>
        </label>`
      }
    })
    .join('\n')
}
```

**Benefits:**
- ✅ **Zero styling changes** - CSS stays the same
- ✅ **DRY for controls** - No duplication of input definitions
- ✅ **Maintainable** - Add setting in schema, control appears automatically
- ✅ **Safe** - All existing behavior preserved (tabs, keyboard shortcuts, etc.)

**Concerns Addressed:**
- Font, spacing, colors, borders → All preserved (CSS unchanged)
- Tab navigation → Manual (unchanged)
- Keyboard shortcuts (j/k, +/-) → Manual (unchanged)
- Form validation → Manual (unchanged)
- Button behavior → Manual (unchanged)

**What Changes:**
- Only the `<label><input>` HTML is generated from schema
- Adding a new setting = add to schema, control appears automatically
- No more manual HTML for each individual control

**Time Impact:**
- Initial setup: 2-3 hours (write generation functions)
- Testing: 1 hour (verify all controls work, styling preserved)
- **NO style fixing needed** - we're not changing CSS at all

---

## Implementation Plan

### Phase 1: Audit & Document (COMPLETED)
- ✅ Identify all discrepancies
- ✅ Document current architecture
- ✅ Create this refactoring plan

### Phase 2: Clean Up Legacy Settings
**Goal:** Remove unused settings to simplify schema

**Tasks:**
1. Remove legacy fade settings from DEFAULTS
2. Remove legacy partition settings from DEFAULTS
3. Add migration logic in `loadSettings()` to delete these from localStorage
4. Update renderPolicy.js to remove legacy keys
5. Remove controls from settingsOverlay.js

**Settings to Remove:**
- `fadeMode`, `fadeHiddenOpacity`, `fadeInMs`, `fadeOutMs`, `fadeTransitionMs`
- `partFraction`, `partPadding`
- `showTrimNotice`

**Testing:** Verify existing localStorage still loads, legacy keys cleaned

**Time:** 30-45 minutes

### Phase 3: Design Schema Structure (Planning)
**Goal:** Define comprehensive schema format

**Tasks:**
- Define schema metadata structure  
- Determine control types needed (number, checkbox, select)
- Plan validation rules (min/max, step)
- Design category/grouping system
- Consider JSDoc for type documentation
- Define migration strategy for localStorage

**Decisions Needed:**
1. Schema format (plain JS object - DECIDED)
2. Control types supported (number, checkbox, select - DECIDED)
3. How to handle special controls (if any exist)
4. Migration approach for legacy keys

**Time:** 2-3 hours discussion + documentation

### Phase 4: Implement Schema (Refactoring)
**Goal:** Create single source of truth

**Tasks:**
1. Create `core/settings/schema.js`
2. Define all settings with full metadata
3. Generate DEFAULTS from schema
4. Update `core/settings/index.js` to use schema
5. Test localStorage compatibility

**Testing:** Verify all existing settings still work

**Time:** 2-3 hours

### Phase 5: Auto-Generate renderPolicy (Refactoring)
**Goal:** Eliminate manual key classification

**Tasks:**
1. Update `runtime/renderPolicy.js` to import from schema
2. Remove hardcoded key lists
3. Generate REBUILD_KEYS, RESTYLE_KEYS, IGNORE_KEYS from schema
4. Test render behavior

**Testing:** Verify re-render behavior unchanged

**Time:** 1 hour

### Phase 6: Auto-Generate Form Controls (Hybrid Approach)
**Goal:** DRY for settings controls while preserving styling

**Tasks:**
1. Create control generation functions (generateControlsForTab)
2. Update settingsOverlay.js to use schema for control HTML only
3. Keep all existing: structure, CSS, tabs, keyboard shortcuts, buttons
4. Test each tab's controls work correctly
5. Verify all styling preserved

**What Changes:** Only `<label><input>` HTML generated from schema
**What Stays:** Everything else (CSS, layout, behavior, shortcuts)

**Testing:** 
- All controls appear correctly
- All styling identical to before
- All keyboard shortcuts work (j/k, +/-, etc.)
- All tabs work
- All buttons work

**Time:** 2-3 hours

### Phase 7: Cleanup (Final)
**Goal:** Remove all duplication

**Tasks:**
- Remove legacy code comments
- Update documentation
- Add JSDoc types
- Final testing

**Time:** 1 hour

---

## Benefits

### After Phase 2 (Legacy Cleanup)
- ✅ Simpler codebase - 9 fewer unused settings
- ✅ Cleaner localStorage
- ✅ Less confusion for developers

### After Full Refactoring (Phase 7)
- ✅ **Single source of truth** - Settings defined once in schema
- ✅ **DRY principle** - No duplication of control definitions
- ✅ **Maintainability** - Add settings in one place, everything updates
- ✅ **Type safety** - Schema provides documentation via JSDoc
- ✅ **Consistency** - Auto-generated controls always match schema
- ✅ **Validation** - Schema enforces rules (min/max, step, etc.)
- ✅ **Extensibility** - Easy to add new setting types
- ✅ **Testing** - Schema makes testing easier
- ✅ **No styling issues** - Hybrid approach preserves all CSS
- ✅ **Settings work immediately** - renderPolicy auto-synced with schema

---

## Risks & Considerations

### localStorage Compatibility
- Must ensure existing saved settings still load correctly
- Migration logic removes legacy keys cleanly
- New schema should support future migrations

### Form Generation Complexity
- **MITIGATED:** Hybrid approach - only controls auto-generated
- Styling, layout, behavior all manual (preserved)
- Special controls can be added manually if needed

### Performance
- Schema lookup overhead (negligible - only at load time)
- Form generation happens once per overlay open
- No runtime performance impact

### Backward Compatibility
- Users may have legacy keys in localStorage
- Migration in `loadSettings()` removes them on next load
- No breaking changes for users

---

## Decision Points

**Resolved:**
1. ✅ **Schema format:** Plain JS object with metadata
2. ✅ **Form generation:** Hybrid - controls only, preserve structure/CSS
3. ✅ **Control types:** number, checkbox, select (sufficient for all current settings)
4. ✅ **Legacy cleanup:** Remove unused fade/partition settings
5. ✅ **No quick fixes:** Proper refactoring only

**Still to decide:**
1. Migration strategy for localStorage (clean on load vs versioned migration)
2. Whether to add JSDoc types or keep plain JS

---

## Next Steps

1. **Phase 2:** Clean up legacy settings (~45 min)
2. **Phase 3:** Finalize schema structure design (~2-3 hours)
3. **Phase 4-7:** Implement incrementally with testing

**Estimated Total Time:** 10-12 hours of work, spread across multiple sessions

---

## Related Documents

- `/docs/ARCHITECTURE.md` - Overall app architecture
- `/docs/scroll_alignment_refactoring.md` - Similar refactoring approach
- `/src/core/settings/index.js` - Current settings implementation
- `/src/runtime/renderPolicy.js` - Current render decision logic
- `/src/features/config/settingsOverlay.js` - Settings UI
