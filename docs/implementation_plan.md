# MaiChat Implementation Plan

_Last updated: 2025-08-23_

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

### Phase 1 – Core Data & Storage (UPDATED)
- In‑memory store + event pub/sub
- IndexedDB content persistence (pairs + topics) with autosave on mutations (debounced)
- Initial schema version (v1) recorded in `meta` store
- Topic tree CRUD (add, rename, delete-if-empty) in data layer (UI minimal placeholder)
- Basic indexes (by topic, by model, by star, allow/exclude)
**Acceptance**: Reloading page restores pairs & topics; can add/rename/delete topics (if empty); indexes reflect new data.

### Phase 2 – UI Skeleton & Modes
- Static HTML structure (panes: topic tree, history, context preview, input/command bar)
- CSS theme (dark minimal)
- Mode state machine (input/view/command) + keybindings (i / v / : or /)
- Basic rendering functions (diff or full redraw strategy)
**Acceptance**: Switch modes with keys; dummy data renders; no filtering yet.

### Phase 3 – Message Lifecycle & Provider (Single Model)
- API key management panel (persist multiple provider keys locally, unencrypted)
- Provider adapter (OpenAI or chosen)
- Send request: user text → pending → response → store pair (auto-persist)
- Error handling (retry, inline status)
**Acceptance**: Round trip works; keys retained across reload; new pair appears; loading state visible.

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
- Export JSON (full workspace snapshot)
- Import (merge or replace)
- Manual clear-all data command
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
## Persistence Strategy (UPDATED)
Two categories:
1. Content Data (pairs, topics) – authoritative. Stored in IndexedDB from Phase 1 with autosave.
2. Preferences (UI layout, last topic, command history) – will begin later (Phase 4–6) using either localStorage or a `prefs` store. API keys are stored (unencrypted) in IndexedDB `keys` store starting Phase 3.

## Detailed Checklist
Legend: [x] done, [ ] not started, [~] partial, (→ Phase N) deferred

Foundation & Architecture
[x] ADR-000 Architecture
[x] Implementation Plan doc
[x] Data models (MessagePair, Topic)

Storage & Core Data (Phase 1)
[x] In-memory store
[x] IndexedDB adapter (basic CRUD)
[ ] Autosave integration (persist on mutation) **(in progress target)**
[ ] Topic CRUD (rename/delete-if-empty exposed via API)
[x] Index builder
[ ] Schema version record (meta store) – write on init

UI & Modes (Phase 2)
[x] Base HTML skeleton (placeholder panes)
[~] CSS theme (basic layout only)
[x] Mode state machine
[x] KeyRouter
[~] Rendering modularization (some functions split; further extraction pending)

Messaging (Phase 3)
[ ] API key management panel
[ ] Key persistence (IndexedDB keys store)
[ ] Provider adapter (OpenAI)
[ ] Send pipeline
[ ] Abort support

Filtering (Subset Phase 4)
[x] Lexer (subset)
[x] Parser (subset)
[x] Evaluator (basic semantics)
[~] Command input integration (no distinct command mode yet)
[~] Error display (inline string, no highlighting)

Filtering (Full Spec Phase 7)
[ ] Wildcards
[ ] Descendants (...)
[ ] Date absolute
[ ] Date relative
[ ] Escapes full
[ ] Optimization pass

Context Assembly (Phase 5)
[ ] Context selection logic
[ ] Token estimation heuristic
[ ] Preview panel
[ ] Send using context

Metadata UX (Phase 6)
[ ] Allow/exclude toggle
[ ] Star rating shortcuts
[ ] Topic reassignment
[ ] Navigation keys (j/k/gg/G)
[ ] Recent focusing

Persistence UX (Phase 8)
[ ] Export JSON
[ ] Import JSON
[ ] Clear all data command
[ ] Merge strategy (replace/merge)

Preferences (Phase 6+)
[ ] Preference store scaffold
[ ] Persist last topic
[ ] Persist command history
[ ] Persist layout/theme

Testing & Quality (Phases 1–9 incremental)
[x] Unit: parser precedence basic
[x] Unit: evaluator logic
[x] Unit: lexer basic via parser tests
[ ] Unit: indexes edge cases
[ ] Unit: topic CRUD
[ ] Unit: persistence (load/save roundtrip)
[ ] Unit: date parsing (→ Phase 7)
[ ] Integration: sample queries set
[ ] Performance micro-bench
[ ] Lint config
[x] Test script in package.json

Help & Polish (Phase 10)
[ ] Cheat sheet overlay
[ ] Status/Mode line hints
[ ] Theming variables
[ ] Accessibility pass

Extensibility (Phase 11)
[ ] Provider interface doc
[ ] Saved filter reserved syntax
[ ] Plug-in tokenizers stub

Docs (Ongoing / Release)
[ ] README user guide
[ ] Developer guide
[ ] ADR-001 Filtering engine
[ ] ADR-002 Storage choice
[ ] ADR-003 Context assembly strategy

Release (Phase 12)
[ ] Manual regression checklist
[ ] Version bump & tag instructions

## Security / Privacy Notes (MVP)
- API keys stored locally unencrypted (explicit warning banner planned). Future: optional passphrase encryption.
- Export excludes preferences & keys.

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Parser complexity creep | Phased features + unit coverage |
| IndexedDB reliability | Graceful fallback to memory + warning banner |
| Rendering performance | Batch DOM updates; consider virtualization if >5k pairs |
| Token overflow | Heuristic pruning strategy later |
| Data migrations | Version stamp & migration registry from v1 |
| Unencrypted API keys | User warning; future encryption option |

## Immediate Next Actions (Phase 1 Remainder)
1. Implement autosave wiring (store event → debounce → persist changed record).
2. Add schema version write/read logic.
3. Topic CRUD functions (rename/delete-if-empty) + minimal invocation hooks.
4. Add persistence smoke test (roundtrip save/load) later in tests.

(End of plan)
[x] Unit: evaluator logic (initial)
[ ] Unit: topic filters (deferred until topic semantics refined)
[ ] Unit: date parsing (→ Phase 7)
[ ] Integration: sample queries
[ ] Performance micro-bench
[ ] Lint config
[x] Test script in package.json

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
