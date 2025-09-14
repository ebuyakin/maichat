## MaiChat Architecture (Revised After Phase 1 Refactor)

---
## 1. Functional Structure (Problem / Capability View)
Each numbered capability is the “why”; later layers & files are the “how”.

0. Modal System & Mode Management
	Inputs: keyboard events, focus changes. Outputs: active mode state (INPUT | VIEW | COMMAND), visual mode indicator, constrained keybinding dispatch.
	Invariants: exactly one active mode; global key router delegates by mode; UI zones reflect mode semantics (top = command line, middle = history viewport, bottom = input composer).

1. Message History
	Concerns: persistence-backed ordered list of message pairs + metadata (stars, flags, topic ref, model, error state). Partitioning of long texts into “parts” sized relative to viewport fraction. Active part navigation and stable scroll anchoring. Visual context inclusion marking. Adjustable spacing & fading heuristics.
	Primary invariant: Active part remains visually positioned according to anchor mode (bottom|center|top) while preserving continuity under content growth or resize.

2. Topic Management
	Hierarchical topic tree (rooted), CRUD + move + rename, path derivation, selection for new message, re-assignment for existing messages.
	Invariant: All message pairs reference a valid topic ID; root is never deleted.

3. Command Line Filtering System
	Domain-specific filtering DSL (lexer → parser → evaluator) producing a subset of message pairs for view & context prediction. Command input doubles as future scripting extension point.
	Invariant: Filter application is pure relative to store state (side-effect free outside of view selection). Errors surfaced inline without altering prior selection.

4. New Message Processing & API Interaction
	Assemble candidate context (predictive inclusion using boundary manager), submit to provider with trimming retry loop, capture response, update store, reposition focus, optionally switch modes.
	Invariant: Send pipeline never mutates store mid-attempt except to mark sending state; only final accepted attempt commits content or error.

5. Configuration & Preferences
	Settings (token heuristics, spacing/fade, anchor mode, attempts), API keys, model catalog management, help overlay. Real-time reactive updates (e.g., partition invalidation on spacing change).
	Invariant: Settings mutations are versioned/migrated and immediately reflected in runtime rendering/layout when relevant.

Cross-Cutting (Enablers): Predictive Context Budgeting (URA concept), Diagnostics (HUD + Request Debug), Keyboard-Centric Interaction, Deterministic Rendering Pipeline.

---
## 2. Layered Architectural Overview (Implementation View)
| Layer | Responsibility Focus | Key Modules|
|-------|----------------------|-----------------------------|

Layer Interaction Narrative:

Design Rationale:

---
## 3. Folder & File Inventory (Hierarchical Health)
Health Scale: A (clean & cohesive) · B (minor issues / watch) · C (refactor desirable) · L (legacy)

