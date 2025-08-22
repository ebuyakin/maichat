# MaiChat Implementation Plan

_Last updated: 2025-08-22_

## High-Level Architecture Snapshot
- **Runtime**: Pure vanilla JS (ES modules), no framework.
- **Layers**:
  1. Core Domain (data models, storage, indexing)
  2. Filtering & Context Engine (parser + evaluator + context assembler)
  3. Provider Adapters (LLM API abstraction)
  4. UI Shell (layout panes, rendering utilities, keyboard dispatcher, mode state machine)
  5. Persistence (IndexedDB adapter + export/import JSON)
  6. Utilities (token estimation, ID generation, formatting)
  7. Testing & Diagnostics (unit + integration + perf sanity)
  8. Documentation (vision, ADRs, usage, developer guide)

## Phased Roadmap (Milestones & Acceptance Criteria)
### Phase 0 – Foundation & Docs
- Define data model (MessagePair, Topic, AppState)
- Decide file/module layout
- Add ADR 000: Architecture overview
- Add implementation plan doc (this)
**Acceptance**: Docs present; skeleton modules compile.

### Phase 1 – Core Data & Storage
- In‑memory store + event pub/sub
- IndexedDB adapter (async init, basic CRUD)
- ID generator + clock
- Topic tree (single topic per pair) CRUD
- Basic indexes (by topic, by model, by star, allow/exclude)
**Acceptance**: Add topics, add pairs, query store programmatically, persist + reload.

### Phase 2 – UI Skeleton & Modes
- Static HTML structure (panes: topic tree, history, context preview, input/command bar)
- CSS theme (dark minimal)
- Mode state machine (input/view/command) + keybindings (i / v / : or /)
- Basic rendering functions (diff or full redraw strategy)
**Acceptance**: Switch modes with keys; dummy data renders; no filtering yet.

### Phase 3 – Message Lifecycle & Provider (Single Model)
- API key entry flow (ephemeral in memory)
- Provider adapter (OpenAI or chosen)
- Send request: user text → pending → response → store pair
- Error handling (retry, inline status)
**Acceptance**: Round trip works; new pair appears; loading state visible.

### Phase 4 – Filtering Language (MVP Subset)
- Lexer + parser (subset per decisions)
- Evaluator over current pairs
- Command mode input executes filter; empty line = show all
- Error feedback (first error only; preserves previous result)
**Acceptance**: Example subset queries produce expected filtered list.

### Phase 5 – Context Assembly & Send Preview
- Build context set from current filtered visible pairs (all “allowed” unless excluded)
- Token estimate heuristic
- Preview panel toggle
- “Send using current context” pipeline
**Acceptance**: Preview matches visible list; request uses that subset.

### Phase 6 – Metadata Editing & Keyboard Ops
- Toggle allow/exclude (a / x in view mode)
- Star ratings (1/2/3, space clears to 0)
- Navigate history (j/k, gg/G)
- Assign/change topic (single topic selector)
**Acceptance**: Metadata updates persist and reflect in filters.

### Phase 7 – Enhanced Filtering (Remaining Spec)
- Wildcards (* in t, m, c)
- Descendant `...`
- Date filtering (absolute + relative)
- Quoted string escapes (full set)
- Performance optimizations (short‑circuit, basic query planning)
**Acceptance**: Full spec examples evaluate correctly; perf acceptable (<30ms typical on 5k pairs).

### Phase 8 – Persistence UX
- Export JSON (full workspace)
- Import (merge or replace)
- Auto-save checkpoints
**Acceptance**: Export then clear & import restores identical state.

### Phase 9 – Testing & Quality Layer
- Unit tests: lexer, parser, evaluator, indexes, topic ops
- Integration tests: end‑to‑end filtering scenarios
- Lightweight perf benchmark script
- Lint (ESLint) + basic formatting rules
**Acceptance**: Tests pass; no console errors in smoke run.

### Phase 10 – UX Polish & Help
- Inline help overlay / cheat sheet (press ?)
- Keyboard hint bar (contextual mode help)
- Accessibility pass (ARIA roles, focus management)
- Theming variables (CSS custom properties)
**Acceptance**: Help overlay works; styling stable.

### Phase 11 – Extensibility Hooks
- ProviderAdapter interface ready for multi‑model
- Saved filter stubs (reserved syntax)
- Tokenization strategy pluggable
**Acceptance**: Adding second provider file requires no core changes.

