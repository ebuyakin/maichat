# Font Weight and Background Color Investigation

## Current Font Weight Structure

### Where Font Weights Are NOT Defined

**Message content has NO explicit font-weight**. It inherits from body/root:
- `.assistant-body` - no font-weight specified
- `.user-body` (user messages) - no font-weight specified
- Body default is browser default (usually 400 = normal)

This means text in messages renders with **system default weight** which varies by:
- Font family (system fonts differ)
- Operating system (macOS renders fonts heavier than Windows/Linux)
- Display settings (Retina vs non-Retina)

### Explicit Font Weights in App

**Only 3 weights used explicitly**:

1. **`font-weight: 400`** (normal) - Used in:
   - Badges (topic, model, timestamp, etc.)
   - Settings panel hints
   - Help overlay headers
   - Input button
   - All UI chrome elements

2. **`font-weight: 500`** (medium) - Used in:
   - API keys panel labels
   - Help overlay `<strong>` tags

3. **`font-weight: 600`** (semi-bold) - Used in:
   - `.assistant-body strong` (markdown bold)
   - `.assistant-body h1-h6` (headings)
   - Table headers (`<th>`)

**Bold rendering** (`<strong>`, `<b>`) gets `font-weight: 600` specifically in message content.

---

## Cascade and Inheritance

### Font Weight Cascade
```
html[data-page="app"] body
  ↓ (inherits system default ~400)
#history
  ↓ (no override)
.message.assistant
  ↓ (no override)
.assistant-body
  ↓ (no override)
<p>, <ul>, <li>, etc.
  ↓ (inherit = 400)
<strong>, <h1-h6>
  ↓ (explicit = 600)
```

**Key insight**: Normal text weight is 100% inherited, never explicitly set. Only bold elements are forced to 600.

---

## Current Background Colors

### History Pane Background

**Main container** (`#historyPane`):
```
background: var(--bg)
```
Where `--bg = #0c0c0c` (very dark gray, ~5% lightness)

**History scroll area** (`#history`):
- No background set
- Inherits from `#historyPane`
- Result: `#0c0c0c`

**Individual messages**:
- **User messages**: `background: #0d2233` (dark blue)
- **Assistant messages**: `background: transparent`

**Special elements INSIDE messages**:
- **Code blocks** (`pre`): `background: #050505` (even darker, ~2% lightness)
- **Inline code** (`code`): `background: rgba(255,255,255,0.05)` (5% white overlay)
- **Blockquotes**: `background: rgba(255,255,255,0.02)` (2% white overlay)
- **Table headers** (`th`): `background: rgba(255,255,255,0.05)`
- **Table row hover**: `background: rgba(255,255,255,0.02)`

---

## Text Colors

### Main Text
- **Normal text**: `color: var(--text)` = `#e6e6e6` (very light gray, ~90% lightness)
- **Dim text** (metadata): `color: var(--text-dim)` = `#7a7a7a` (medium gray, ~48% lightness)
- **Out-of-context**: `color: #888` (gray, ~53% lightness)

### Special Elements
- **Inline code**: `color: #85db87` (green)
- **Links**: `color: #58a6ff` (blue)
- **Headings/strong**: `color: var(--text-bright)` (not defined in variables, likely inherits `--text`)

---

## What Affects Perceived Contrast

### High Contrast Comes From
1. **Background darkness**: `#0c0c0c` is nearly black
2. **Text brightness**: `#e6e6e6` is nearly white
3. **Contrast ratio**: ~15:1 (very high)
4. **Font rendering**: macOS applies extra weight on high-contrast displays

### Why Font Looks Bold
- No explicit weight = browser applies 400
- System font on macOS = San Francisco
- San Francisco at 400 weight + high contrast + Retina = looks heavier
- When `strong` applies 600, it jumps significantly → feels "very bold"

---

## Adjustment Strategy

### Option A: Background Color Adjustment (RECOMMENDED START)

**Target**: `#history` background only  
**What to change**: Add adjustable lightness via CSS variable  
**Current**: Inherits `--bg` = `#0c0c0c` (5% lightness)  
**New**: Add `--history-bg` variable with adjustable lightness (5-15%)

**Affected elements**:
- Main history scrolling area
- Assistant messages (transparent background shows through)

**NOT affected** (have explicit backgrounds):
- User messages (`#0d2233` blue - stays)
- Code blocks (`#050505` dark - stays)
- Inline code (rgba overlay - stays)
- Blockquotes (rgba overlay - stays)
- Tables (rgba overlay - stays)

**Implementation**:
```javascript
// In schema.js
historyBgLightness: {
  defaultValue: 5,  // matches current #0c0c0c
  control: { type: 'number', min: 0, max: 15, step: 1 },
  ui: { label: 'History Background Lightness (%)', tab: 'spacing' }
}
```

