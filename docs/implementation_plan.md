# MaiChat Implementation Plan (Single Source of Truth)

Last updated: 2025-08-23

Purpose: One hierarchical, authoritative view of what exists, what is in progress, and what is next. No duplicated sections. Use this file only when planning or reviewing scope.

Legend:
- [x] Done (merged & working)
- [~] Partial / behind acceptance criteria
- [ ] Not started
- (deferred) Explicitly postponed

## 1. Architectural Overview (Current State)
The system is a layered vanilla ES modules app:
1. Core Domain & Store – in‑memory collections, topic tree, indexes (topic/model/star/allow-exclude), move & count maintenance.
2. Persistence – IndexedDB adapter with debounced autosave + beforeunload flush (pairs, topics). (Export/import pending.)
3. Filtering Engine – Lexer, Parser, Evaluator (subset: topics, model, star, allow/exclude; date filters not yet implemented – guarded).
4. Topic Management UI – Quick Picker (Ctrl+T) & Editor (Ctrl+E): CRUD, search, counts, mark/paste re-parent (child only), focus trap.
5. Mode & Keyboard Shell – Modes (INPUT / VIEW / COMMAND), KeyRouter, global shortcuts, focus management utility.
6. UI Rendering – Lightweight DOM updates (no virtualization yet).
7. Tests – Unit tests for lexer/parser/evaluator/indexes/persistence; gaps remain for topic move/count and UI behaviors.
8. Docs – Vision, ADR‑000 (arch), keyboard reference, topic system spec, focus management spec.

## 2. Milestones & Status

### M0 Foundation
- [x] Repository scaffold & ES module structure
- [x] Data model definitions (MessagePair, Topic)
- [x] ADR‑000 Architecture
- [x] Basic test harness (Vitest) + initial tests
  - Acceptance: Project builds; tests run → Achieved

### M1 Core Storage & Indexing
- [x] In‑memory store (topics, pairs, indexes)
- [x] IndexedDB adapter (create/open, CRUD)
- [x] Debounced autosave on mutations + beforeunload flush
- [x] Topic CRUD (add, rename, delete-if-empty) in data layer
- [x] Child index + moveTopic with cycle prevention
- [x] Incremental topic counts (direct & total)
- [x] Basic indexes (topic, model, starred, allow/exclude)
- [~] Schema version meta record (written? partial — confirm & add test)
  - Acceptance: Reload restores topics/pairs; operations persisted → Achieved except schema meta test

### M2 Filtering Engine (Subset MVP)
- [x] Lexer & tokens for implemented subset
- [x] Parser building AST (subset)
- [x] Evaluator executing AST over store
- [x] Error handling (first error reporting, guard for unimplemented date filter)
- [~] Command mode integration (command input UX minimal; refine later)
  - Acceptance: Representative subset queries filter list correctly → Achieved

### M3 Mode & Keyboard Shell
- [x] Mode state machine (INPUT / VIEW / COMMAND)
- [x] Global key routing & suppression when modal active
- [x] Navigation primitives (baseline j/k etc. in overlays; history nav pending under metadata UX)
- [x] Focus management utility (focus trap) & integration
  - Acceptance: Mode switching reliable; overlays isolate focus → Achieved

### M4 Topic Management MVP (IN STABILIZATION)
- [~] Overall milestone status (all features implemented but buggy; none accepted yet)
  - [~] Quick Topic Picker (search + selection) – issues: focus edge cases after closing? selection race?
  - [~] Topic Editor overlay (CRUD, rename inline, delete confirm, search) – issues: rename cancel, delete focus restore
  - [~] Mark (m) / Paste (p) re-parent child-only – issues: incorrect count propagation in some sequences?
  - [~] Counts display (direct/total) – needs verification after multiple nested moves & deletes
  - [~] Cycle prevention on move – needs negative tests & UI feedback clarity
  - [~] Visual & keyboard focus model (Shift+J, Esc layering) – intermittent focus leakage reported
  - [~] Highlight marked topic – verify persists after re-render / search filter changes
  - [ ] Virtualization for large trees (deferred threshold ≥500 topics)
  - Acceptance: All above items moved to [x] with passing tests + manual checklist; no known repro bugs outstanding.

