## MaiChat Architecture Review & Functional Alignment (2025-09-04)

Author: Automated analysis

### Purpose
Consolidated architectural inventory, dependency & health assessment, and alignment review against the functional areas defined in `dev-notes.md` (Modal system, Message history, Topics, Command line filtering, New message processing, Configuration). Includes improvement roadmap.

---
## 1. Layered Architectural Overview

| Layer | Core Responsibilities | Key Modules / Files |
|-------|-----------------------|---------------------|
| Entry / Composition | Bootstrap DOM, wire subsystems, global event & key handling, HUD/debug, send lifecycle orchestration | `src/main.js` |
| Domain Model & State | Message & topic models, in‑memory storage, derived indexes, persistence (IndexedDB), settings, model catalog | `models/*.js`, `store/memoryStore.js`, `store/indexes.js`, `persistence/contentPersistence.js`, `store/indexedDbAdapter.js`, `settings/index.js`, `models/modelCatalog.js` |
| Context & Budgeting | Token heuristics, predictive inclusion boundary (URA reserve) | `context/tokenEstimator.js`, `context/boundaryManager.js` (legacy: `gatherContext.js`) |
| Filtering Language | Lexing, parsing, evaluating subset query language | `filter/lexer.js`, `filter/parser.js`, `filter/evaluator.js` |
| Partition & Presentation | Text → wrapped lines → parts, part navigation, history rendering, scroll anchoring, auto view switch | `partition/partitioner.js`, `ui/parts.js`, `ui/history/historyView.js`, `ui/scrollControllerV3.js`, `ui/newMessageLifecycle.js` |
| Interaction & Modes | Mode state machine, keyboard routing, focus trap, modal primitives | `ui/modes.js`, `ui/keyRouter.js`, `ui/focusTrap.js`, `ui/openModal.js` |
| Overlays / Editors | Settings, Topics (editor & picker), Models (selector & editor), API keys, Help | `ui/settingsOverlay.js`, `ui/topicEditor.js`, `ui/topicPicker.js`, `ui/modelSelector.js`, `ui/modelEditor.js`, `ui/apiKeysOverlay.js`, `ui/helpOverlay.js` |
| Send Pipeline & Provider | Message assembly, overflow trimming loop, telemetry, provider abstraction & adapter, API keys | `send/pipeline.js`, `provider/adapter.js`, `provider/openaiAdapter.js`, `api/keys.js` |
| Utilities & Legacy | HTML escaping, (legacy) anchor/window scroller, deprecated gatherContext | `ui/util.js`, `ui/anchorManager.js`*, `ui/windowScroller.js`*, `context/gatherContext.js`* |

*Starred entries are legacy / removal candidates.

---
## 2. Dependency Characteristics

* Fan‑in hubs (used by many): `settings/index.js`, `tokenEstimator.js`, `memoryStore.js`.
* Single dominant fan‑out: `main.js` (imports nearly every subsystem → God file risk).
* Cycles avoided; UI does not leak into lower domain layers (good separation at data & estimation layers).
* BoundaryManager cleanly supersedes `gatherContext` (legacy still present → cleanup opportunity).

Simplified data flow for a send:
Store → (filtered chronological list) → BoundaryManager prediction → Send Pipeline (attempt + trimming) → Provider → Store update → Partitioning → History render → Scroll & Focus logic → (optional) Mode auto-switch.

---
## 3. File Inventory & Health Ratings

Health Scale: A (fits well) · B (minor issues) · C (needs refactor) · D (problem) · L (legacy to remove)

