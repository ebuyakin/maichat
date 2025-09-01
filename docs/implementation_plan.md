# MaiChat Implementation Plan (Single Source of Truth)

Last updated: 2025-09-01 (post budgeting + model catalog v2 update)

Purpose: One hierarchical, authoritative view of what exists, what is in progress, and what is next. No duplicated sections. Use this file only when planning or reviewing scope.

Legend:
- [x] Done (merged & working)
- [~] Partial / behind acceptance criteria
- [ ] Not started
- (deferred) Explicitly postponed

## 1. Architectural Overview (Current State)
The system is a layered vanilla ES modules app:
1. Core Domain & Store – in‑memory collections, topic tree, indexes (topic/model/star/flag), move & count maintenance.
2. Persistence – IndexedDB adapter with debounced autosave + beforeunload flush (pairs, topics). (Export/import pending.)
3. Filtering Engine – Lexer, Parser, Evaluator (subset: topics, model, star, color flag; date filters not yet implemented – guarded).
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
- [x] Basic indexes (topic, model, starred, color flag)
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

M5.4 Reading Position Regimes & Visibility Fading (ACTIVE SUB‑TASK)
1. [X] Anchor modes framework (bottom / center / top)
2. [X] Edge anchoring mode (adaptive | strict)
3. [~] Adaptive blank-space suppression
4. [X] Top mode: outer gap padding + fade-based partial suppression (no overlay masks)
5. [-] Bottom mode validation (clipped coverage, no partial active, jitter)
6. [X] Center mode implementation (edge fading, centering heuristic)
7. [ ] Scroll snapping (optional)
8. [X] Gradient fade visual style & conditional render (masks removed)
9. [X] Edge calm behavior (micro-adjust jitter eliminated via 2px dead-band)
10. [-] (Dropped) mask test harness (fade opacity logic supplanted it)

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
6. [X] Scroll jitter harness (dead-band suppression + >2px correction)
7. [X] Pending send Enter lock
8. [~] New message badge visibility matrix
9. [X] 'G' newest reply jump test (covered via jumpToNewReply('last'))
10. [X] Filtered reply dim + 'n' behavior (clears filter & dim state)
11. [ ] Filter re-anchor after command test
12. [ ] Star/allow toggle focus preservation test

### M6 Context Assembly, Token Budget & First Provider (ACTIVE)
M6.0 Extended WYSIWYG Contract & Context Function
1. [x] Define extended WYSIWYG: visible filtered pairs are the candidate set; token budget marks oldest visible pairs as out‑of‑context (dimmed) but never hides them (document + code path in `renderHistory`).
2. [~] Implement `gatherContext(...)` pure function (present as `gatherContext(visiblePairs, opts)`; signature & user-pending inclusion refinement outstanding; no user/assistant message flattening yet).
3. [x] Boundary algorithm implemented (`computeContextBoundary` + integration; marks `.ooc`).
4. [~] Unit tests: basic inclusion test present (`contextBoundary.test.js`); missing movement, zero/all included, pending user text scenarios.
 5. [~] Pending user text estimation (`pendingUserText`) added to gatherContext stats; inclusion logic for actual send path still pending.

M6.1 Token Estimation & Budgeting
1. [x] Token estimator (heuristic) implemented with per‑pair caching (`tokenLength`).
2. [x] Multi‑model catalog v2 with per‑model metrics (contextWindow, tpm, rpm, tpd); effective model limit now `effectiveMaxContext = min(contextWindow, tpm)` (throughput‑aware). Legacy single hard-coded budget removed.
3. [x] Included vs excluded sets powering X / Y counter integrated in `renderHistory`.
4. [ ] Unit tests (estimator ranges, boundary recalculation, large single message) not yet written.
5. [ ] Introduce URA (User Request Allowance) concept (supersedes `responseReserve`) – default 100 tokens (setting) (NOT IMPLEMENTED YET; current X uses full effectiveMaxContext minus zero reserve).
6. [ ] Switch gatherContext boundary to (historyEstimate + URA ≤ effectiveMaxContext) rule; current implementation: accumulate newest-first until would exceed `effectiveMaxContext`.
7. [ ] Add CPT constant 3.5 (future user setting) – presently implicit heuristic constant (hard-coded) pending extraction.
8. [ ] Throughput quota tracking (rpm/tpd live usage + queue / backoff) – not started.

