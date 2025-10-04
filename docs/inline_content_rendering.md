# Inline Content Rendering Specification

## Status
Draft - December 2024 (Post Message-Based Navigation Migration)

## Context & Motivation

### Previous Approach (Deprecated)
- Messages were partitioned into small navigation units
- Code blocks extracted and replaced with placeholders `[code-1]`
- Content viewed in separate overlay windows (v key)
- Multiple overlays = cognitive overhead & extra keystrokes
- **Problem:** Disrupted reading flow, required context switching

### New Approach (This Spec)
- Messages are whole, unpartitioned blocks
- All content (text, code, equations, formatting) rendered **inline**
- Single continuous information stream
- **Goal:** Modern chat UI experience with enhanced keyboard shortcuts
- **Philosophy:** Zero extra keystrokes for reading, efficient shortcuts for actions

## Core Principles

1. **Inline-First Rendering**: Everything visible in message body by default
2. **Enhanced Formatting**: Better than standard chat UIs (syntax highlighting, proper math, clean tables)
3. **Keyboard Efficiency**: Actions (copy, export) accessible but not required for viewing
4. **Progressive Enhancement**: Basic content works immediately, rich features load on demand
5. **No Extraction Required**: Render markdown directly, no placeholder system

## Data Model Simplification

### Storage Strategy

**Single Source of Truth:**
```javascript
MessagePair {
  id: string,
  assistantText: string,  // Raw markdown from API - ONLY field needed
  // REMOVED: processedContent (no longer needed)
  // REMOVED: codeBlocks[] (no extraction)
  // REMOVED: equationBlocks[] (no extraction)
  
  // Keep these existing fields
  userText: string,
  topicId: string,
  model: string,
  star: 0-3,
  colorFlag: 'b'|'g',
  lifecycleState: 'idle'|'sending'|'error'|'complete',
  errorMessage: string|undefined,
  tokenLength: number|undefined
}
```

**Key Decision:** Store only raw markdown, render at display time.

**Rationale:**
- ✅ Simpler data model
- ✅ No schema migration needed
- ✅ Easy to change rendering without data migration
- ✅ Raw markdown always available for context
- ✅ Rendering performance acceptable (cached by browser DOM)

### Rendering Pipeline

```
API Response (markdown)
        ↓
assistantText (stored as-is)
        ↓
[At render time in historyView.js]
        ↓
Markdown → HTML conversion
        ↓
Displayed inline in message body
```

**No preprocessing, no extraction, no placeholders.**

## Markdown Rendering Specification

### Supported Elements

#### Phase 1: Essential Formatting (MVP)

**Inline Elements:**
- `**bold text**` → `<strong>bold text</strong>`
- `*italic text*` → `<em>italic text</em>`
- `` `inline code` `` → `<code class="inline-code">inline code</code>`
- `~~strikethrough~~` → `<del>strikethrough</del>` (if commonly used)

**Block Elements:**
- Headers: `## Heading` → `<h2>Heading</h2>` (h1-h6)
- Paragraphs: Blank line separated → `<p>...</p>`
- Lists: `- item` → `<ul><li>item</li></ul>`, `1. item` → `<ol><li>item</li></ol>`
- Blockquotes: `> quote` → `<blockquote>quote</blockquote>`
- Horizontal rules: `---` → `<hr>`

**Code Blocks:**
```python
def hello():
    print("world")
```
→ 
```html
<pre class="code-block" data-language="python">
  <code class="language-python">def hello():
    print("world")</code>
</pre>
```

#### Phase 2: Enhanced Features

**Tables:**
```markdown
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
```
→ Rendered as HTML table with styling

**Math Equations:**
- Inline: `$E=mc^2$` → Rendered with KaTeX inline
- Display: `$$\int_0^\infty e^{-x}dx$$` → Rendered with KaTeX display mode

**Links:**
- `[text](url)` → `<a href="url" target="_blank" rel="noopener">text</a>`
- Auto-link URLs (optional)

**Task Lists:**
- `- [ ] todo` → Interactive checkbox (optional, may keep as plain text)

#### Phase 3: Advanced (Future)

- Nested blockquotes
- Definition lists
- Footnotes
- Custom containers
- Mermaid diagrams (if requested)

### Not Supported (Security/Scope)

- Raw HTML (`<script>`, `<iframe>`, etc.)
- Images `![alt](url)` - security risk, bandwidth concerns
- Video embeds
- Custom CSS/styling in markdown

## Implementation Strategy

### Technology Choice: marked.js