#### M4 Stabilization Checklist
- [ ] Reproduce & log all current topic UI bugs (create issues list)
- [ ] Add unit test: moveTopic count adjustments (multi-level)
- [ ] Add unit test: cycle prevention (attempt self / ancestor move)
- [ ] Add unit test: delete-if-empty enforcement & counts after delete
- [ ] Add unit test: picker search filtering correctness (case sensitivity rules)
- [ ] Add unit test: mark/paste updates parent/ancestor totals correctly
- [ ] Add harness test: focus trap prevents global shortcuts while editor/picker open
- [ ] Manual checklist: rename cancel restores focus; delete confirm path returns to correct row; after move selected row remains in view
- [ ] Bug fixes applied (update individual item statuses to [x])
- [ ] Decide virtualization strategy trigger & outline (spec doc) – implementation can remain deferred

### M5 Metadata Editing, History Navigation & Message Partitioning (NEXT ACTIVE)
- [ ] Message partitioning model (split long messages into navigable parts; stable IDs referencing parent pair)
- [ ] Partition rendering in history list (each part is navigation unit)
- [ ] Anchoring & viewport logic (j/k over parts, g/G to top/bottom, maintain selection state)
- [ ] Update filtering to respect partition boundaries for context inclusion (pair-level semantics preserved)
- [ ] Allow/exclude toggle (a / x)
- [ ] Star rating shortcuts (1/2/3, space clear)
- [ ] Topic assignment from message or part (integrate picker)
- [ ] History navigation shortcuts (j/k, gg/G) in VIEW mode (outside overlays) using parts
- [ ] Persist & reflect metadata immediately
  - Acceptance: User can precisely navigate long conversations via parts; metadata edits instantly affect filtering; topic assignment works at pair level while navigation occurs at part granularity

### M6 Context Assembly & Preview
- [ ] Aggregate allowed message pairs based on current filter
- [ ] Token estimation heuristic
- [ ] Preview panel (toggle)
- [ ] Pipeline to send request using preview set (stub until provider implemented)
  - Acceptance: User can inspect & confirm context set (ordered) with estimated tokens before sending

### M7 Enhanced Filtering (Full Spec)
- [ ] Wildcards (*, pattern decisions)
- [ ] Descendant operator (...)
- [ ] Date filters (absolute/relative) + parser & evaluator support
- [ ] Escapes & quoted string edge cases
- [ ] Simple query planning / short‑circuit perf
  - Acceptance: All documented spec queries pass new test suite

### M8 Persistence UX
- [ ] Export full workspace JSON
- [ ] Import (merge vs replace)
- [ ] Clear-all command + confirmation
- [ ] Version/migration handling for future schema bumps
  - Acceptance: Export → clear → import roundtrip identical

### M9 Quality & Coverage Expansion
- [x] Existing unit tests (lexer, parser, evaluator, indexes, persistence)
- [ ] Topic move & count tests
- [ ] Topic CRUD tests
- [ ] Context assembly tests
- [ ] Integration filter scenarios suite
- [ ] Performance micro-benchmark (<30ms typical 5k pairs target)
- [ ] ESLint + formatting baseline
  - Acceptance: All critical logic covered; CI green; perf budget documented

### M10 UX Polish & Help
- [ ] Help / cheat sheet overlay (?)
- [ ] Contextual mode hint line
- [ ] Theming tokens (CSS custom properties)
- [ ] Accessibility (ARIA roles, focus outlines alternative, keyboard traps audited)
  - Acceptance: Discoverability improved; a11y basic checks pass

### M11 Extensibility & Provider Abstraction
- [ ] ProviderAdapter interface & base contract docs
- [ ] OpenAI provider implementation
- [ ] API key management UI + persistence (unencrypted notice)
- [ ] Tokenization strategy pluggable hook
- [ ] Saved filter definitions (reserved syntax or UI stub)
  - Acceptance: Adding second provider requires only new adapter file + registration

### M12 Release Prep
- [ ] README (user + quick start)
- [ ] Developer guide (arch, flows, adding features)
- [ ] ADRs: Filtering engine (ADR‑001), Storage approach (ADR‑002), Context assembly (ADR‑003)
- [ ] Manual regression checklist
- [ ] Versioning/tag process doc
  - Acceptance: External user can clone & run with only README

