# Message Rendering Pipeline

**Purpose**: Convert LLM response text (markdown with code/math) into safe, enhanced HTML displayed exactly once via `innerHTML`.

**Critical Constraints**:
- Single DOM injection (no re-renders, no layout shifts)
- Preserve LaTeX syntax through markdown/sanitization
- Apply syntax highlighting and math rendering at string level (fast, predictable)
- Protect against XSS while allowing rich formatting

---

## Pipeline Overview

```
Raw Markdown
    ↓
[1] Extract & Protect Math/Code
    ↓
[2] Parse Markdown → HTML
    ↓
[3] Sanitize (DOMPurify)
    ↓
[4] Restore Math/Code
    ↓
[5] Add Code Language Attributes (DOM round-trip)
    ↓
[6] Linkify URLs
    ↓
[7] Apply Syntax Highlighting + Math Rendering
    ↓
Final HTML → DOM (innerHTML, once)
```

---

## Step-by-Step Details

### Step 1: Extract & Protect Math/Code
**File**: `markdownRenderer.js` lines 35-77  
**What**: Replace math expressions with unique placeholders before markdown parsing  
**Why**: 
- Markdown parsers interpret `*`, `_`, `\` as formatting → breaks LaTeX
- Extracting preserves exact content (e.g., `$x > 0$` stays literal)
- Placeholders use Unicode chars (Ɱ, Ƥ) to avoid conflicts with user text

**Patterns extracted**:
- `$$...$$` → `ⱮATHDISPLAY{n}ƤLACEHOLDER`
- `$...$` (inline, not followed by digit) → `ⱮATHINLINE{n}ƤLACEHOLDER`
- `\[...\]` → normalized to `$$...$$`
- `\(...\)` → normalized to `$...$`

**Critical**: Dollar-digit guard (`$5 and $10` should not trigger math).

---

### Step 2: Parse Markdown → HTML
**File**: `markdownRenderer.js` line 80  
**What**: `marked.parse(textWithPlaceholders)`  
**Why**: Convert markdown syntax to HTML structure (headings, lists, bold, etc.)  
**Output**: Raw HTML with placeholders intact

---

### Step 3: Sanitize (DOMPurify)
**File**: `markdownRenderer.js` lines 83-123  
**What**: Remove dangerous HTML (scripts, event handlers, iframes)  
**Why**: XSS protection (LLM output is untrusted)  
**Allowed**: Safe tags (h1-h6, p, code, pre, ul, ol, table, a, blockquote)  
**Output**: Safe HTML, placeholders still intact

---

### Step 4: Restore Math
**File**: `markdownRenderer.js` lines 125-137  
**What**: Replace placeholders with original math expressions (`$$...$$`, `$...$`)  
**Why**: 
- Must happen AFTER sanitization (sanitizer would mangle LaTeX backslashes)
- Math is now in HTML as literal text (not yet rendered)

**Output**: HTML with raw math notation embedded

---

### Step 5: Add Code Language Attributes
**File**: `markdownRenderer.js` lines 139-156  
**What**: 
```javascript
tempDiv.innerHTML = finalHtml  // Parse HTML
querySelectorAll('pre') → add data-language, class="language-{lang}"
result = tempDiv.innerHTML      // Serialize back to string
```

**Why**: 
- Marked.js loses language info from ` ```python ` fences
- Need `data-language` and `class="language-*"` for Prism highlighting
- DOM is the only reliable way to add attributes to specific `<pre>` tags

**Critical Side Effect**: Browser HTML parser auto-escapes special chars when serializing back  
- `$\lambda > 0$` becomes `$\lambda &gt; 0$`  
- This is why Step 7 must decode entities

---

### Step 6: Linkify URLs
**File**: `markdownRenderer.js` lines 158-161  
**What**: Convert plain `http://...` URLs to `<a>` tags (string-based, skips inside code/pre/a)  
**Why**: User convenience; LLMs often output plain URLs  
**Safe**: Pure string parsing, no DOM

---

### Step 7: Apply Syntax Highlighting + Math Rendering
**File**: `stringEnhancer.js` → called via `enhanceHTMLString()`

#### 7a. Syntax Highlighting
**What**: 
```javascript
Find <code class="language-*">...</code>
Decode HTML entities (< > & " ')
Apply Prism.highlight()
Return highlighted HTML
```

**Why Decode Entities**: 
- Step 5's DOM serialization escaped `<`, `>`, `&` in code
- Prism needs raw code (e.g., `if (x < 5)` not `if (x &lt; 5)`)

#### 7b. Math Rendering
**What**: 
```javascript
Find $$...$$ and $...$
Decode HTML entities (< > & " ')  ← ADDED IN FIX
Apply katex.renderToString()
Return KaTeX HTML
```

**Why Decode Entities**: 
- Step 5's DOM serialization escaped comparison operators
- KaTeX needs raw LaTeX (e.g., `\lambda > 0` not `\lambda &gt; 0`)
- Without decoding: KaTeX renders `&gt;` literally (red error)