| File / Module | LOC | Purpose (Concise) | Health | Notes |
|---------------|----:|------------------|--------|-------|
| `src/main.js` | 1389 | Monolithic bootstrap + UI orchestration & debug | D | Primary architectural debt; split recommended. |
| `models/messagePair.js` | 43 | Message pair factory & shape | A | Cohesive & simple. |
| `models/topic.js` | 22 | Topic factory | A | OK. |
| `models/modelCatalog.js` | 70 | Static model metadata & persistence | B | Extract persistence if catalog grows. |
| `store/memoryStore.js` | 203 | Canonical state + counts + events | A | Core abstraction solid. |
| `store/indexes.js` | 70 | Derived indexes | B | Rebuild-on-update simple; scalable optimization later. |
| `persistence/contentPersistence.js` | 129 | Debounced persistence + migrations | B | Migration helpers could separate. |
| `store/indexedDbAdapter.js` | 65 | IndexedDB adapter | A | Thin & focused. |
| `settings/index.js` | 80 | Reactive settings + migrations | A | Clear; consider schema version constant. |
| `context/tokenEstimator.js` | 90 | Token estimation & boundary compute | A | Well-scoped; consider adaptive refinement later. |
| `context/boundaryManager.js` | 100 | Cached boundary + dirty reasons | A | Good encapsulation. |
| `context/gatherContext.js` | 22 | Legacy boundary assembly | L | Remove after test purge. |
| `filter/lexer.js` | 61 | Tokenization | A | Extensible. |
| `filter/parser.js` | 65 | AST builder w/ implicit AND | A | Minimal & correct. |
| `filter/evaluator.js` | 87 | Filter execution | A | Extend with topics & dates later. |
| `partition/partitioner.js` | 194 | Text wrapping & part slicing | B | Measurement & cache logic could modularize. |
| `ui/parts.js` | 65 | Parts building & active navigation | A | Clean. |
| `ui/history/historyView.js` | 120 | DOM assembly of parts & gaps | A | Full re-render acceptable for now; diffing later. |
| `ui/scrollControllerV3.js` | 264 | Anchor invariant + adaptive scroll | B | Dense; candidate for sub-modules (geometry, animation). |
| `ui/newMessageLifecycle.js` | 99 | Pending send & auto switch heuristic | A | Focus logic isolated; testable helper exported. |
| `ui/modes.js` | 17 | Mode FSM | A | Minimal & stable. |
| `ui/keyRouter.js` | 31 | Global key dispatch | A | Clear; consider plug-in mapping. |
| `ui/settingsOverlay.js` | 370 | Settings UI | C | Break into sectional components. |
| `ui/topicEditor.js` | 328 | Topic CRUD & navigation | C | Extract tree abstraction & command actions. |
| `ui/topicPicker.js` | 139 | Topic selection overlay | B | Reasonable; unify shared modal list patterns. |
| `ui/modelSelector.js` | 58 | Model picker | A | Lean. |
| `ui/modelEditor.js` | 84 | Model enable/disable & active selection | A | Fine. |
| `ui/apiKeysOverlay.js` | 84 | API key entry | A | OK. |
| `ui/helpOverlay.js` | 25 | Help info overlay | A | OK. |
| `ui/focusTrap.js` | 33 | Focus management for modals | A | Reusable. |
| `ui/openModal.js` | 30 | Modal shell | A | Good primitive. |
| `ui/anchorManager.js` | 62 | Deprecated anchor logic | L | Remove (replaced by scrollControllerV3). |
| `ui/windowScroller.js` | 152 | Legacy scroll impl | L | Remove after confirming unused. |
| `send/pipeline.js` | 168 | Send & trimming attempts + telemetry | A | Solid; add event hooks & streaming later. |
| `provider/adapter.js` | 39 | Provider registry & error classification | A | Extensible. |
| `provider/openaiAdapter.js` | 60 | OpenAI integration + timings | A | Consider streaming upgrade. |
| `api/keys.js` | 40 | API key storage | A | Minimal. |
| `ui/util.js` | 5 | HTML escape | A | Fine. |

---
## 4. Functional Specification Alignment (from `dev-notes.md`)

### 0. Modal System & Mode Management
Status: Implemented (INPUT, VIEW, COMMAND) with `ModeManager`, `KeyRouter`, distinct UI zones. Auto-switch heuristic for large reply integrated. Missing: formal abstraction for per-mode keybinding maps (currently hard-coded), and separation of command interpreter logic out of `main.js`.

### 1. Message History
Implemented Features: Data model, partitioning by viewport-based part fraction, active part navigation, anchor-based scrolling invariant, spacing/fade configuration, metadata display (stars, flags, token inclusion state), error resend/delete.

Gaps: Metadata editing breadth (ranking variants), search highlighting, virtualization for very large histories, accessibility semantics.

### 2. Topic Management System
Implemented: Hierarchical topics, counts, editor CRUD/move, picker, persistence.
Gaps: Semantic topic filter integration, advanced search, batch operations.

