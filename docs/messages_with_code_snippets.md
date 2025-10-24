I'll create a formal specification document for the code snippet extraction and overlay system we just discussed.

# Code & Equation Extraction and Overlay Display Specification

## Status
Implemented (with further extension an polishing of the interface and logic - keep in mind further enhancements)

## Scope
This specification covers the extraction, display, and interaction with code snippets and (Phase 2 extension) LaTeX equations in MaiChat message history.

## See Also
- `docs/plan.md` - M25 Message formatting milestone
- `docs/ARCHITECTURE.md` - Core architecture constraints
- `docs/keyboard_navigation.md` - Navigation patterns

## Overview

This feature introduces a system for extracting code blocks (and optionally LaTeX equations) from message content, replacing them with visual placeholders in the main view, and providing overlay systems for rich display (syntax highlighting for code; KaTeX rendering for math) with utility features.

## Motivation

1. **Preserve Reading Flow**: Large code blocks disrupt the smooth j/k navigation and reading experience
2. **Maintain Context**: Code needs to be accessible but not dominate the conversation view
3. **Power User Features**: Syntax highlighting, line numbers, and copy functionality when needed
4. **Minimal Dependencies**: Avoid heavy markdown/highlighting libraries in the main view

## Core Design Principles

1. **Separation of Storage and Display**: Full message content (including code) is always preserved; only the display layer shows placeholders
2. **Atomic Navigation Units**: Code placeholders are treated as single navigation targets
3. **Progressive Enhancement**: Basic functionality works without JavaScript libraries; rich features load on demand
4. **Keyboard-First Interaction**: All code & equation viewing remains keyboard accessible
5. **Parallel Extensibility**: Math extraction mirrors code architecture without coupling (separate overlay; shared modal primitives)

## Current Message Lifecycle & Storage Implementation

Understanding the existing message flow is critical for minimal-impact integration:

### Message Storage Structure

**Core Model** (`src/core/models/messagePair.js`):
```javascript
MessagePair = {
  id: string,
  createdAt: number,
  topicId: string,
  model: string,
  star: 0-3,
  colorFlag: 'b'|'g',
  userText: string,
  assistantText: string,      // ← Code extraction happens here
  lifecycleState: 'idle'|'sending'|'error'|'complete',
  errorMessage: string|undefined,
  tokenLength: number|undefined
}
```

### Message Flow

1. **Creation** (`src/features/history/newMessageLifecycle.js`):
   - User input → `beginSend()` creates MessagePair with `userText`
   - API response → `completeSend()` adds `assistantText`
   - **Integration point**: Process `assistantText` for code blocks

2. **Storage** (`src/core/store/memoryStore.js`):
   - MessagePairs stored in memory
   - Persisted via `src/core/store/indexedDbAdapter.js`
   - **Integration point**: Extend storage schema for new fields

3. **Rendering** (`src/features/history/historyRuntime.js`):
   - Messages filtered and rendered to DOM
   - **Integration point**: Use `processedContent` instead of `assistantText`

4. **Partitioning** (`src/features/history/partitioner.js`):
   - Long messages split into parts for navigation
   - **Integration point**: Placeholders treated as atomic units

5. **Context Assembly** (`src/features/compose/pipeline.js`):
   - Builds API request from message history
   - **Integration point**: Always use original `assistantText` for context

### Key Integration Points

- **Storage layer**: Extend MessagePair model (backward compatible)
- **Rendering layer**: Use processed content for display
- **Context layer**: Use original content for API requests
- **Navigation layer**: Treat placeholders as single navigation units

## Technical Specification

### 1. Code Block Detection

**Pattern**: Triple backtick markdown code blocks
```language
code content
```

**Regex**: `/```(\w*)\n([\s\S]*?)```/g`

**Supported Languages**: Initially support common languages (python, javascript, bash, sql, json, yaml)

### 1b. Equation Detection (Optional Phase Introduced by This Revision)

**Patterns Supported (initial):**
- Inline math: `$...$` (single line, no newlines inside)
- Display math: `$$...$$` (multi-line allowed)
- Bracketed display: `\\[ ... \\]`
- Environments (first pass – optional / later): `\\begin{equation} ... \\end{equation}`

**Regex Strategy (sequential passes to avoid nesting conflicts):**
1. Extract code blocks first (prevents `$` inside fenced code misleading math parser).
2. Display math: `/\$\$([\s\S]*?)\$\$/g`
3. Bracket math: `/\\\\\[([\s\S]*?)\\\\\]/g`
4. Inline math (non-greedy, avoid `$$`): `/(^|[^$])\$([^\n$][^$]*?)\$(?!\$)/g`

