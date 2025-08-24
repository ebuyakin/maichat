# MaiChat Implementation Plan (Single Source of Truth)

Last updated: 2025-08-24

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

### M4 Topic Management MVP
- [x] Quick Topic Picker (hierarchical tree, search, hidden root, keyboard navigation)
- [x] Topic Editor overlay (CRUD, rename inline, delete-if-empty, search, hidden root, top-level creation)
- [x] Mark (m) / Paste (p) re-parent (child-only) with correct count propagation
- [x] Counts display (direct / total) with maintenance on move / delete
- [x] Cycle prevention on move (self / ancestor guarded)
- [x] Visual & keyboard focus model (Shift+J entry, Esc handling, focus trap)
- [x] Highlight marked topic (persists through re-render & search)
- [ ] Virtualization for large trees (deferred threshold ≥500 topics) (deferred)
  - Acceptance: Topic management workflows reliable; no known repro bugs; persistence stable across reloads.

### M5 Metadata Editing, History Navigation & Message Partitioning (ACTIVE)
Partition & Measurement
  - [x] Partition engine v1 (viewport fraction → whole-line parts; deterministic ID scheme). NOTE: Meta row exclusion / non-focusable still to assert in tests.
  - [x] Off-screen measurement + caching (canvas measurement with width + height threshold invalidation)
  - [~] Greedy packing + oversized block splitting (implemented greedy wrap; NO binary-search refinement yet – may downgrade requirement unless needed for perf)
  - [x] Active part restoration after repartition (A1 approximate remap implemented in `ActivePartController`)
Anchoring & Scrolling
  - [x] Anchoring system (Bottom/Center/Top)
  - [x] Edge anchoring mode (adaptive|strict)
  - [~] Adaptive mode blank-space suppression (basic clamp works; spacer suppression logic minimal – jitter tests pending)
  - [x] Strict mode baseline (clamps; spacer simulation via natural scroll – explicit spacer element not required currently)
  - [ ] Edge calm behavior (no jitter first/last) – needs test instrumentation
New Message Lifecycle
  - [x] Single pending send enforcement (Enter ignored while pending flag true)
  - [x] Detect arrival of assistant reply & auto-focus vs badge decision
  - [x] New message badge (appears only when user not at logical end or reply filtered)
  - [x] Auto-focus first assistant part when user at logical end
  - [x] 'n' key: jump to first part of newest assistant reply (clears badge & filter per B2 when dim)
  - [ ] 'G' key: jump to last part of newest reply (NOT implemented yet)
  - [x] Filtered-out reply: badge dim variant + clearing filter on jump (Decision B2) (DOM-based dim test pending due to jsdom limitation)
Settings & Persistence
  - [x] Settings overlay (Ctrl+,) UI (basic: partFraction, anchorMode, edgeAnchoringMode; padding/gaps deferred)
  - [x] Persist settings (module + localStorage) & bootstrap load
  - [x] Resize threshold handling (≥10% viewport height triggers repartition cache invalidation)
Integration & Metadata
  - [~] Filtering integration (basic; auto re-render + anchor restore, need dedicated tests for focus last part)
  - [ ] Metadata shortcuts with partition navigation (star, include) – wiring exists but acceptance tests missing
  - [ ] Topic assignment from any part (needs regression test path)
Tests (M5 scope)
  - [~] Partition determinism & stable IDs across rerender (basic split test present; stability under setting change not yet)
  - [ ] Oversized block splitting correctness (binary search path) (may be dropped if we accept current greedy strategy)
  - [ ] Resize mapping (verify approximate remap works for different viewport heights)
  - [x] Anchor correctness (unit tests for computeScrollFor modes)
  - [ ] Edge anchoring mode differences (adaptive vs strict behavior tests)
  - [ ] No jitter navigating first/last parts (scroll stability harness)
  - [x] Pending send blocks Enter (covered indirectly; add explicit key simulation test later)
  - [~] New message badge visibility matrix (only basic cases covered)
  - [ ] 'n' and 'G' jump semantics (only 'n' implemented & tested; 'G' pending)
  - [~] Filtered reply badge dim + 'n' behavior (logic present; dim state not assertable without DOM – consider injecting visibility strategy for test)
  - [ ] Meta row non-focusable (test missing)
  - [ ] Filter re-anchor after command (test missing)
  - [ ] Star/allow toggles reflect immediately while preserving part focus
  - Acceptance (partial): Core partition + anchoring + lifecycle behaviors working; remaining: settings UI, 'G' key, jitter & edge mode tests, metadata shortcut regression tests.

Decision Notes (M5):
* A1 Active restore: Part IDs stable only when text + settings unchanged; on resize/fraction change we re-map to same pair & closest line region (approximate) then enforce anchor.
* B2 Filtered reply handling: 'n' permanently adjusts (simplest: clears) current filter so new reply stays; badge cleared.
* C1 Anchor restoration precedence: Try same part ID; else same pair & approximate line; then apply anchor mode.
* D Pending send indicator: No extra spinner; rely on cleared input + placeholder assistant meta + Send button label change (AI is thinking). Enter ignored until reply arrives.

Architectural Prep (Pre-partition extraction tasks):
1. Introduce settings module (load/save, subscribers).
2. Extract history view rendering module (DOM isolation) without functional change.
3. Add enhanced ActivePartController remap method implementing A1 logic.
4. Stub anchorManager (currently delegates to center scroll) behind abstraction.
5. Replace direct calls to scrollIntoView with anchorManager.apply().
6. Commit baseline before implementing real partition & anchoring.

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
1. Message partitioning core (model + rendering + navigation over parts)
2. Metadata editing basics (allow/exclude + star) with partitioned navigation
3. Topic assignment from history (picker integration)
4. Remaining partitioning polish (anchoring, gg/G, selection persistence)
5. Schema version meta record & migration test (leftover M1 item)
6. Prepare groundwork for context assembly (define data needed) while deferring full M6 implementation

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
- 2025-08-24 (later): Implemented partition engine v1, anchoring modes, resize invalidation, new message lifecycle (pending send, badge, 'n' jump, filter clear B2). Added anchor & lifecycle unit tests; updated M5 status & adjusted oversized splitting requirement scope.
- 2025-08-24: Expanded M5 with edgeAnchoringMode (adaptive|strict), new message badge & 'n' key semantics, refined test matrix; added clarification placeholder for filtered reply behavior.
- 2025-08-23 (later 3): M4 completed (all functional items [x]; virtualization deferred). Removed stabilization checklist; advanced Immediate Next Focus to M5 partitioning & metadata.
- 2025-08-23 (later 2): Reclassified all M4 feature items from [x] to [~]; added explicit M4 Stabilization Checklist; reordered immediate focus to finish stabilization before partitioning.
- 2025-08-23 (later): Marked M4 partial (bugs); swapped order of Context Assembly and Metadata Navigation (now M6 & M5 respectively); added message partitioning tasks as precursor to navigation & metadata; updated immediate focus sequence.
- 2025-08-23: Consolidated duplicate sections; inserted Topic Management milestone (M4) reflecting implemented overlay system & focus trap; reordered upcoming work to prioritize Context Assembly (superseded by later change above).

---
This document supersedes prior fragmented plan sections. All future scope changes should modify this file only.