**Output**: Fully enhanced HTML with syntax-highlighted code and rendered math

---

## Final Injection

**File**: `historyView.js` line 130  
**What**: `element.innerHTML = renderMarkdownInline(text, { enhance: true })`  
**Why**: Single write to DOM, browser renders once, no layout shifts

---

## Key Design Decisions

### Why Extract Math Before Markdown?
**Problem**: Markdown syntax overlaps with LaTeX (`*`, `_`, `\`, `[]`)  
**Solution**: Protect math in placeholders, restore after markdown/sanitization  
**Alternative Considered**: Custom markdown renderer → too complex, fragile

### Why String-Based Enhancement (not DOM)?
**Problem**: DOM manipulation is slow, causes reflows, harder to reason about  
**Solution**: Process HTML as strings (regex), inject once  
**Benefit**: Predictable, fast, no visual flicker

### Why Decode Entities in Step 7 (not earlier)?
**Problem**: Step 5's DOM round-trip is unavoidable (need to add attributes reliably)  
**Solution**: Accept entity encoding, decode just before Prism/KaTeX  
**Why Safe**: 
- Code/math content doesn't contain real HTML tags
- Decoding happens in isolated string context
- Mirrors security model: sanitize first, decode in controlled scope

### Why Not Skip Step 5 DOM Round-Trip?
**Tried**: String-based attribute injection via regex  
**Failed**: Too brittle (nested tags, malformed HTML, edge cases)  
**Current**: DOM is the canonical HTML parser; safer to use it

---

## Rules for Future Changes

### ✅ SAFE Changes
- Add new markdown syntax support (extract → placeholder → restore)
- Modify Prism/KaTeX rendering options
- Add new allowed tags to sanitizer whitelist
- Optimize string processing (replace, split, join)

### ⚠️ RISKY Changes
- Changing extraction/restoration order
- Adding DOM manipulation between steps (NOT ACCEPTABLE)
- Removing entity decoding in Step 7
- Multiple `innerHTML` writes to same element

### ❌ NEVER DO
- Skip sanitization (XSS risk)
- Extract math AFTER markdown parsing (breaks LaTeX)
- Render math/code before sanitization (mangled output)
- Use DOM for string processing that can be done with regex

---

## Testing Critical Paths

When making changes, verify:

1. **Math with operators**: `$x > 5$`, `$a \leq b$`, `$\lambda & \mu$`  
   → Should render cleanly, no red errors, no literal `&gt;`

2. **Code with special chars**: ` ```python\nif x < 5:\n    return True\n``` `  
   → Highlighted correctly, `<` not escaped

3. **Nested markdown in math**: `$$\text{if } x > 0$$`  
   → Math rendered, markdown not applied inside

4. **XSS attempts**: `<script>alert(1)</script>`, `<img onerror="alert(1)">`  
   → Stripped by sanitizer

5. **Performance**: 1000-line response with 50 code blocks + 20 equations  
   → Single render, no janky scrolling

---

## Common Issues & Fixes

**Issue**: Math shows `&gt;`, `&lt;`, `&amp;` literally in red  
**Cause**: Entities not decoded before KaTeX  
**Fix**: Add `decodeHTMLEntities()` in `renderMathToString()`

**Issue**: Code highlighting breaks with `<` or `>`  
**Cause**: Entities not decoded before Prism  
**Fix**: Already implemented in `applySyntaxHighlightToString()`

**Issue**: LaTeX backslashes disappear  
**Cause**: Sanitizer or markdown parsing  
**Fix**: Ensure math extraction happens before markdown (Step 1)

**Issue**: Math works first time, breaks on re-render  
**Cause**: Likely multiple `innerHTML` writes or DOM mutation  
**Fix**: Ensure single render path, no re-processing

---

## Performance Characteristics

- **Time Complexity**: O(n) where n = message length
- **DOM Writes**: 1 (final `innerHTML`)
- **Regex Passes**: ~10 (extraction, restoration, linkify, highlighting, math)
- **Typical Latency**: <5ms for 1000-line message (local, no network)

**Bottlenecks** (if scaling needed):
- KaTeX rendering (complex equations)
- Prism highlighting (large code blocks)
- DOMPurify sanitization (deep nesting)

**Optimizations Applied**:
- String-based processing (avoid DOM manipulation)
- Lazy enhancement (only when `enhance: true`)
- Regex caching (implicit in JS engine)
- Single innerHTML write

---

## Related Files

- `src/features/formatting/markdownRenderer.js` - Main pipeline (Steps 1-6)
- `src/features/formatting/stringEnhancer.js` - Enhancement (Step 7)
- `src/features/history/historyView.js` - Final injection
- `src/shared/sanitizer.js` - DOMPurify wrapper (if exists)

**Last Updated**: 2025-11-04 (entity decoding fix for math operators)