**Captured Data (equationBlocks array):**
```javascript
{
  index: 1,
#### Inline Equation Hybrid Strategy (Simple vs Complex)
To balance readability and stability of partitioning:
1. Classify inline math tokens as SIMPLE or COMPLEX before placeholder replacement.
2. SIMPLE → convert directly to lightweight Unicode math inline (no placeholder, wrapped with `<span class="eq-inline" data-tex="...">…</span>`).
3. COMPLEX → replaced by `[eq-n]` placeholder and listed in `equationBlocks`.

SIMPLE heuristic (all must pass):
- Raw TeX length ≤ 30 chars
- Contains only alphanumerics, spaces, and symbols: `+ - = < > ≤ ≥ ( ) [ ] , . / * ^ _`
- Allowed macros only (whitelist): `\alpha \beta \gamma \delta \epsilon \pi \mu \sigma \theta \lambda \phi \psi \omega \times \cdot \pm \to \rightarrow \leftarrow`
- At most one level of simple superscript or subscript (no nested braces)
- No forbidden macros: `\frac \sqrt \sum \int \begin \over \align \matrix \displaystyle \text`

Conversion rules (subset):
- Greek macros → Unicode (e.g. `\alpha`→α)`
- Arrows: `\to`, `\rightarrow`→→; `\leftarrow`→←
- Multiplication: `\times`→×; `\cdot`→·
- Plus/minus: `\pm`→±
- Superscripts: `^2`→², `^3`→³, `^(-1)`→⁻¹ (strip outer parens if single token). Others fallback to caret form.
- Subscripts digits: `_0`→₀ … `_9`→₉; `_i`→ᵢ (optional minimal set). Otherwise keep `_x` literal.
- Normalization: collapse multiple spaces, remove surrounding `$` delimiters.