## 3. Cross-Cutting Concerns (Tracked)
- [x] Focus management (central trap utility)
- [ ] Rendering performance (monitor; tree & history virtualization paths designed)
- [ ] Error reporting consistency (standardize format & surface area)
- [ ] Logging strategy (dev vs minimal prod) – draft guidelines
- [ ] Migration strategy (meta schema version test) – implement
- [ ] Security notice for API keys (banner when provider added)

## 4. Backlog (Deferred / Nice-to-Have)
- (deferred) Root-level re-parent shortcut (pending need)
- (deferred) Nested modal stacking for focus trap
- (deferred) Optional encryption for API keys
- (deferred) Plugin system for custom filters

## 5. Immediate Next Focus (Proposed Order)
1. M4 Stabilization: enumerate & fix topic UI bugs (convert each [~] to [x])
2. Add unit tests: moveTopic counts, cycle prevention, delete-if-empty, mark/paste propagation
3. Focus trap robustness test & fixes
4. Schema version meta record & migration test (finish leftover M1 item)
5. Message partitioning core (model + rendering + navigation over parts)
6. Metadata editing basics (allow/exclude + star) with partitioned navigation
7. Topic assignment from history (picker integration)
8. Remaining partitioning polish (anchoring, gg/G, selection persistence)
9. Defer context assembly (M6) until stabilization + partitioning + metadata solid

## 6. Acceptance Criteria Summaries (For Active / Upcoming)
- Message Partitioning: Long messages split deterministically into parts (stable IDs); navigating j/k moves through parts; g/G anchors top/bottom; performance acceptable (no noticeable lag with 200 parts).
- Metadata Editing: Star / allow toggles persist and are immediately reflected in active filter result set; undo via same key.
- Context Assembly (later M6): Given current filter, assembling context yields ordered list of candidate message pairs; removing a pair via allow/exclude toggle immediately updates preview.
- Token Estimation: Estimator returns approx token count (within ~15%) for preview set using heuristic length → token formula.

## 7. Test Coverage Gaps (High Priority)
- Topic move & cascading counts integrity
- Prevent cycles (negative test)
- Persistence roundtrip with multiple topics & nested structure
- Evaluator error path (unimplemented date filter triggers)
- Focus trap: ensure global keys suppressed when modal active (unit or harness simulation)
- Message partitioning: deterministic splits, navigation order, part ID stability after reload
- Metadata edits: allow/star toggles reflected in filters instantly

## 8. Risks & Mitigations (Current)
| Risk | Impact | Current Mitigation | Planned Action |
|------|--------|--------------------|----------------|
| Spec creep in filtering | Delay | Phased milestones | Enforce M7 boundary before new ops |
| Large topic trees performance | Jank | Small dataset now | Implement virtualization before >500 topics |
| Missing schema version leads to migration pain | Data loss on future change | Placeholder only | Implement meta version + migration registry (short JSON) |
| UI focus regressions | Keyboard UX breaks | Central trap | Add focused tests & a11y audit in M10 |
| Token estimation inaccuracy | Poor context decisions | Heuristic TBD | Add calibration vs model token counts later |
| Unencrypted API keys | User surprise | Planned banner | Possibly optional passphrase after MVP |

## 9. Metrics / Budgets (Targets)
- Render update (topic editor interaction): <16ms average frame
- Filtering evaluation (subset 5k pairs): <30ms
- Context assembly (5k pairs, naive): <40ms (optimize if exceeded)

## 10. Change Log (Plan Evolution)
- 2025-08-23 (later 2): Reclassified all M4 feature items from [x] to [~]; added explicit M4 Stabilization Checklist; reordered immediate focus to finish stabilization before partitioning.
- 2025-08-23 (later): Marked M4 partial (bugs); swapped order of Context Assembly and Metadata Navigation (now M6 & M5 respectively); added message partitioning tasks as precursor to navigation & metadata; updated immediate focus sequence.
- 2025-08-23: Consolidated duplicate sections; inserted Topic Management milestone (M4) reflecting implemented overlay system & focus trap; reordered upcoming work to prioritize Context Assembly (superseded by later change above).

---
This document supersedes prior fragmented plan sections. All future scope changes should modify this file only.