**Library:** [marked.js](https://marked.js.org/) v11+
**Size:** ~10KB gzipped
**License:** MIT

**Why marked.js:**
- ✅ Battle-tested, mature (10+ years)
- ✅ Fast and lightweight
- ✅ Extensible (custom renderers)
- ✅ Sanitization built-in
- ✅ CommonMark + GFM support
- ✅ No dependencies
- ✅ Works in browser and Node (for tests)

**Configuration:**
```javascript
import { marked } from 'marked';

marked.setOptions({
  gfm: true,              // GitHub Flavored Markdown
  breaks: false,          // Don't treat \n as <br> (preserve LLM formatting)
  pedantic: false,
  sanitize: false,        // We'll use DOMPurify instead
  smartLists: true,
  smartypants: false,     // No fancy quotes (keep plain text)
  xhtml: false
});
```

### Sanitization: DOMPurify

**Library:** [DOMPurify](https://github.com/cure53/DOMPurify)
**Size:** ~20KB gzipped
**Why:** Industry standard for XSS prevention

**Configuration:**
```javascript
import DOMPurify from 'dompurify';

const clean = DOMPurify.sanitize(marked(markdown), {
  ALLOWED_TAGS: ['h1','h2','h3','h4','h5','h6','p','br','strong','em','code','pre',
                 'ul','ol','li','blockquote','hr','del','table','thead','tbody',
                 'tr','th','td','a'],
  ALLOWED_ATTR: ['href','class','data-language','target','rel'],
  ALLOW_DATA_ATTR: true  // for data-language on code blocks
});
```

### Syntax Highlighting: Prism.js (Lazy)

**For code blocks only** - loaded on demand when first code block appears.

**Library:** [Prism.js](https://prismjs.com/)
**Size:** ~2KB core + ~5KB per language (lazy load)
**Languages:** python, javascript, typescript, bash, sql, json, yaml, markdown (most common)

**Integration:**
```javascript
// Render code blocks with language hint
function renderCodeBlock(code, language) {
  // Initial render without highlighting
  const html = `<pre class="code-block" data-language="${language}">
    <code class="language-${language}">${escapeHtml(code)}</code>
  </pre>`;
  
  // Lazy load Prism on first code block
  if (!window.Prism && !loadingPrism) {
    loadPrism().then(() => highlightAll());
  }
  
  return html;
}
```

### Math Rendering: KaTeX (Lazy)

**For equations** - loaded on demand when first equation appears.

**Library:** [KaTeX](https://katex.org/)
**Size:** ~100KB (fonts) + ~50KB (JS) - but cached, lazy loaded
**Auto-render extension:** Automatically finds and renders math

**Integration:**
```javascript
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/contrib/auto-render';

// After rendering markdown, find and render math
function renderMathInMessage(element) {
  if (!window.katex) {
    return loadKatex().then(() => {
      renderMathInElement(element, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false}
        ],
        throwOnError: false  // Show raw LaTeX if invalid
      });
    });
  }
}
```

## Architecture Changes

### Files to Modify

**1. Remove Extraction System (Cleanup)**
```
src/features/codeDisplay/
├── codeExtractor.js        [DELETE]
├── equationExtractor.js    [DELETE]
├── codeOverlay.js          [DELETE]
├── equationOverlay.js      [DELETE]
└── codeDisplay.js          [SIMPLIFY - keep only copy utilities]
```

**2. Update Data Model**
```javascript
// src/core/models/messagePair.js
// Remove fields:
- processedContent
- codeBlocks
- equationBlocks
```

**3. Update Rendering**
```javascript
// src/features/history/historyView.js
// BEFORE:
const processed = processCodePlaceholders(assistant.text||'')

// AFTER:
const processed = renderMarkdownInline(assistant.text||'')
```

**4. Remove Sanitization**
```javascript
// src/features/interaction/sanitizeAssistant.js [DELETE]
// No longer needed - markdown parser handles structure
```

### New Files to Create

```
src/features/formatting/
├── markdownRenderer.js     # Main rendering logic
├── syntaxHighlight.js      # Lazy Prism loader
├── mathRenderer.js         # Lazy KaTeX loader  
├── copyUtilities.js        # Keyboard shortcuts for copying
└── formatting.css          # Styles for rendered content
```

## Rendering Implementation

### Core Renderer

```javascript
// src/features/formatting/markdownRenderer.js
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Global state for lazy loading
let prismLoaded = false;
let katexLoaded = false;

export function renderMarkdownInline(markdown) {
  if (!markdown) return '';
  
  // Step 1: Parse markdown to HTML
  const rawHtml = marked.parse(markdown);
  
  // Step 2: Sanitize for security
  const cleanHtml = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: ['h1','h2','h3','h4','h5','h6','p','br','strong','em',
                   'code','pre','ul','ol','li','blockquote','hr','del',
                   'table','thead','tbody','tr','th','td','a'],
    ALLOWED_ATTR: ['href','class','data-language','target','rel'],
    ALLOW_DATA_ATTR: true
  });
  
  // Step 3: Post-process for lazy loading features
  // (Done after DOM insertion in historyView.js)
  
  return cleanHtml;
}

export function enhanceRenderedMessage(element) {
  // Lazy load syntax highlighting if code blocks present
  const codeBlocks = element.querySelectorAll('pre code[class*="language-"]');
  if (codeBlocks.length > 0 && !prismLoaded) {
    import('./syntaxHighlight.js').then(m => {
      m.highlightCodeBlocks(codeBlocks);
      prismLoaded = true;
    });
  }
  
  // Lazy load math rendering if $ symbols present
  if (element.textContent.includes('$') && !katexLoaded) {
    import('./mathRenderer.js').then(m => {
      m.renderMathInElement(element);
      katexLoaded = true;
    });
  }
}
```

### Usage in historyView.js

```javascript
// src/features/history/historyView.js
import { renderMarkdownInline, enhanceRenderedMessage } from '../formatting/markdownRenderer.js';

// In message rendering
if (shouldUseMessageView()) {
  // ... build message HTML
  const bodyHtml = renderMarkdownInline(assistant.text || '');
  tokens.push(`
    <div class="message assistant" ...>
      <div class="assistant-meta">...</div>
      <div class="assistant-body">${bodyHtml}</div>
    </div>
  `);
}

// After DOM insertion
container.innerHTML = tokens.join('');

// Enhance with lazy-loaded features
container.querySelectorAll('.message.assistant').forEach(msg => {
  enhanceRenderedMessage(msg);
});
```

## Styling Specification

### CSS for Formatted Content

```css
/* src/features/formatting/formatting.css */

/* Inline elements */
.assistant-body code.inline-code {
  background: rgba(255, 255, 255, 0.05);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 0.9em;
  color: #85db87;
}

.assistant-body strong {
  font-weight: 600;
  color: var(--text-bright);
}

.assistant-body em {
  font-style: italic;
  color: var(--text);
}

/* Headings */
.assistant-body h1, 
.assistant-body h2, 
.assistant-body h3 {
  margin: 1em 0 0.5em 0;
  font-weight: 600;
  line-height: 1.3;
  color: var(--text-bright);
}

.assistant-body h1 { font-size: 1.5em; }
.assistant-body h2 { font-size: 1.3em; }
.assistant-body h3 { font-size: 1.1em; }
.assistant-body h4, 
.assistant-body h5, 
.assistant-body h6 { 
  font-size: 1em; 
  font-weight: 600;
  margin: 0.75em 0 0.25em 0;
}

/* Paragraphs */
.assistant-body p {
  margin: 0.75em 0;
  line-height: 1.6;
}

.assistant-body p:first-child { margin-top: 0; }
.assistant-body p:last-child { margin-bottom: 0; }

/* Lists */
.assistant-body ul,
.assistant-body ol {
  margin: 0.75em 0;
  padding-left: 2em;
}

.assistant-body li {
  margin: 0.25em 0;
  line-height: 1.6;
}

/* Blockquotes */
.assistant-body blockquote {
  margin: 1em 0;
  padding: 0.5em 1em;
  border-left: 3px solid var(--border-active);
  background: rgba(255, 255, 255, 0.02);
  font-style: italic;
  color: var(--text-dim);
}

/* Code blocks */
.assistant-body pre.code-block {
  margin: 1em 0;
  padding: 1em;
  background: #0a1520;
  border: 1px solid var(--border);
  border-radius: 4px;
  overflow-x: auto;
  position: relative;
}

.assistant-body pre.code-block code {
  font-family: var(--font-mono);
  font-size: 0.9em;
  line-height: 1.5;
  color: #c9d1d9;
}

/* Add language badge */
.assistant-body pre.code-block::before {
  content: attr(data-language);
  position: absolute;
  top: 0.5em;
  right: 0.5em;
  font-size: 0.7em;
  color: var(--text-dim);
  text-transform: uppercase;
  opacity: 0.5;
}

/* Tables */
.assistant-body table {
  margin: 1em 0;
  border-collapse: collapse;
  width: 100%;
}

.assistant-body th,
.assistant-body td {
  border: 1px solid var(--border);
  padding: 0.5em 0.75em;
  text-align: left;
}

.assistant-body th {
  background: rgba(255, 255, 255, 0.05);
  font-weight: 600;
}

/* Horizontal rule */
.assistant-body hr {
  margin: 1.5em 0;
  border: none;
  border-top: 1px solid var(--border);
}

/* Math (KaTeX styling) */
.assistant-body .katex {
  font-size: 1.1em;
}

.assistant-body .katex-display {
  margin: 1em 0;
  overflow-x: auto;
  overflow-y: hidden;
}
```

## Keyboard Shortcuts (Enhanced Actions)

While everything is visible inline, add efficient shortcuts for common actions:

### Copy Utilities

**In VIEW mode:**
- `yc` - Copy code block (if cursor on code block)
- `ym` - Copy math equation (if cursor on equation)
- `yy` - Copy entire message
- `yt` - Copy table as TSV

**Implementation:**
```javascript
// src/features/formatting/copyUtilities.js
export function setupCopyShortcuts(historyPane, activeParts) {
  // Find code block at cursor
  function getCodeBlockAtCursor() {
    const active = activeParts.active();
    if (!active) return null;
    
    const msgEl = document.querySelector(`[data-part-id="${active.id}"]`);
    const codeBlock = msgEl?.querySelector('pre.code-block code');
    return codeBlock?.textContent;
  }
  
  return {
    copyCode() {
      const code = getCodeBlockAtCursor();
      if (code) {
        navigator.clipboard.writeText(code);
        // Show toast: "Code copied"
      }
    },
    // ... other copy methods
  };
}
```

## Migration Strategy

### Phase 1: Implement Inline Rendering (Parallel)
**Goal:** New rendering works alongside old system

1. Install dependencies: `npm install marked dompurify`
2. Create `src/features/formatting/` directory
3. Implement `markdownRenderer.js`
4. Add CSS for formatted content
5. **Test in isolation** with sample markdown

**Files changed:** 0 (all new files)
**Risk:** Zero - doesn't touch existing code

### Phase 2: Feature Flag Rollout
**Goal:** Make new rendering available optionally

1. Add setting: `settings.useInlineFormatting` (default: false)
2. Update `historyView.js` to check flag:
   ```javascript
   const bodyHtml = settings.useInlineFormatting 
     ? renderMarkdownInline(text)
     : processCodePlaceholders(text);  // old way
   ```
3. Test with real conversations
4. Gather feedback

**Files changed:** 2 (historyView.js, settings model)
**Risk:** Low - behind feature flag

### Phase 3: Default On
**Goal:** Make inline rendering the default

1. Change default: `useInlineFormatting: true`
2. Keep old code extraction for 1-2 releases (emergency fallback)
3. Monitor for issues

**Files changed:** 1 (settings defaults)
**Risk:** Medium - visible change

### Phase 4: Cleanup
**Goal:** Remove deprecated code

1. Delete extraction system files
2. Remove `processedContent` field from schema
3. Remove overlay code
4. Update tests

**Files changed:** ~10 files deleted, data model simplified
**Risk:** Low - old code not used anymore

## Testing Strategy

### Unit Tests

```javascript
// tests/unit/markdown_renderer.test.js
describe('Markdown Inline Renderer', () => {
  it('renders bold text', () => {
    const md = '**bold**';
    const html = renderMarkdownInline(md);
    expect(html).toContain('<strong>bold</strong>');
  });
  
  it('sanitizes script tags', () => {
    const md = 'text <script>alert("xss")</script>';
    const html = renderMarkdownInline(md);
    expect(html).not.toContain('<script>');
  });
  
  it('renders code blocks with language', () => {
    const md = '```python\nprint("hi")\n```';
    const html = renderMarkdownInline(md);
    expect(html).toContain('data-language="python"');
  });
});
```

### Visual Tests

Create test HTML with various markdown samples:
- All heading levels
- Lists (ordered, unordered, nested)
- Code blocks (various languages)
- Tables
- Blockquotes
- Mixed formatting

### Integration Tests

Test with real LLM responses from:
- OpenAI GPT-4
- Anthropic Claude
- Google Gemini

Verify:
- Proper rendering
- No XSS vulnerabilities
- Performance acceptable
- Lazy loading works

## Performance Considerations

### Rendering Cost

**First render:**
- marked.parse(): ~5ms for 1KB text
- DOMPurify.sanitize(): ~2ms
- **Total:** ~7ms per message

**With syntax highlighting:**
- Prism.highlightElement(): ~10ms per code block
- Lazy loaded, doesn't block initial render

**With math rendering:**
- KaTeX.render(): ~20ms per equation
- Lazy loaded, doesn't block initial render

**Acceptable:** Yes - browser rendering is fast, results cached

### Memory Usage

- No extracted data stored (saves memory)
- Browser handles DOM caching
- Lazy loading keeps initial bundle small

### Bundle Size

- **Core:** marked (10KB) + DOMPurify (20KB) = 30KB
- **Lazy:** Prism (~5KB/language) + KaTeX (~150KB) - loaded on demand
- **Total initial:** +30KB to bundle (acceptable)

## Security Considerations

### XSS Prevention

1. **DOMPurify sanitization** - removes dangerous HTML
2. **Allowed tags whitelist** - only safe elements
3. **No raw HTML** - markdown only
4. **Link sanitization** - `target="_blank" rel="noopener"`
5. **No inline styles** - prevents style-based attacks

### Content Validation

1. Markdown is plain text - safe to store
2. Rendering happens client-side - no server risk
3. No user-generated markdown - only from trusted LLM APIs

## Accessibility

### Semantic HTML

- Use proper heading hierarchy (h1-h6)
- Lists use `<ul>/<ol>/<li>`
- Tables use `<table>/<thead>/<tbody>`
- Code blocks use `<pre>/<code>`

### Screen Reader Support

- All formatted content is real HTML (not images/canvas)
- Reading order preserved
- Skip links for long code blocks (optional)

### Keyboard Navigation

- All content accessible with j/k navigation
- Copy shortcuts don't require mouse
- Links are keyboard accessible (optional feature)

## Success Criteria

### Functional Requirements

- [ ] All common markdown elements render correctly
- [ ] Code blocks have syntax highlighting
- [ ] Math equations render beautifully (KaTeX)
- [ ] Tables are properly formatted
- [ ] No XSS vulnerabilities
- [ ] Performance acceptable (<10ms per message)
- [ ] Lazy loading works for syntax/math
- [ ] Copy utilities functional

### User Experience

- [ ] Reading flow is smooth and continuous
- [ ] No extra keystrokes needed to view content
- [ ] Formatting enhances readability vs plain text
- [ ] Visual hierarchy clear (headings, lists, quotes)
- [ ] Code is easily distinguishable
- [ ] Math equations readable

### Technical Quality

- [ ] No regression in existing features
- [ ] Data model simplified (less storage)
- [ ] Code is maintainable
- [ ] Tests pass
- [ ] Documentation updated

## Open Questions

1. **Link handling:** Should we make links clickable or copy-only?
   - Pro clickable: Expected behavior
   - Con clickable: Accidental clicks, security concerns
   - **Proposal:** Clickable with Ctrl+click (like VS Code)

2. **Image support:** Should we ever render images from markdown?
   - **Proposal:** No - bandwidth, security, privacy concerns

3. **Code block line numbers:** Always show or optional?
   - **Proposal:** Optional, setting-controlled

4. **Table overflow:** How to handle wide tables?
   - **Proposal:** Horizontal scroll within table

5. **Theme support:** Light mode colors?
   - **Proposal:** CSS variables for all colors

## Dependencies Summary

```json
{
  "dependencies": {
    "marked": "^11.0.0",      // Markdown parser
    "dompurify": "^3.0.0",    // XSS sanitization
    "prismjs": "^1.29.0",     // Syntax highlighting (lazy)
    "katex": "^0.16.0"        // Math rendering (lazy)
  }
}
```

**Total bundle impact:** ~30KB (core) + ~160KB (lazy loaded)

## Timeline Estimate

- **Phase 1 (Implementation):** 2-3 days
- **Phase 2 (Feature flag rollout):** 1 day
- **Phase 3 (Testing & refinement):** 2-3 days
- **Phase 4 (Cleanup):** 1 day

**Total:** ~1 week for full implementation and rollout

---

## Conclusion

This specification represents a **fundamental simplification** of the content rendering architecture:

**Before:**
- Extract → Store → Placeholder → Overlay
- Complex data model with multiple content representations
- Multiple keystrokes to view content

**After:**
- Store raw markdown → Render inline at display time
- Simple data model (just `assistantText`)
- Zero extra keystrokes to view content

This aligns with MaiChat's philosophy of **efficient, keyboard-centric interaction** while providing **enhanced formatting** beyond standard chat interfaces.

The gradual migration strategy minimizes risk while allowing for iterative refinement based on real usage.