M6.2 Out-of-Context Visualization & Navigation
1. [x] Apply `.ooc` class + off badge (renamed from OUT) to excluded pairs; opacity styling applied.
2. [x] Message counter shows `X / Y`; tooltip with token stats.
3. [ ] (New) Post-trim counter format `[X-T]/Y` when runtime trimming occurs; idle still `X / Y`.
3. [x] Navigation shortcut (Shift+O) jumps to first included pair.
4. [x] Disable send when X=0.
5. [~] Tests: boundary scenarios covered; UI state & navigation tests still pending.

M6.3 Provider Adapter (OpenAI Chat Completions)
1. [x] Lightweight `ProviderAdapter` interface & registry.
2. [~] OpenAI adapter non‑streaming first pass (basic fetch, error classification minimal; needs integration & tests).
 3. [ ] Send pipeline integration (build messages, model guard, API key fetch) – partial code (pipeline.js) awaiting lifecycle wiring & UI states.
3. [ ] API key retrieval from localStorage; if missing → open API Keys overlay automatically (abort send).
4. [ ] Error classification util (auth / rate / network / generic).
5. [ ] Tests: adapter called with exact context array; error mapping.

M6.4 Send Pipeline & Edit-In-Place Resend
1. [ ] Send flow scaffold (pair creation, lifecycle states) – NOT STARTED (UI placeholder only; logic pending integration).
2. [ ] Build context from INCLUDED pairs + new user message.
3. [ ] Adapter call success/error path wiring.
4. [ ] Edit-in-place resend behavior.
5. [ ] Delete pair (`x`) full lifecycle.
6. [ ] Tests: success, error, resend after edit, delete, disappearing under filter.
7. [ ] User request allowance adjustment (URA) (future once URA implemented).
8. [x] Discrete overflow trimming loop (runtime only, no proactive trimming) – implemented in pipeline (one oldest predicted pair per overflow attempt, capped by max attempts const).
9. [x] Trimming telemetry instrumentation (predictedHistoryTokens, trimmedCount, attemptsUsed, stage classification, overflowMatched, lastErrorMessage) added to debug/HUD overlay.
10. [x] Debug overlay updated with TRIMMING + ERROR sections (multiline formatting, resizable HUD).
11. [ ] Error message taxonomy (prompt too large vs exhausted attempts) – partial (basic stage tagging present; user-facing messages pending).

M6.4a Settings Extension (New Subsection)
1. [x] Add URA numeric setting (default 100) to settings overlay (persist localStorage).
2. [x] Add NTA numeric setting (default 10) to settings overlay.
3. [ ] (Optional) Display CPT constant (read-only) with note future editable (currently editable internally; UI expose pending).

M6.5 Streaming (Optional Sub‑Phase) (deferred unless trivial)
1. [ ] If time: incremental append via SSE/stream; placeholder updates in chunks; final usage tokens captured.
2. [ ] Flag as [deferred] if skipped.

M6.6 UX & Feedback
1. [-] (Dropped) Inline token estimate (replaced by allowance-based stable X counter – zero-cost typing principle).
2. [ ] Error display with buttons `[Edit & Resend] [Delete]` (keyboard e/x).
3. [ ] (New) Tooltip update for counter showing: `Predicted X | Trimmed T | Sent X-T | Visible Y | URA | AUT | CPT | ML`.
3. [ ] Optional toast for send errors (defer if time). 

M6.7 Robustness & Edge Cases
1. [ ] Large single message over hard limit: block with explanatory error (after allowance recompute) (reword for URA model).
2. [ ] Race: multiple rapid sends prevented (lock enforcement test).
3. [ ] Timeout → `[error: network]` classification after 30s.

M6.8 Telemetry & Debug (Dev Only)
1. [x] HUD / debug overlay shows PARAMETERS, PREDICTED, ACTUAL, TRIMMING groups (resizable panel) – basic version.
2. [ ] Debug flag to dump request payload in console (sanitize key).
3. [x] Overflow attempts logged via stage + overflowMatched flags (console logging minimal; structured log persistence not yet implemented).

M6.9 Documentation
1. [ ] Context Assembly spec section (WYSIWYG, overrides, ordering rules, exclusion semantics) → integrate into implementation plan or separate spec.
2. [ ] Short Provider Adapter README excerpt (how to add more providers) – seeds future M11.

