# MaiChat Implementation Plan (Single Source of Truth)

Last updated: 2025-08-26

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
M5.0 Architectural Prep
1. [X] Settings module load/save + subscribers
2. [X] History view rendering extraction
3. [X] ActivePartController remap (A1)
4. [X] Anchor abstraction inserted
5. [X] Replaced scrollIntoView calls
6. [X] Baseline pre‑partition commit

M5.1 Partition & Measurement
1. [X] Partition engine v1 (whole-line, stable IDs)
2. [X] Measurement + caching with threshold invalidation
3. [X] Active part restoration after repartition
4. [~] Greedy packing (binary refine deferred)
5. [-] partFraction control reliability fix

M5.2 New Message Lifecycle
1. [X] Pending send lock
2. [X] Assistant reply arrival handling
3. [X] New reply badge + filtered dim variant
4. [X] 'n' newest reply jump
5. [ ] 'G' newest reply last-part jump
6. [X] Auto-focus newest assistant reply at logical end

M5.3 Settings & Persistence
1. [X] Settings overlay (partFraction, anchorMode, edgeAnchoringMode)
2. [X] Persist + bootstrap load
3. [X] Resize ≥10% triggers repartition invalidation
4. [ ] Extend settings to gaps/padding (deferred)

M5.4 Reading Position Regimes & Masking (ACTIVE SUB‑TASK)
1. [X] Anchor modes framework (bottom / center / top)
2. [X] Edge anchoring mode (adaptive | strict)
3. [~] Adaptive blank-space suppression
4. [X] Top mode: outer gap padding + fixed top mask + dynamic bottom mask
5. [-] Bottom mode validation (clipped coverage, no partial active, jitter)
6. [-] Center mode implementation (dual dynamic masks, centering heuristic)
7. [ ] Scroll snapping (optional)
8. [ ] Mask visual style (gradient fade) & conditional render
9. [ ] Edge calm behavior (eliminate micro-adjust jitter)
10. [ ] Mask test harness (DOM simulation)

M5.5 Metadata & Filtering Integration
1. [~] Filtering integration with partition (focus-last tests missing)
2. [ ] Metadata shortcuts (star/include) behavior tests
3. [ ] Topic assignment from any part regression test
4. [ ] Meta row non-focusable test

M5.6 Tests & Quality
1. [~] Partition determinism across setting changes
2. [ ] Oversized block splitting correctness (maybe drop)
3. [ ] Resize remap accuracy tests
4. [X] Anchor correctness unit tests
5. [ ] Edge anchoring mode difference tests
6. [ ] Scroll jitter harness
7. [X] Pending send Enter lock
8. [~] New message badge visibility matrix
9. [ ] 'G' newest reply jump test
10. [~] Filtered reply dim + 'n' behavior (visual dim unasserted)
11. [ ] Filter re-anchor after command test
12. [ ] Star/allow toggle focus preservation test

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


## Change Log (Plan Evolution)
- 2025-08-24 (later): Implemented partition engine v1, anchoring modes, resize invalidation, new message lifecycle (pending send, badge, 'n' jump, filter clear B2). Added anchor & lifecycle unit tests; updated M5 status & adjusted oversized splitting requirement scope.
- 2025-08-24: Expanded M5 with edgeAnchoringMode (adaptive|strict), new message badge & 'n' key semantics, refined test matrix; added clarification placeholder for filtered reply behavior.
- 2025-08-23 (later 3): M4 completed (all functional items [x]; virtualization deferred). Removed stabilization checklist; advanced Immediate Next Focus to M5 partitioning & metadata.
- 2025-08-23 (later 2): Reclassified all M4 feature items from [x] to [~]; added explicit M4 Stabilization Checklist; reordered immediate focus to finish stabilization before partitioning.
- 2025-08-23 (later): Marked M4 partial (bugs); swapped order of Context Assembly and Metadata Navigation (now M6 & M5 respectively); added message partitioning tasks as precursor to navigation & metadata; updated immediate focus sequence.
- 2025-08-23: Consolidated duplicate sections; inserted Topic Management milestone (M4) reflecting implemented overlay system & focus trap; reordered upcoming work to prioritize Context Assembly (superseded by later change above).

---
This document supersedes prior fragmented plan sections. All future scope changes should modify this file only.