### 3. Command Line Filtering System
Implemented: Lexer/parser/evaluator for s,r,m,b,g,c filters, logical ops, command history, debug toggles.
Gaps: Topic & date filters, token/length predicates, scripting extensions.

### 4. New Message Processing & API Calls
Implemented: Predictive boundary (URA), trimming retries, telemetry, focus auto-switch, error handling.
Gaps: Streaming responses, abort, adaptive token calibration, event emission abstraction.

### 5. Configuration Management
Implemented: Settings overlay (UI + token params), API keys, model catalog, help overlay.
Gaps: Modularization, export/import, dynamic keybinding help.

Cross-Cutting: Flexible context management partially realized (automatic prediction + trimming) but lacks manual include/exclude and scripting DSL.

---
## 5. Gap Summary & Impact Matrix

| Gap | Area | Impact | Effort | Priority |
|-----|------|--------|--------|----------|
| Monolithic `main.js` | Composition | High | Medium | P1 |
| Legacy modules undeleted | Clarity | Medium | Low | P1 |
| Weak topic filtering semantics | Filtering | Medium | Low-Med | P2 |
| No streaming responses | UX | Medium-High | Medium | P2 |
| No abort send | Reliability | Medium | Low | P2 |
| Lack keybinding registry | Ergonomics | Medium | Low-Med | P2 |
| Oversized overlays | Maintainability | Medium | Medium | P2 |
| Missing manual context overrides | Context control | Medium | Med-High | P3 |
| Absent scripting extensions | Differentiator | High | High | P3 |
| Adaptive token heuristic missing | Accuracy | Medium | Medium | P3 |
| Accessibility gaps | Quality | Medium | Medium | P2 |

---
## 6. Recommended Refactor & Feature Roadmap
(Phased list retained – see discussion section for rationale.)

Phase 1: Extract modules from `main.js`, remove legacy, introduce `events.js`, unify telemetry.
Phase 2: Keybinding registry, streaming + abort, richer filters, overlay modularization.
Phase 3: Manual context include/exclude, adaptive token calibration, CLI scripting primitives, settings export/import.
Phase 4: Virtualized history, incremental partition caching, telemetry aggregation.

---
## 7. Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Centralized orchestration complexity | Early modular extraction + event bus |
| Performance at scale | Virtualization & diff rendering (Phase 4) |
| Token prediction drift | Adaptive calibration + user overrides |
| Overlay complexity growth | Componentization & size budgets |
| Filter language stagnation | Formal mini-spec & incremental test-driven extension |

---
## 8. Strengths
Decoupled prediction layer, robust trimming pipeline, keyboard-first design, partition abstraction enabling future virtualization, clear token budgeting semantics.

## 9. Weaknesses
Monolithic composition file, legacy remnants, limited command language depth, large overlay modules, lack of centralized events/telemetry facade.

---
## 10. Immediate Action Checklist
1. Create `src/app/` directory and extract: `bootstrap.js`, `hud.js`, `commandProcessor.js`, `menuAndShortcuts.js`.
2. Add `src/app/events.js` (pub/sub) + emit autoFocusSwitch, sendAttempt, sendResult.
3. Delete legacy (`gatherContext.js`, `anchorManager.js`, `windowScroller.js`) after test audit.
4. Implement topic name/path filter in evaluator (`t:"Design/*"`).
5. Add provider streaming callback skeleton (no UI changes yet) for OpenAI adapter.

---
## 11. Alignment Verdict
Current codebase meets MVP functional pillars; largest divergence from vision is advanced CLI scripting & manual context curation. Architectural debt is localized (main.js, legacy files) and manageable if addressed prior to expanding feature surface.

---
## 12. Event Taxonomy (Proposed)
| Event | Payload (indicative) | Purpose |
|-------|----------------------|---------|
| send.attempt | { attempt, model, predictedTokens, includedCount } | Trim efficiency analysis |
| send.success | { attempt, durationMs, trimmedCount, usage } | Performance/usage metrics |
| send.error | { attempt, code, trimmedCount, stage } | Reliability tracking |
| context.predicted | { predictedCount, predictedTokens, URA } | Estimation calibration |
| context.trimmed | { trimmedCount, finalTokens } | Budget health |
| ui.autoFocusSwitch | { replyHeight, paneHeight, multiPart } | UX heuristic tuning |
| filter.applied | { query, visibleCount } | Language usage insights |

---
### End of Document