All converted inline spans retain original TeX in `data-tex` for future overlay or re-render toggles.

  tex: 'E=mc^2',
  display: false,      // true if from $$ $$ or \[ \]
  lineCount: 1,
  startPos: <number>,
  endPos: <number>
}
```

### 2. Message Processing

**Extended MessagePair Structure**:
```javascript
// Existing MessagePair model with new optional fields
MessagePair = {
  // Existing fields
  id: "msg_123",
  createdAt: 1234567890,
  topicId: "topic_456",
  model: "claude-3-5-haiku-20241022",
  star: 0,
  colorFlag: 'b',
  userText: "How do I sort a list in Python?",
  assistantText: "Original message with ```python\ncode\n```",  // Original, unchanged
  lifecycleState: 'complete',
  errorMessage: undefined,
  tokenLength: 150,
  
  // NEW OPTIONAL FIELDS (only present if code blocks detected)
  processedContent: "Original message with [:python-1]",         // For rendering
  codeBlocks: [
    {
      index: 1,
      language: "python",
      code: "code content",
      lineCount: 15,
      startPos: 23,  // Position in original content
      endPos: 45
    }
  ]
  // NEW OPTIONAL FIELDS (only present if equations detected)
  equationBlocks: [
    {
      index: 1,
      tex: 'E=mc^2',
      display: false,
      lineCount: 1,
      startPos: 90,
      endPos: 100
    }
  ]
}
```
**Processing Logic**:
```javascript
// When assistant response arrives, we extend the MessagePair
function processMessagePair(pair) {
  if (pair.assistantText && containsCodeBlocks(pair.assistantText)) {
    const extracted = extractCodeBlocks(pair.assistantText);
    pair.processedContent = extracted.displayText;  // NEW field
    pair.codeBlocks = extracted.blocks;            // NEW field
  }
  // If no code blocks, these fields remain undefined
  return pair;
}
```


**Key Design Decision**: Code blocks are associated with **MessagePairs**, not individual parts, because:
- Part boundaries change when user adjusts part size settings
- Code blocks are stable content elements belonging to the message
- Simpler mental model: "Message X has code blocks 1,2,3" regardless of partitioning

### 3. Placeholder Format

Code (implemented): `[python-1]`, `[code-2]` (green styling).  
Equations (new): `[eq-1]`, `[eq-2]` (distinct styling, e.g. teal).  
Placeholders always surrounded by single spaces: ` ... [eq-1] ... ` to ensure tokenizer clarity.  
Both placeholder classes: `.code-placeholder`, `.eq-placeholder`.


### 4. Overlay Trigger Mechanism

**Primary trigger**: `v` key (view) when focused on a part containing code from a message
- Clear semantic meaning: "view code"
- Avoids conflict with existing commands
- Consistent with navigation patterns

**Multiple code blocks within message**:
- `v1`, `v2`...`v9` for direct access to specific blocks
- `v` without number opens first block or shows selection if ambiguous

**Multi-frame overlay behavior**:
- `v1` opens overlay with first code block (full overlay size)
- `v1` again (or Esc) toggles overlay closed
- `v2` while overlay open: splits view to show both blocks
- `v3` while showing 1+2: shows all three blocks
- User can configure horizontal/vertical split preference

Equation overlay uses a separate trigger to avoid cognitive overload.

**Equation Trigger (parallel design – initial simple form):**
- `m` when focused on assistant part containing at least one equation placeholder:
  - Single equation → open equation overlay at index 0.
  - Multiple → pending state; next digit `1..9` selects (same pattern as code `v`).
- `m1..m9` direct.
- Inside overlay: `n/p` navigate equations; `j/k/d/u` scroll; `c` copies TeX; Esc closes.

### 5. Code Overlay Features

**Multi-Frame Layout**:
- Single frame: Full overlay displays one code block
- Split frames: Overlay divides to show multiple blocks simultaneously
- Frame management: Add/remove frames as user opens/closes blocks
- Split orientation: User preference for horizontal/vertical splits

**Essential Features per Frame**:
- Syntax highlighting (lazy loaded)
- Line numbers
- Language indicator in frame header
- Individual scroll for each frame
- Copy to clipboard button/shortcut per frame
- Frame focus indicator

**Navigation**:
- `Esc` - close entire overlay
- `Tab`/`Shift+Tab` - switch focus between frames
- `j/k` - scroll within focused frame
- `Ctrl+C` or `y` - copy focused frame's code
- `v1`, `v2` etc. - toggle specific frames on/off

**Layout Management**:
- Automatic frame sizing (equal splits initially)
- User can resize splits with `Ctrl+hjkl` (when focused on frame borders)
- Maximum 4 frames (practical limit for readability)
- Vertical split default, horizontal split option in settings

### 5b. Equation Overlay Features (New)
**Layout:** Reuses modal foundation; single-frame (Phase 1) with planned multi-snippet navigation same as code.

**Rendering:** Lazy-load KaTeX (MIT) on first equation overlay open. If load fails, show raw TeX with fallback styling.

**Keyboard:**
- `n/p` next / previous equation (if >1)
- `j/k` line scroll, `d/u` half-page (shared logic)
- `c` copy raw TeX
- (Future) `y` yank; `g/G` top/bottom

**Footer Hint:** Mirrors code overlay (navigation hint left, copy button right).

**Accessibility:** Use `role="dialog"` and label with equation index `(1/N)`.

**Deferred (Phase 2+):** multi-frame simultaneous equations, rendered inline preview toggle, equation numbering alignment with source positions.

### 6. Context Preservation

When building context for API requests:
- Always use `content` field (original with code)
- Never use `display` field for context
- Ensures code is included in conversation context

### 7. Implementation Phases

**Phase 1 - Core Extraction (Code) / Math Extraction (Parallel MVP)**:
- Code detection and extraction
- Placeholder replacement
- Basic overlay with raw code display
- Context preservation

**Phase 2 - Rich Display (Code)**:
- Lazy load syntax highlighter (Prism.js)
- Line numbers
- Copy functionality
- Language detection

**Phase 2b - Math Display:**
- KaTeX load + render
- Copy TeX
- Navigation (n/p)
 - Inline SIMPLE math Unicode conversion (hybrid) — may also land at end of Phase 1b if low-risk

**Phase 3 - Enhanced Features (Code)**:
**Phase 3b - Enhanced Features (Math):**
- Multi-frame equation viewing
- Inline preview on hover or focus
- Export LaTeX snippet
- Alignment / numbering (equation tags)

- Code block navigation (n/p between blocks)
- Export individual code blocks
- Inline preview on hover (optional)
- Syntax error indicators (optional)

### 8. Edge Cases

1. **Nested backticks**: Handle edge cases with 4+ backticks
2. **Incomplete blocks**: Unclosed code blocks show as regular text
3. **Empty code blocks**: Ignore or show minimal placeholder
4. **Very long code**: Limit initial display, scroll for more
5. **Unsupported languages**: Default to plain text highlighting

Additional math-specific edge cases:
6. Escaped dollars `\$` not treated as math delimiters
7. Avoid nested math detection (do not recurse inside already captured blocks)
8. Very large display math (truncate visually but keep full TeX for overlay)

### 9. Performance Considerations

- Process messages only once during initial load
- Cache extracted code blocks
- Lazy load syntax highlighting library only when first code overlay opens
- Consider virtual scrolling for very long code blocks

### 10. Alternative Approaches Considered

1. **Inline collapsible**: Rejected - complicates navigation
2. **Sidebar display**: Rejected - reduces main content area  
3. **Tooltip preview**: Rejected - not keyboard friendly
4. **Full markdown parsing**: Rejected - too heavy, unnecessary features
5. **Moveable overlay windows**: Rejected - complex to control, unclear UX
6. **Multiple separate overlays**: Rejected - window management overhead

**Selected approach**: Single modal overlay with multi-frame capability provides the best balance of functionality and simplicity.

## Acceptance Criteria

- [ ] Code blocks are correctly detected and extracted
- [ ] Equation blocks (math expressions) detected & extracted without corrupting code parsing order
- [ ] Navigation with j/k treats placeholders as single units (both code + eq)
- [ ] Context sent to API includes full code & equations (original assistantText)
- [ ] V key family opens code overlay; M key family opens equation overlay
- [ ] Code overlay displays syntax-highlighted code (basic highlight Phase 1 ok)
- [ ] Equation overlay displays KaTeX-rendered math (or raw TeX fallback)
- [ ] SIMPLE inline math tokens rendered as Unicode inline spans (no placeholder)
- [ ] COMPLEX math replaced with `[eq-n]` placeholders and appears in overlay
- [ ] Each converted inline span preserves original TeX in `data-tex`
- [ ] Esc closes overlay and returns focus
- [ ] Multiple code & equation blocks are numbered and individually accessible via digit shortcuts
- [ ] No impact on messages without code/equations
- [ ] Performance remains smooth with 100+ code + 100+ equation placeholders

## Open Questions

1. Should we support inline code `like this` or only blocks?
2. What's the maximum code block size before truncation?
3. Should code language be auto-detected if not specified?
4. Do we need a visual indicator for "code available" in the part?
5. Should extracted code be searchable via the filter language?
6. Provide unified overlay (tabs) vs separate overlays? (Current: separate → simpler lifecycle)
7. Inline rendering of small inline math (heuristic threshold)?
8. Should equation indexing continue across an entire conversation or restart per message?

## Dependencies

- Optional: Prism.js (~20KB) for syntax highlighting
- KaTeX (lazy-loaded) for equation rendering
- Optional: Clipboard API polyfill for older browsers

## File Structure

### New Files
```
src/features/codeDisplay/
├── codeExtractor.js      // Detection & extraction logic
├── codeOverlay.js        // Multi-frame overlay UI component  
├── codeOverlay.css       // Overlay and frame styles
├── equationExtractor.js  // LaTeX math detection & extraction
├── equationOverlay.js    // KaTeX rendering overlay (single-frame initial)
├── frameManager.js       // Frame splitting and layout logic
└── codeDisplay.js        // Main module (renamed from index.js)
```

### Existing Files to Modify

**Core Data Model**:
- `src/core/models/messagePair.js` - Add optional `processedContent` and `codeBlocks` fields

**Storage Layer**:
- `src/core/store/memoryStore.js` - Process messages during `()` and `updateMessagePair()`
- `src/core/store/indexedDbAdapter.js` - Handle new fields in persistence schema

**Message Lifecycle**:
- `src/features/history/newMessageLifecycle.js` - Trigger code extraction in `completeSend()`

**Rendering Layer**:
- `src/features/history/historyRuntime.js` - Wire up `v` key triggers for code overlay
- `src/features/history/historyView.js` - Use `processedContent` field for display
- `src/features/history/partitioner.js` - Ensure placeholders remain atomic

**Context Assembly**:
- `src/features/compose/pipeline.js` - Verify uses original `assistantText` (no changes needed)

## References

- [Prism.js](https://prismjs.com/) - Lightweight syntax highlighter
- [VS Code's approach](https://code.visualstudio.com/api/extension-guides/syntax-highlight-guide) - For comparison
```

This specification document:

1. **Formalizes our discussion** into clear requirements
2. **Breaks down implementation** into manageable phases
3. **Addresses edge cases** we should consider
4. **Maintains MaiChat's principles** (keyboard-first, minimal, fast)
5. **Provides clear acceptance criteria** for testing

Should I create a similar spec for **math formula rendering** as well? That would complete the M25 milestone specification.

What aspects of this spec would you like to discuss or refine before we move forward with implementation?This specification document:

1. **Formalizes our discussion** into clear requirements
2. **Breaks down implementation** into manageable phases
3. **Addresses edge cases** we should consider
4. **Maintains MaiChat's principles** (keyboard-first, minimal, fast)
5. **Provides clear acceptance criteria** for testing

Should I create a similar spec for **math formula rendering** as well? That would complete the M25 milestone specification.

What aspects of this spec would you like to discuss or refine before we move forward with implementation?