M6.10 Test Matrix Completion
1. [ ] Integration tests (jsdom): filter change boundary shift, error path, edit-resend path, delete path, zero-included disable send.
2. [ ] Performance micro-check (<10ms gatherContext on 1k pairs synthetic) — note results.

Acceptance (M6) (UPDATED DRAFT – partially implemented):
User with a valid OpenAI key can: (a) view visible history with overflow dimmed and counter X/Y (or bracketed `[X-T]/Y` post-trim) using `effectiveMaxContext = min(model.contextWindow, model.tpm)` and URA reserve, (b) send a prompt; predicted set = newest suffix satisfying `(historyTokens + URA) ≤ effectiveMaxContext`, (c) on overflow error the runtime trimming loop removes one oldest pair per attempt up to `maxTrimAttempts`, updating telemetry and bracket counter, (d) (pending) receive assistant reply appended via provider adapter wiring (currently placeholder path), (e) (pending) edit and resend in place (UI wiring partial), (f) (pending) delete any pair (UI action partial), (g) see debug HUD with instrumentation (implemented), (h) future: differentiated prompt-too-large vs exhausted-attempts vs rate/network errors taxonomy, (i) future: rpm/tdp quota tracking & proactive allowance adjustment.
Removed from pending: URA reserve, allowance-aware prediction, bracket counter basics (now implemented). Remaining enhancements: richer tooltip breakdown, user-facing trim summaries.

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

### M11 Multi-Provider Extensibility (Post-M6 Generalization)
- [ ] Refine ProviderAdapter interface for streaming + usage metadata
- [ ] Anthropic adapter (non‑streaming) using same pipeline
- [ ] Tokenization strategy plug-in (drop-in true tokenizer; wire into estimator hook)
- [ ] Saved filter definitions (reserved syntax or UI stub)
  - Acceptance: Adding a second provider (Anthropic) requires only its adapter file + simple registration; existing send pipeline unchanged.

### M12 Release Prep
- [ ] README (user + quick start)
- [ ] Developer guide (arch, flows, adding features)
- [ ] ADRs: Filtering engine (ADR‑001), Storage approach (ADR‑002), Context assembly (ADR‑003)
- [ ] Manual regression checklist
- [ ] Versioning/tag process doc


## Change Log (Plan Evolution)
- 2025-09-01: Added model catalog v2 (cw, tpm, rpm, tpd) and budgeting change (effectiveMaxContext = min(cw, tpm)); implemented overflow-only trimming loop with telemetry + HUD redesign (resizable, multiline); removed new reply badge/UI lifecycle code; updated statuses in M6 (budgeting & telemetry tasks), added future throughput quota tracking task.
- 2025-08-31 (later): Added unified API Keys overlay keyboard navigation + Ctrl+K shortcut; command mode Enter behavior refined (restore selection on unchanged filter); persistent command history (Ctrl+P / Ctrl+N); docs (keyboard_reference, ui_layout) updated.
- 2025-08-24 (later): Implemented partition engine v1, anchoring modes, resize invalidation, new message lifecycle (pending send, badge, 'n' jump, filter clear B2). Added anchor & lifecycle unit tests; updated M5 status & adjusted oversized splitting requirement scope.
- 2025-08-24: Expanded M5 with edgeAnchoringMode (adaptive|strict), new message badge & 'n' key semantics, refined test matrix; added clarification placeholder for filtered reply behavior.
- 2025-08-23 (later 3): M4 completed (all functional items [x]; virtualization deferred). Removed stabilization checklist; advanced Immediate Next Focus to M5 partitioning & metadata.
- 2025-08-23 (later 2): Reclassified all M4 feature items from [x] to [~]; added explicit M4 Stabilization Checklist; reordered immediate focus to finish stabilization before partitioning.
- 2025-08-23 (later): Marked M4 partial (bugs); swapped order of Context Assembly and Metadata Navigation (now M6 & M5 respectively); added message partitioning tasks as precursor to navigation & metadata; updated immediate focus sequence.
- 2025-08-23: Consolidated duplicate sections; inserted Topic Management milestone (M4) reflecting implemented overlay system & focus trap; reordered upcoming work to prioritize Context Assembly (superseded by later change above).

---
This document supersedes prior fragmented plan sections. All future scope changes should modify this file only.