| Path / Folder | LOC | Role (Summary) | Health | Notes |
|---------------|----:|----------------|--------|-------|
| **(total project)** | 5032 | All JS sources (excludes assets/CSS) | B | Concentrated earlier in `ui/`; migration in progress. |
| **ROOT:** | 5032 | Root source aggregate | B | Single entry + functional folders; no circular deps observed. |
| `src/main.js` | 146 | Slim entry: DOM skeleton + composition & bootstrap call | B | Could externalize static markup if theming needed. |
| **RUNTIME:** | 128 | Runtime composition & startup orchestration | A | Small, ordered, side-effects isolated. |
| `runtime/runtimeSetup.js` | 75 | Build core runtime context object | A | Straight-line factory, stable. |
| `runtime/bootstrap.js` | 53 | Deterministic startup sequencing | A | Explicit ordering; easy to extend. |
| **STORE:** | 399 | Canonical state, indexes, persistence wiring, demo data | A | Central abstraction stable. |
| `store/memoryStore.js` | 203 | In-memory state + events | A | Clear mutation API. |
| `store/indexes.js` | 70 | Derived indexes | B | Recompute strategy fine. |
| `store/indexedDbAdapter.js` | 65 | IndexedDB adapter boundary | A | Thin & focused. |
| `store/demoSeeding.js` | 61 | Demo dataset seeding helpers | A | Dev-only; isolated. |
| **MODELS:** | 135 | Data shape factories & model catalog | A | Simple, dependency-light. |
| `models/messagePair.js` | 43 | Message pair factory | A | Minimal. |
| `models/topic.js` | 22 | Topic factory | A | Minimal. |
| `models/modelCatalog.js` | 70 | Model registry & selection | B | Watch growth. |
| **PERSISTENCE:** | 129 | Persistence policy (debounce, migrations) | B | Could extract migrations later. |
| `persistence/contentPersistence.js` | 129 | Persistence orchestration | B | Debounce + schema logic. |
| **SETTINGS:** | 80 | Reactive settings & migrations | A | Widely reused. |
| `settings/index.js` | 80 | Settings API | A | Version hook ready. |
| **CONTEXT:** | 212 | Context prediction & token estimation | A | Core heuristics; one legacy file pending removal. |
| `context/boundaryManager.js` | 100 | Predict & cache inclusion boundary | A | Clear invalidation model. |
| `context/tokenEstimator.js` | 90 | Char→token heuristic | A | Calibrate later. |
| `context/gatherContext.js` | 22 | Legacy gather logic | L | Remove post confirmation. |
| **FILTER:** | 213 | Filtering DSL (lex/parse/eval) | A | Ready for extensions. |
| `filter/lexer.js` | 61 | Tokenization | A | Extensible. |
| `filter/parser.js` | 65 | AST builder | A | Minimal. |
| `filter/evaluator.js` | 87 | Filter execution | A | Pure. |
| **PARTITION (Pre-move legacy entry)** | 194 | Text wrapping & part sizing | B | Logic now under features/history. |
| **SEND** | 168 | Send pipeline & trimming loop | A | Streaming hook pending. |
| `send/pipeline.js` | 168 | Attempt orchestration | A | Ready for events/streaming. |
| **PROVIDER** | 99 | Provider abstraction & OpenAI adapter | A | Add streaming/abort later. |
| `provider/adapter.js` | 39 | Provider registry | A | Extensible. |
| `provider/openaiAdapter.js` | 60 | OpenAI implementation | A | Streaming upgrade path. |
| **API:** | 40 | API key storage | A | Minimal boundary. |
| `api/keys.js` | 40 | Key persistence | A | Fine. |
| **UI:** | 3089 | Presentation, interaction, overlays, instrumentation | B | Will shrink as migration proceeds. |
| `ui/interaction/interaction.js` | 506 | Consolidated interaction logic | B | Consider split if >600 LOC. |
| `ui/modes.js` | 17 | Mode FSM | A | Minimal. |
| `ui/keyRouter.js` | 31 | Mode-aware key dispatch | A | Registry-compatible. |
| `ui/settingsOverlay.js` | 370 | Settings UI | C | Modularize into panels. |
| `ui/topicEditor.js` | 328 | Topic CRUD/navigation | C | Extract tree & keyboard command module. |
| `ui/topicPicker.js` | 139 | Topic selection modal | B | Unify list patterns later. |
| `ui/modelSelector.js` | 58 | Model picker | A | Focused. |
| `ui/modelEditor.js` | 84 | Model enable/disable | A | Lean. |
| `ui/apiKeysOverlay.js` | 84 | API key management | A | Minimal. |
| `ui/helpOverlay.js` | 25 | Help overlay | A | Stable. |
| `ui/openModal.js` | 30 | Modal shell | A | Generic primitive (now `shared/openModal.js`). |
| `ui/focusTrap.js` | 33 | Focus management | A | Now `shared/focusTrap.js`. |
| **features/history/historyRuntime.js** | 278 | History render/layout/fade/stats (moved) | B | Possible split later. |
| **features/history/historyView.js** | 120 | DOM assembly of parts (moved) | A | Pure view. |
| **features/history/scrollControllerV3.js** | 264 | Anchor-based scroll control (moved) | B | Geometry vs animation split possible. |
| **features/history/parts.js** | 65 | Part controller & navigation (moved) | A | Lean. |
| **features/history/newMessageLifecycle.js** | 99 | Pending send & focus heuristics (moved) | A | Stable. |
| **features/history/partitioner.js** | 194 | Message segmentation (moved) | B | Candidate for helper extraction. |
| **instrumentation/hudRuntime.js** | 216 | Live metrics HUD | B | Could split into panels. |
| **instrumentation/requestDebugOverlay.js** | 123 | Request diagnostics overlay | A | Self-contained. |
| **shared/** | 68 | Reusable primitives | A | Small & generic. |
| shared/openModal.js | 30 | Modal primitive | A | Stable. |
| shared/focusTrap.js | 33 | Focus containment | A | Stable. |
| shared/util.js | 5 | HTML escape | A | Minimal. |
| **legacy/** | 236 | Deprecated implementations | L | Quarantined. |
| legacy/gatherContext.js | 22 | Old context assembly | L | Remove soon. |
| legacy/anchorManager.js | 62 | Old anchor logic | L | Superseded. |
| legacy/windowScroller.js | 152 | Old scrolling impl | L | Superseded. |
| **aggregates (overlays subset)** | 1234 | Sum overlay UIs | B | Modularization candidate. |
| **aggregates (instrumentation subset)** | 339 | HUD + request debug | A | Removable for prod build. |
| **aggregates (legacy subset)** | 236 | Deprecated code | L | Pending deletion. |
| **Total (non-legacy)** | 4796 | Active codebase excluding legacy | B | Legacy removal will reduce noise. |

Structural Observations:
* Entry shrink 1389 → 146 LOC reduced composition risk surface.
* Hotspots: `ui/interaction/interaction.js` (pre-move) & `features/history/historyRuntime.js`.
* UI folder dominance already shrinking as history code migrated to features.
* Legacy subset isolation plus impending deletion of original history/partition files will reduce search noise.

---
## 4. Architectural Evaluation (Qualitative)

Strengths:

Tensions / Trade-offs:

Risks:

---
## 5. Future Refactoring & Evolution Suggestions

---
## 6. Summary