```css
/* In variables.css */
--history-bg-lightness: 5;  /* default matches current */

/* In layout.css or history.css */
#history {
  background: hsl(0, 0%, var(--history-bg-lightness));
}
```

**Why this works**:
- Raising from 5% to 10-12% reduces contrast noticeably
- Doesn't affect code blocks (they stay darker for distinction)
- Doesn't mess with font rendering
- Simple, isolated change
- Easy to understand for users

---

### Option B: Font Weight Adjustment (SECONDARY)

**Target**: Message content text only  
**What to change**: Add explicit weight control for normal and bold text  
**Current**: Inherits 400, bold = 600  
**New**: Add variables for both

**Affected elements**:
- `.assistant-body` normal text
- `.assistant-body strong` bold text
- User message text (if we apply same variables)

**NOT affected**:
- UI chrome (badges, buttons, etc.)
- Help overlay
- Settings panel
- Topic picker
- Any other UI elements

**Implementation**:
```javascript
// In schema.js
messageWeightNormal: {
  defaultValue: 400,
  control: { type: 'number', min: 300, max: 500, step: 50 },
  ui: { label: 'Message Font Weight (Normal)', tab: 'spacing' }
}

messageWeightBold: {
  defaultValue: 600,
  control: { type: 'number', min: 500, max: 800, step: 50 },
  ui: { label: 'Message Font Weight (Bold)', tab: 'spacing' }
}
```

```css
/* In formatting.css */
.assistant-body {
  font-weight: var(--message-weight-normal);
}

.assistant-body strong,
.assistant-body h1,
.assistant-body h2,
.assistant-body h3,
.assistant-body h4,
.assistant-body h5,
.assistant-body h6,
.assistant-body th {
  font-weight: var(--message-weight-bold);
}

/* In history.css */
#history .message.user {
  font-weight: var(--message-weight-normal);
}
```

**Risks**:
- Font weight 300 might look too thin on some systems
- Different fonts render weights differently
- Might not solve the contrast issue (which is background-driven)

---

## Recommended Approach

### Phase 1: Background Lightness (Quick Win)
1. Add `historyBgLightness` setting (default 5%)
2. Apply only to `#history` container
3. Let users raise to 10-12% to reduce contrast
4. No risk, easy to understand, directly addresses "too harsh"

### Phase 2: Font Weight (If Needed)
1. Add `messageWeightNormal` and `messageWeightBold` settings
2. Apply to `.assistant-body` and user messages
3. Users can reduce to 350/500 if fonts still look heavy
4. Test on multiple systems/fonts

### Why Background First?
- Contrast is the root cause (black bg + white text)
- Background change reduces harshness without affecting rendering
- Font weight is system-dependent and unpredictable
- Easier to understand: "make background lighter" vs "adjust font weight"

---

## CSS Locations

### Files to Edit

**For background lightness**:
- `src/core/settings/schema.js` - add setting
- `src/styles/variables.css` - add CSS variable
- `src/styles/layout.css` or `src/styles/components/history.css` - apply to `#history`
- `src/features/history/spacingStyles.js` - apply setting on change

**For font weight**:
- `src/core/settings/schema.js` - add settings
- `src/styles/variables.css` - add CSS variables
- `src/features/formatting/formatting.css` - apply to `.assistant-body`, `strong`, headings
- `src/styles/components/history.css` - apply to `.message.user`
- `src/features/history/spacingStyles.js` - apply settings on change

---

## Testing Checklist

### Background Color Change
- [ ] History pane background lightens
- [ ] User messages (blue) still visible
- [ ] Code blocks still darker than background
- [ ] Inline code overlay still visible
- [ ] Metadata still readable
- [ ] No color bleeding or z-index issues

### Font Weight Change
- [ ] Normal text weight changes
- [ ] Bold/headings weight changes independently
- [ ] Inline code weight unaffected (monospace)
- [ ] UI chrome (buttons, badges) unaffected
- [ ] Readable on different displays (Retina, non-Retina)
- [ ] Works with system fonts (San Francisco, Segoe UI, etc.)

---

## Summary

**Current state**:
- Font weight: inherited system default (~400), bold = 600
- Background: `#0c0c0c` (very dark)
- Text: `#e6e6e6` (very light)
- Contrast ratio: ~15:1 (very high)

**Problem**:
- High contrast + font rendering = feels too bold
- No way to adjust

**Solution**:
- **Easy win**: Add background lightness control (5-15%)
- **If needed**: Add font weight controls (300-500 normal, 500-800 bold)
- **Start with background** - simpler, more predictable, directly addresses harshness

**Implementation**: Isolated to message history, doesn't affect UI chrome or other overlays.
