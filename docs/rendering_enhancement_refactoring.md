# Rendering Enhancement Refactoring

**Date:** 15 October 2025  
**Status:** Proposed  
**Issue:** Scrolling bug + inefficient rendering architecture

---

## Problem Statement
### 0. Background
The app is supposed to allow users to flexibly filter and position the message history. The filtering is done by reading the user's input (command line input filter) and producing the set of messages satisfying that filter in response and rendering them in the app interface (history). Additionally, the message history is supposed to be positioned (=scrolled) according to certain rules (business logic). E.g. in many cases the last message of the filtered set shall be focused (and decorated with the blue border) and scrolled to the bottom of the view port. In some other cases the specific message (e.g. the message that was active before filter application) shall be preserved and scrolled to the top of the view port after the new filter applied. There may be other scenarios involving message history filtering and post-filtering scrolling to some position in the history. Correct scrolling requires the message history to be fully rendered before scrolling is applied.

### 1. Scrolling Bug

**Symptom:** When clearing a filter, the active message disappears off-screen despite being preserved. The same happens if the filter produces the large message set.

**Root Cause:** Unpredictable completion time for message rendering causes scroll to execute before DOM heights are finalized.

**Scenario:**
```
1. Apply filter (e.g., t'AI') → 10 messages shown
2. Active message scrolls to bottom ✓
3. Clear filter (empty input, Enter) → 100 messages shown
4. Active message preserved ✓
5. Scroll attempts to position active message at top
6. BUT: Code/math rendering still happening asynchronously
7. DOM heights still changing after scroll
8. Active message ends up off-screen ✗
```

### 2. Inefficient Architecture

**Current Flow:**
```javascript
// Loop 1: Build HTML strings (~1ms)
for (const msg of messages) {
  tokens.push(`<div>${renderMarkdownInline(msg.text)}</div>`)
}

// Single DOM update (~10ms)
container.innerHTML = tokens.join('')

// Loop 2: Query and enhance (~200-300ms)
container.querySelectorAll('.assistant-body').forEach(body => {
  enhanceRenderedMessage(body)  // Syntax highlighting + math
})

// Scroll (~1ms)
scrollController.alignTo(id, 'top')
```

**Problems:**
- ❌ **Double iteration** - Loop through messages twice (200 total iterations for 100 messages)
- ❌ **Query tax** - `querySelectorAll` must traverse entire DOM tree to find elements
- ❌ **Forced reflow** - After `innerHTML`, querying forces browser to recalculate layout
- ❌ **Fake lazy loading** - Called "lazy" but executes immediately on ALL messages
- ❌ **Unpredictable timing** - Enhancement uses async dynamic imports
- ❌ **Blocking anyway** - User can't use app until enhancement completes, so no UX benefit

### 3. False Lazy Loading

**Current implementation:**
```javascript
// Called synchronously, immediately
container.querySelectorAll('.assistant-body').forEach(body => {
  enhanceRenderedMessage(body)  // Starts async processes
})
// Returns immediately, but enhancement continues in background
```

**What "lazy loading" actually means:**
```javascript
// Deferred until idle or visible
requestIdleCallback(() => {
  enhanceWhenNotBusy()
})
```

**Current implementation is NOT lazy:**
- Called immediately after rendering
- Processes ALL messages (no prioritization)
- No visible-first optimization
- User must wait anyway before scrolling

**Only "lazy" aspect:** Dynamic import of Prism/KaTeX (one-time, ~50-100ms network delay)

---

## Analysis

### Timeline of Current Implementation

```
Time 0ms:   renderMessages() called
Time 1ms:   container.innerHTML = tokens.join('') (plain HTML in DOM)
Time 2ms:   Loop 2 starts - querySelectorAll finds 100 .assistant-body elements
Time 2ms:   enhanceRenderedMessage(body1) - triggers import('./syntaxHighlight.js')
Time 3ms:   enhanceRenderedMessage(body2) - import already loading
Time 4ms:   enhanceRenderedMessage(body3)
...
Time 10ms:  Loop 2 finishes - all enhancement calls made
Time 10ms:  renderMessages() RETURNS ← Caller thinks "rendering complete"
Time 11ms:  historyRuntime schedules RAF for remeasure
Time 16ms:  RAF fires → scrollController.remeasure() (measures wrong heights!)
Time 100ms: setTimeout fires → scrollController.alignTo() (scrolls to wrong position!)

Meanwhile (async):
Time 50ms:  Prism.js finishes loading
Time 55ms:  First code block highlighted → DOM height changes
Time 60ms:  Second code block highlighted → DOM height changes
...
Time 150ms: All syntax highlighting done

Time 200ms: KaTeX finishes loading
Time 210ms: First equation rendered → DOM height changes
...
Time 300ms: All math rendering done ← NOW truly complete
```

