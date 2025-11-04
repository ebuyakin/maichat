# History Background Settings Implementation Plan

## Overview
Add `historyBgLightness` setting to allow users to adjust background contrast from Settings overlay.

---

## Current State

### 1. **CSS Variable** (`variables.css`)
```css
--history-bg: hsl(0, 0%, 7%);
```
- **Hardcoded value**: 7% lightness
- **Used by**: 
  - `body { background: var(--history-bg) }` in `base.css`
  - Gradient overlays in `layout.css`

### 2. **No Setting Exists**
- Not in `schema.js`
- Not in Settings UI
- Not applied by `spacingStyles.js`
- Not preloaded by `preloadState.js`

---

## Changes Required

### 1. **Add to Settings Schema** (`src/core/settings/schema.js`)

Add new setting after `gutterRPx`:

```javascript
historyBgLightness: {
  defaultValue: 7,
  renderAction: 'restyle',
  control: { type: 'number', min: 0, max: 20, step: 1 },
  ui: { label: 'History Background Lightness (%)', tab: 'spacing' },
},
```

**Why these values**:
- `defaultValue: 7` - matches current `variables.css` value (7%)
- `renderAction: 'restyle'` - only CSS update needed, no HTML rebuild
- `min: 0, max: 20` - 0% = pure black, 20% = light gray (practical range)
- `step: 1` - whole percentages for simplicity
- `tab: 'spacing'` - groups with other visual spacing settings

---

### 2. **Apply at Runtime** (`src/features/history/spacingStyles.js`)

Add to `applySpacingStyles()` function after gutters:

```javascript
if (Number.isFinite(gutterRPx)) root.style.setProperty('--gutter-r', `${gutterRPx}px`)

// NEW: Apply history background lightness
if (Number.isFinite(historyBgLightness)) {
  root.style.setProperty('--history-bg', `hsl(0, 0%, ${historyBgLightness}%)`)
}
```

Also add to function parameters destructuring:

```javascript
const {
  fadeZonePx,
  messageGapPx,
  // ... existing params ...
  gutterRPx,
  historyBgLightness,  // NEW
  fadeInMs = 120,
  // ...
} = settings
```

---

### 3. **Preload for FOUC Prevention** (`src/runtime/preloadState.js`)

Add to `applySpacingVars()` function after gutters:

```javascript
if (typeof s.gutterRPx === 'number') root.setProperty('--gutter-r', s.gutterRPx + 'px')

// NEW: Preload history background
if (typeof s.historyBgLightness === 'number') {
  root.setProperty('--history-bg', `hsl(0, 0%, ${s.historyBgLightness}%)`)
}
```

**Why this is needed**: Prevents flash of wrong background on page load. Sets CSS variable BEFORE first paint.

---

### 4. **Settings Overlay UI** (`src/features/config/settingsOverlay.js`)

#### 4a. Auto-Generated Control ✅
**No code needed!** The control is automatically generated from schema by `generateControlsForTab()`.

The schema entry will create:
```html
<label>History Background Lightness (%)
  <input name="historyBgLightness" type="number" 
         step="1" min="0" max="20" value="7" />
</label>
```

#### 4b. Add to `readFormValues()` function:

After `gutterRPx`:

```javascript
const gutterRPx = clampRange(parseInt(fd.get('gutterRPx')), 0, 60)
const historyBgLightness = clampRange(parseInt(fd.get('historyBgLightness')), 0, 20)  // NEW
const useInlineFormatting = !!fd.get('useInlineFormatting')
```

And in the return statement:

```javascript
return {
  fadeZonePx,
  messageGapPx,
  // ... existing fields ...
  gutterRPx,
  historyBgLightness,  // NEW
  useInlineFormatting,
  // ... rest of fields ...
}
```

#### 4c. Add to `populateFormFromSettings()` function:

After `gutterRPx`:

```javascript
setNum('gutterLPx', s.gutterLPx)
setNum('gutterRPx', s.gutterRPx)
setNum('historyBgLightness', s.historyBgLightness)  // NEW
const uif = form.querySelector('input[name="useInlineFormatting"]')
```

---

### 5. **Remove Hardcoded Value** (`src/styles/variables.css`)

**Keep the variable** but update the comment:

```css
/* History background lightness - default fallback (overridden by settings) */
--history-bg: hsl(0, 0%, 7%);
```

**Why keep it**: Provides fallback for FOUC before JavaScript loads settings.

---

## Data Flow

### On Page Load:
```
1. variables.css loads
   → --history-bg: hsl(0,0%,7%)  [fallback]

2. preloadState.js runs (BEFORE first paint)
   → reads localStorage
   → if historyBgLightness exists: overrides CSS variable
   → applySpacingVars() sets --history-bg

3. base.css applies
   → body { background: var(--history-bg) }
   → uses value from step 2 (or fallback from step 1)

4. App renders with correct background
```