### Phase 12 – Release Prep
- README usage + developer guide
- ADR updates (filter engine, storage decisions)
- Manual regression checklist
**Acceptance**: Repo usable by external user with README only.

## Cross-Cutting Concerns (Ongoing)
- Error reporting consistency
- Logging (dev flag vs production minimal)
- Performance budgets (render <16ms frame budget)
- Memory stewardship (avoid duplicating large strings)
- Data version tag for forward migrations

## File / Module Layout (Initial)
```
src/
  appState.js
  store/
    memoryStore.js
    indexedDbAdapter.js
    indexes.js
  models/
    messagePair.js
    topic.js
  filter/
    lexer.js
    parser.js
    evaluator.js
    predicates.js
  context/
    assembler.js
    tokenEstimate.js
  provider/
    openaiAdapter.js
    providerRegistry.js
  ui/
    domUtil.js
    layout.js
    modes.js
    keyRouter.js
    render/
      renderTopics.js
      renderHistory.js
      renderContext.js
      renderStatusBar.js
  utils/
    id.js
    time.js
    events.js
    escape.js
tests/
  unit/
  integration/
docs/
  ADRs/
```

## Data Model (Draft)
```js
/** @typedef {Object} MessagePair
 *  @property {string} id
 *  @property {number} createdAt  // ms epoch
 *  @property {string} topicId
 *  @property {string} model
 *  @property {number} star       // 0-3 (max for pair)
 *  @property {boolean} includeInContext
 *  @property {string} userText
 *  @property {string} assistantText
 */

/** @typedef {Object} Topic
 *  @property {string} id
 *  @property {string} name
 *  @property {string|null} parentId
 *  @property {number} createdAt
 */
```

## Detailed Checklist
Foundation
[ ] ADR-000 Architecture
[ ] Implementation Plan doc committed
[ ] Data models defined (JSDoc)

Storage & Data
[ ] In-memory store
[ ] IndexedDB adapter
[ ] Topic CRUD
[ ] Index builder (topic/model/star/allow)
[ ] Export JSON
[ ] Import JSON

UI & Modes
[ ] Base HTML skeleton
[ ] CSS theme
[ ] Mode state machine
[ ] KeyRouter
[ ] Rendering functions (topics/history/context/status)

Messaging
[ ] API key input flow
[ ] Provider adapter (OpenAI)
[ ] Send pipeline
[ ] Abort support

Filtering (Subset)
[ ] Lexer (subset)
[ ] Parser (subset)
[ ] Evaluator
[ ] Command input integration
[ ] Error display

Filtering (Full Spec)
[ ] Wildcards
[ ] Descendants (...)
[ ] Date absolute
[ ] Date relative
[ ] Escapes full
[ ] Optimization pass

Context
[ ] Context selection logic
[ ] Token estimation
[ ] Preview panel
[ ] Send using context

Metadata UX
[ ] Allow/exclude toggle
[ ] Star rating shortcuts
[ ] Topic reassignment
[ ] Navigation keys
[ ] Recent focusing (scroll/highlight)

Persistence UX
[ ] Auto-save intervals
[ ] Import/merge strategy
[ ] Data versioning tag

Testing
[ ] Unit: lexer
[ ] Unit: parser precedence
[ ] Unit: evaluator logic
[ ] Unit: topic filters
[ ] Unit: date parsing
[ ] Integration: sample queries
[ ] Performance micro-bench
[ ] Lint config
[ ] Test script in package.json

Help & Polish
[ ] Cheat sheet overlay
[ ] Status/Mode line hints
[ ] Theming variables
[ ] Accessibility pass

Extensibility
[ ] Provider interface doc
[ ] Saved filter reserved syntax
[ ] Plug-in tokenizers stub

Docs
[ ] README user guide
[ ] Developer guide
[ ] ADR-001 Filtering engine
[ ] ADR-002 Storage choice
[ ] ADR-003 Context assembly strategy

Release
[ ] Manual regression checklist
[ ] Version bump & tag instructions

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Parser complexity creep | Phased delivery + high coverage tests |
| IndexedDB reliability | Graceful fallback to memory store |
| Rendering performance | Batch DOM updates, possible virtualization later |
| Token overflow | Heuristic + later configurable trimming |
| Data model evolution | Version tag & migration function stubs |

## Next Immediate Actions
1. Create ADR-000 skeleton.
2. Scaffold `src/` directories & placeholder module exports.
3. Set up basic test harness (optional early if desired).

(End of plan)