**Scroll executes at 100ms, but heights finalize at 300ms!**

### Performance Breakdown

**Current (with 100 messages, 50 code blocks, 20 equations):**

| Step | Duration | Blocking? |
|------|----------|-----------|
| Loop 1: Build HTML strings | ~1ms | ✓ |
| DOM update (innerHTML) | ~10ms | ✓ |
| Loop 2: Query + call enhance | ~10ms | ✓ |
| Dynamic import Prism | ~50ms | Async |
| Syntax highlighting (50 blocks) | ~100ms | Async |
| Dynamic import KaTeX | ~50ms | Async |
| Math rendering (20 equations) | ~100ms | Async |
| **Total blocking** | **~21ms** | |
| **Total until complete** | **~300ms** | |

**User experience:**
- Plain text appears at 11ms
- Colors/math appear gradually 50-300ms
- Scrolling happens at 100ms (WRONG!)
- **Cannot use app reliably until ~300ms**

---

## Considered Alternatives

### Alternative 1: Single Pass with DocumentFragment

**Approach:**
```javascript
const fragment = document.createDocumentFragment()
for (const msg of messages) {
  const div = document.createElement('div')
  div.innerHTML = buildHTML(msg)
  const body = div.querySelector('.assistant-body')
  enhanceRenderedMessage(body)  // Before inserting
  fragment.appendChild(div)
}
container.appendChild(fragment)
```

**Pros:**
- ✅ Single loop (eliminates double iteration)
- ✅ No query tax (direct element references)

**Cons:**
- ❌ Enhancement still async (Prism/KaTeX use dynamic imports)
- ❌ Enhancement won't work before DOM insertion (imports need document context)
- ❌ Still unpredictable timing

**Verdict:** Doesn't solve the core timing problem.

---

### Alternative 2: Defer Enhancement (True Lazy Loading)

**Approach:**
```javascript
container.innerHTML = tokens.join('')
// Return immediately

// Enhance later when idle
requestIdleCallback(() => {
  container.querySelectorAll('.assistant-body').forEach(body => {
    enhanceRenderedMessage(body)
  })
})
```

**Pros:**
- ✅ Predictable rendering completion
- ✅ Fixes scrolling bug
- ✅ Responsive UI (plain text appears instantly)

**Cons:**
- ❌ Still double loop
- ❌ Still query tax
- ❌ Visual "pop-in" (colors appear after scroll)
- ❌ Requires proper lazy loading infrastructure

**Verdict:** Good long-term solution, but requires significant refactoring.

---

### Alternative 3: Track Elements During Build

**Approach:**
```javascript
const tokens = []
const toEnhance = []
for (const msg of messages) {
  const id = `msg-${msg.id}`
  tokens.push(`<div data-enhance-id="${id}">...</div>`)
  toEnhance.push(id)
}
container.innerHTML = tokens.join('')

toEnhance.forEach(id => {
  const el = container.querySelector(`[data-enhance-id="${id}"]`)
  enhanceRenderedMessage(el)
})
```

**Pros:**
- ✅ More targeted queries

**Cons:**
- ❌ Still double loop
- ❌ Still N individual queries
- ❌ Still async enhancement
- ❌ Added complexity

**Verdict:** Marginal improvement, doesn't solve core issues.

---

### Alternative 4: Callback-Based Completion

**Approach:**
```javascript
function renderMessages(messages, onComplete) {
  container.innerHTML = buildHTML(messages)
  
  const bodies = container.querySelectorAll('.assistant-body')
  let completed = 0
  
  bodies.forEach(body => {
    enhanceRenderedMessage(body).then(() => {
      completed++
      if (completed === bodies.length) {
        onComplete()  // NOW truly done
      }
    })
  })
}
```

**Pros:**
- ✅ Explicit completion signal
- ✅ Fixes scrolling (scroll in callback)

**Cons:**
- ❌ Still double loop
- ❌ Still query tax
- ❌ Requires making enhancement return Promises
- ❌ Complex callback coordination

**Verdict:** Fixes scrolling but doesn't improve performance.

---

### Alternative 5: String-Based Enhancement (Proposed Solution)