### When User Changes Setting:
```
1. User adjusts slider in Settings overlay
   → form value changes

2. User clicks "Save & Close"
   → readFormValues() reads form
   → saveSettings() writes to localStorage
   → triggers settings listeners

3. Settings listener in main.js
   → decideRenderAction() returns 'restyle'
   → applySpacingStyles() called
   → sets --history-bg CSS variable

4. Background updates immediately (no page reload)
```

---

## Storage & Defaults

### New Users (No localStorage):
```javascript
// schema.js DEFAULTS object automatically includes:
{ historyBgLightness: 7 }  // from defaultValue in schema
```

### Existing Users (Have localStorage):
```javascript
// index.js loadSettings() merges:
stored = { gutterLPx: 15, gutterRPx: 10, ... }  // no historyBgLightness
defaults = { historyBgLightness: 7, ... }

result = { ...defaults, ...stored }
// → historyBgLightness: 7 (from defaults)
```

**Result**: Existing users get 7% (current hardcoded value), seamless upgrade.

---

## Settings Overlay Behavior

### Modal & Key Handling:
- ✅ **Modal overlay**: Already handled by `openModal()` - blocks all key penetration
- ✅ **Escape**: Closes without saving (handled by root keydown listener)
- ✅ **Ctrl+S**: Saves and closes (handled by root keydown listener)
- ✅ **Tab navigation**: j/k move between controls (existing code)
- ✅ **+/- adjustment**: Existing `adjustNumber()` function works for all number inputs

### Form State:
- **Dirty tracking**: `setDirty(true)` called on any input change
- **Reset button**: `doReset()` loads defaults from schema (will include historyBgLightness: 7)
- **Save**: `saveAndClose()` only persists if values changed vs baseline
- **Cancel**: Closes without saving, localStorage unchanged

### Validation:
- **Auto-clamped**: `clampRange(value, 0, 20)` ensures values stay in bounds
- **NaN handling**: Returns `min` value if parseInt fails
- **Schema-driven**: Min/max enforced by both form input attributes AND JavaScript

---

## Relationship with variables.css

### Before Settings System:
```css
--history-bg: hsl(0, 0%, 7%);  /* Hardcoded, unchangeable */
```

### After Settings System:
```css
--history-bg: hsl(0, 0%, 7%);  /* Fallback only (FOUC prevention) */
```

**At runtime**:
```javascript
// JavaScript overrides it:
document.documentElement.style.setProperty('--history-bg', 'hsl(0, 0%, 12%)')
```

**CSS cascade**:
1. `variables.css` defines: `--history-bg: hsl(0,0%,7%)`
2. JavaScript sets inline: `style="--history-bg: hsl(0,0%,12%)"`
3. **Inline style wins** (higher specificity)
4. All CSS rules using `var(--history-bg)` get the JavaScript value

**This is the same pattern** used for all other spacing settings (gutters, gaps, etc).

---

## Testing Checklist

### Basic Functionality:
- [ ] Setting appears in Settings overlay under "spacing" tab
- [ ] Default value is 7 (matches current hardcoded)
- [ ] Slider/input works (0-20 range)
- [ ] Changes apply immediately on "Save & Close"
- [ ] Background lightness updates visually
- [ ] Gradients update to match background

### Edge Cases:
- [ ] New user (no localStorage): Gets default 7%
- [ ] Existing user (has localStorage): Gets default 7% on first load
- [ ] Reset button: Restores to 7%
- [ ] Cancel: Doesn't save changes
- [ ] Invalid input (NaN): Clamped to 0
- [ ] Values outside range: Clamped to 0-20

### Visual Verification:
- [ ] 0% = pure black (matches old #0c0c0c)
- [ ] 7% = current appearance (baseline)
- [ ] 15% = noticeably lighter, comfortable
- [ ] 20% = light gray, reduced contrast
- [ ] Gradients fade from same color as background
- [ ] User messages (blue) still visible
- [ ] Code blocks (darker) still distinct

### Performance:
- [ ] No FOUC on page load (preloadState works)
- [ ] No jank when changing setting (just CSS var update)
- [ ] No unnecessary re-renders (renderAction: 'restyle')

---

## Summary of Files to Edit

| File | Changes | Lines |
|------|---------|-------|
| `src/core/settings/schema.js` | Add `historyBgLightness` entry | +7 |
| `src/features/history/spacingStyles.js` | Apply CSS variable | +5 |
| `src/runtime/preloadState.js` | Preload for FOUC prevention | +4 |
| `src/features/config/settingsOverlay.js` | Read from form, populate form | +3 |
| `src/styles/variables.css` | Update comment (optional) | 0 |

**Total: ~19 lines of code** (5 files)

**Zero breaking changes**: All changes are additive, backward compatible.