**Approach:**
```javascript
// Single loop: Build complete enhanced HTML
const tokens = []
for (const msg of messages) {
  const html = renderMarkdownInline(msg.text)
  const enhanced = applyEnhancementsToString(html)  // Syntax + Math
  tokens.push(`<div class="assistant-body">${enhanced}</div>`)
}

// Single DOM operation
container.innerHTML = tokens.join('')
// Done! Truly complete
```

**Pros:**
- ✅ ✅ **Fixes scrolling bug** - Predictable, synchronous completion
- ✅ **Eliminates double loop** - Single pass through messages
- ✅ **Eliminates query tax** - No querySelectorAll needed
- ✅ **Faster** - String operations faster than DOM manipulation
- ✅ **Simpler** - One loop, one DOM update, done
- ✅ **Uses existing APIs** - Prism.highlight() and katex.renderToString() already work on strings

**Cons:**
- 🟡 **Synchronous blocking** - ~150-250ms for 100 messages (but acceptable)
- 🟡 **Requires bundling** - Prism + KaTeX must be bundled locally (+115 KB gzipped / +385 KB uncompressed)
- 🟡 **No incremental rendering** - All-or-nothing (but user waits anyway currently)

**Bundle Size Impact:**
- Current: 90 KB gzipped (311 KB uncompressed)
- After bundling: 205 KB gzipped (696 KB uncompressed)
- Increase: +115 KB gzipped (+128%)
- **Assessment:** Acceptable for modern web app standards (Gmail: ~2-5 MB, Notion: ~10+ MB)

**Verdict:** ✅ **RECOMMENDED** - Best balance of simplicity, performance, and correctness.

---

## Proposed Solution

### String-Based Enhancement

**Key Insight:** Since enhancement is blocking anyway (user can't use app until done), making it truly synchronous in the build loop is **better**, not worse:

**Benefits:**
1. Predictable completion → Scrolling works
2. Faster execution → String ops faster than DOM ops
3. Simpler code → Single loop, no query tax
4. Better architecture → Separation: build complete HTML, then insert once

**Trade-off:**
- Bundle size: +115 KB gzipped (+385 KB uncompressed)
- But: ~150-250ms blocking (currently blocks ~300ms anyway with unpredictable timing!)
- Benefit: Predictable, works offline, faster after first load

### Why Bundle Instead of CDN?

**Current Implementation:** Loads from CDN on-demand (jsdelivr/cdnjs)

**Bundling Decision Rationale:**

✅ **Advantages of Bundling:**
1. **Works offline** - No network dependency for rendering
2. **Predictable timing** - No CDN latency variance (50-200ms network vs 0ms local)
3. **Faster after first load** - No repeated CDN requests
4. **Simpler deployment** - No external dependencies
5. **Bundle size is acceptable** - 115 KB is small by 2025 standards

❌ **Disadvantages of CDN:**
1. **Network dependency** - Requires internet, fails offline
2. **Unpredictable timing** - 50-200ms variance causes scrolling bugs
3. **Privacy** - External requests (though jsdelivr/cdnjs are privacy-respecting)
4. **Reliability** - Depends on CDN uptime

**Size Comparison:**
- MaiChat (bundled): **205 KB gzipped**
- Gmail web: **~2-5 MB**
- Notion: **~10+ MB**
- VS Code Web: **~20+ MB**

**Conclusion:** 115 KB increase is negligible for modern web apps and provides significant reliability/performance benefits.

---

## Implementation Plan

### Phase 1: Preparation (No Behavior Change)

**Goal:** Set up infrastructure without changing current behavior.

#### Step 1.1: Install Enhancement Libraries as NPM Dependencies
**Command:**
```bash
npm install katex prismjs
```

**Why:** Need Prism/KaTeX bundled locally for synchronous access during HTML building.

**Size impact:** +115 KB gzipped (+385 KB uncompressed) - acceptable for predictable performance and offline support.

**Test:** Verify packages installed in `node_modules/`.

---

#### Step 1.2: Import and Expose Libraries Globally
**File:** `src/main.js`

**Change:**
```javascript
// Add to imports at top of file
import 'katex/dist/katex.min.css'
import katex from 'katex'
import Prism from 'prismjs'

// Import common Prism languages
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-markdown'

// Expose globally for enhancement functions
window.katex = katex
window.Prism = Prism
```

**Why:** 
- Bundles libraries with main app (no CDN dependency)
- Makes them available synchronously
- Works offline

**Test:** 
- `npm run build` completes successfully
- Check bundle size increase (~115 KB gzipped)
- Verify `window.katex` and `window.Prism` available in console

---

#### Step 1.3: Create String-Based Enhancement Functions
**File:** `src/features/formatting/stringEnhancer.js` (NEW)

**Functions to implement:**
```javascript
/**
 * Apply syntax highlighting to HTML string
 * @param {string} html - HTML with <code class="language-X"> elements
 * @returns {string} - HTML with highlighted code
 */
export function applySyntaxHighlightToString(html) {
  // Parse HTML, find code blocks, apply Prism.highlight()
}

/**
 * Render math expressions in HTML string
 * @param {string} html - HTML with $...$ or $$...$$ math
 * @returns {string} - HTML with rendered KaTeX
 */
export function renderMathToString(html) {
  // Parse HTML, find math, apply katex.renderToString()
}

/**
 * Apply all enhancements to HTML string
 * @param {string} html - Raw markdown-rendered HTML
 * @returns {string} - Fully enhanced HTML
 */
export function enhanceHTMLString(html) {
  html = applySyntaxHighlightToString(html)
  html = renderMathToString(html)
  return html
}
```

**Test:** Unit tests for string enhancement (input HTML string → output enhanced HTML string).

---

#### Step 1.4: Update renderMarkdownInline to Optionally Enhance
**File:** `src/features/formatting/markdownRenderer.js`

**Change:**
```javascript
/**
 * Render markdown to HTML with optional enhancement
 * @param {string} markdown - Raw markdown text
 * @param {Object} options - Options
 * @param {boolean} options.enhance - Apply syntax/math enhancement
 * @returns {string} - HTML string
 */
export function renderMarkdownInline(markdown, options = {}) {
  // Existing markdown parsing...
  let html = marked.parse(...)
  html = DOMPurify.sanitize(...)
  
  // NEW: Optional enhancement
  if (options.enhance) {
    html = enhanceHTMLString(html)
  }
  
  return html
}
```

**Test:** Verify `renderMarkdownInline(text, { enhance: true })` returns enhanced HTML.

---

### Phase 2: Update renderMessages (Breaking Change)

**Goal:** Switch to string-based enhancement.

#### Step 2.1: Modify renderMessages Function
**File:** `src/features/history/historyView.js`

**Change:**
```javascript
function renderMessages(messages) {
  if (!Array.isArray(messages)) {
    container.innerHTML = ''
    if (onActivePartRendered) onActivePartRendered()
    return
  }
  
  const tokens = []
  const settings = getSettings()

  for (const msg of messages) {
    if (!msg || !Array.isArray(msg.parts)) continue
    const pairId = msg.id
    const user = msg.parts.find((p) => p.role === 'user')
    const assistant = msg.parts.find((p) => p.role === 'assistant')
    
    if (user) {
      tokens.push(
        `<div class="message user" data-message-id="${user.id}" data-part-id="${user.id}" data-pair-id="${user.pairId}" data-role="user">${escapeHtml(user.text || '')}</div>`
      )
    }
    
    if (assistant) {
      const pair = store.pairs.get(assistant.pairId)
      const topic = pair ? store.topics.get(pair.topicId) : null
      const ts = pair ? formatTimestamp(pair.createdAt) : ''
      const topicPath = topic ? formatTopicPath(store, topic.id) : '(no topic)'
      const modelName = pair && pair.model ? pair.model : '(model)'
      let stateBadge = ''
      let errActions = ''
      
      if (pair && pair.lifecycleState === 'sending')
        stateBadge = '<span class="badge state" data-state="sending">…</span>'
      else if (pair && pair.lifecycleState === 'error') {
        const label = classifyErrLabel(pair)
        stateBadge = `<span class="badge state error" title="${escapeHtml(pair.errorMessage || 'error')}">${label}</span>`
        errActions = `<span class="err-actions"><button class="btn btn-icon resend" data-action="resend" title="Re-ask: copy to input and resend (E key)">↻</button><button class="btn btn-icon del" data-action="delete" title="Delete this error message (W key)">✕</button></span>`
      }
      
      // CHANGED: Enhance during HTML building
      const bodyHtml = settings.useInlineFormatting
        ? renderMarkdownInline(assistant.text || '', { enhance: true })  // ← Enhanced!
        : processCodePlaceholders(assistant.text || '')
      
      tokens.push(
        `<div class="message assistant" data-message-id="${assistant.id}" data-part-id="${assistant.id}" data-pair-id="${assistant.pairId}" data-role="assistant"><div class="assistant-meta"><div class="meta-left"><span class="badge flag" data-flag="${pair ? pair.colorFlag : 'g'}" title="${pair && pair.colorFlag === 'b' ? 'Flagged (blue)' : 'Unflagged (grey)'}"></span><span class="badge stars">${pair ? '★'.repeat(pair.star) + '☆'.repeat(Math.max(0, 3 - pair.star)) : '☆☆☆'}</span><span class="badge topic" title="${escapeHtml(topicPath)}">${escapeHtml(middleTruncate(topicPath, 72))}</span></div><div class="meta-right">${stateBadge}${errActions}<span class="badge offctx" data-offctx="0" title="off: excluded automatically by token budget" style="min-width:30px; text-align:center; display:inline-block;"></span><span class="badge model">${escapeHtml(modelName)}</span><span class="badge timestamp" data-ts="${pair ? pair.createdAt : ''}">${ts}</span></div></div><div class="assistant-body">${bodyHtml}</div></div>`
      )
    }
  }
  
  // Single DOM update
  container.innerHTML = tokens.join('')

  // REMOVED: No more post-processing loop
  // Enhancement already done in HTML string

  if (onActivePartRendered) onActivePartRendered()
}
```

**Test:** 
- Verify messages render with syntax highlighting and math
- Verify scrolling works correctly after filter clear
- Verify performance improvement (should be faster)

---

### Phase 3: Cleanup

#### Step 3.1: Remove Unused CDN Loading Code
**Files:**
- `src/features/formatting/syntaxHighlight.js`
- `src/features/formatting/mathRenderer.js`

**Action:** DELETE these files entirely (no longer needed - libraries now bundled)

**Test:** Verify app still works without these files.

---

#### Step 3.2: Remove Unused Enhancement Code
**Files:** 
- `src/features/formatting/markdownRenderer.js`

**Remove:**
- `enhanceRenderedMessage()` function
- `lazyLoadSyntaxHighlighting()` function
- `lazyLoadMathRendering()` function
- Related promises and state (`prismLoadPromise`, `katexLoadPromise`)

**Test:** Verify no regressions.

---

#### Step 3.3: Update Documentation
**Files:**
- `docs/rendering_enhancement_refactoring.md` (this file)
- `docs/ARCHITECTURE.md`
- Inline code comments

**Document:**
- New synchronous enhancement approach
- Removed fake lazy loading
- Performance characteristics

---

## Testing Strategy

### Unit Tests
1. ✅ `enhanceHTMLString()` - String in → enhanced string out
2. ✅ `applySyntaxHighlightToString()` - Code blocks highlighted
3. ✅ `renderMathToString()` - Math expressions rendered
4. ✅ `renderMarkdownInline(..., { enhance: true })` - Full pipeline

### Integration Tests
1. ✅ Render 100 messages with code → All highlighted
2. ✅ Render 100 messages with math → All rendered
3. ✅ Apply filter → Scroll works correctly
4. ✅ Clear filter → Active message stays visible

### Performance Tests
1. ✅ Measure time for 100 messages (should be <250ms)
2. ✅ Compare before/after (should be faster or similar)
3. ✅ Verify no UI blocking beyond expected

### User Scenarios
1. ✅ Apply various filters
2. ✅ Clear filters
3. ✅ Navigate with j/k
4. ✅ Scroll manually
5. ✅ Send new messages

---

## Rollback Plan

**If issues arise:**

1. Revert Step 2.1 (renderMessages change)
2. Keep Step 1.1 (preloaded libraries - no harm)
3. Keep Step 1.2 (string enhancement functions - unused but harmless)

**Git revert command:**
```bash
git revert <commit-hash-of-step-2.1>
```

---

## Success Criteria

### Must Have
- ✅ Scrolling bug fixed (active message visible after filter clear)
- ✅ No regressions in existing functionality
- ✅ Performance equal or better

### Nice to Have
- ✅ Measurably faster rendering
- ✅ Simpler codebase (less code)
- ✅ Better architecture (single responsibility)

---

## Future Work (Out of Scope)

1. **True lazy loading** - Implement requestIdleCallback + IntersectionObserver
2. **Virtual scrolling** - Only render visible messages
3. **Incremental enhancement** - Process visible messages first
4. **Web Workers** - Offload enhancement to background thread

---

## References

- Prism.js API: `Prism.highlight(code, grammar, language)` (string-based)
- KaTeX API: `katex.renderToString(mathString, options)` (string-based)
- marked.js: Already converts markdown → HTML strings
- DOMPurify: Already sanitizes HTML strings

---

## Decision Log

**2025-10-15:** Chose Alternative 5 (String-Based Enhancement) over others because:
- Fixes scrolling bug with predictable timing
- Improves performance (single loop, no DOM queries)
- Simpler architecture
- Leverages existing string-based APIs
- Acceptable trade-off (synchronous but faster overall)
