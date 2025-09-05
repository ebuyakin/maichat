## MaiChat Architecture (Revised After Phase 1 Refactor)

Date: 2025-09-04
Scope: Architectural description & evaluation only. Execution status, task checklists, and granular roadmap tracking are intentionally excluded per guideline. Focus is on what the system *is*, why it is shaped this way, and where structural leverage exists for future evolution.

---
## 1. Functional Structure (Problem / Capability View)
Source: Consolidated from `dev-notes.md` (#codebase) with clarified boundaries and implicit contracts. Each numbered capability is the “why”; later layers & files are the “how”.

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

Cross-Cutting (Enablers):
	Predictive Context Budgeting (URA concept), Diagnostics (HUD + Request Debug), Keyboard-Centric Interaction, Deterministic Rendering Pipeline.

---
## 2. Layered Architectural Overview (Implementation View)
Refactor Outcome: Previous monolithic composition collapsed into explicit strata. Each layer has a narrow responsibility boundary and communicates through plain data objects & small function contracts—no global event bus yet (intentionally deferred to avoid premature abstraction).

| Layer | Responsibility Focus | Key Modules (post-refactor) |
|-------|----------------------|-----------------------------|
| Entry (Slim) | Inject static DOM skeleton, instantiate core modules, delegate boot & exposure | `src/main.js` |
| Runtime Composition | Construct foundational services (store, indexes, persistence, boundary mgr, scroll, lifecycle, pending meta) | `runtime/runtimeSetup.js` |
| Bootstrap Orchestration | Order-sensitive startup (provider registration, persistence init, catalog load, spacing styles, seeding, first render, unload flush) | `runtime/bootstrap.js` |
| History Rendering Runtime | Build parts, render history, layout pane sizing, active part update, fading, context stats integration, status indicators | `ui/history/historyRuntime.js`, `ui/history/historyView.js`, `ui/parts.js` |
| Interaction Layer | Mode-aware key routing, command filter application, command history, star/flag/model/topic actions, send triggers, menu & overlays dispatch | `ui/interaction/interaction.js`, `ui/modes.js`, `ui/keyRouter.js` |
| Send & Context Prediction | Predict inclusion boundary, trimming & retry, request assembly, provider invocation, error classification | `send/pipeline.js`, `context/boundaryManager.js`, `context/tokenEstimator.js`, `provider/adapter.js`, `provider/openaiAdapter.js` |
| Partitioning & Scroll Mechanics | Logical line wrapping into parts, active part controller, anchor-based scroll invariants | `partition/partitioner.js`, `ui/scrollControllerV3.js`, `ui/parts.js` |
| Overlays (Modal UI) | Topical editors, pickers, settings, model management, API key input, help | `ui/topicEditor.js`, `ui/topicPicker.js`, `ui/settingsOverlay.js`, `ui/modelSelector.js`, `ui/modelEditor.js`, `ui/apiKeysOverlay.js`, `ui/helpOverlay.js`, `ui/openModal.js`, `ui/focusTrap.js` |
| Diagnostics / Instrumentation | Live HUD metrics, request-level debug payload presentation | `instrumentation/hudRuntime.js`, `instrumentation/requestDebugOverlay.js` |
| Domain Models & State | Message & topic factories, in-memory store, derived indexes, persistence boundary, catalog & settings | `models/*.js`, `store/*.js`, `persistence/contentPersistence.js`, `settings/index.js`, `api/keys.js` |
| Legacy (To Retire) | Superseded context & scrolling implementations | `context/gatherContext.js`, `ui/anchorManager.js`, `ui/windowScroller.js` |

Layer Interaction Narrative:
	1. Entry builds runtime context (composition layer) and history runtime, then hands control to bootstrap.
	2. Bootstrap performs one-time sequence (provider reg → persistence init → catalog ensure → optional demo seeding → initial render → layout sizing → remove loading overlay).
	3. Interaction layer responds to user input, mutating store or lifecycle state and invoking history runtime re-renders.
	4. Send pipeline (triggered from interaction) queries boundary manager for predicted inclusion, orchestrates trimming attempts, and feeds debug overlays via simple callbacks.
	5. History runtime renders parts and coordinates scroll controller to enforce anchor invariants; diagnostics read its getters (no back-calls) – a unidirectional observability edge.

Design Rationale:
	* Chose function factories over classes for ergonomic dependency injection (plain objects reduce coupling & ease test doubles).
	* Deferred event bus: current synchronous direct calls preserve clarity; bus will add value only when multiple observers (telemetry, UI instrumentation, plugins) emerge simultaneously.
	* Diagnostics isolated so removal for production build (future) is trivial (tree-shakable boundary).

---
## 3. Folder & File Inventory (Hierarchical Health)
Health Scale: A (clean & cohesive) · B (minor issues / watch) · C (refactor desirable) · L (legacy)  
LOC values reflect post-refactor snapshot (#codebase measurement on key modified files).
| Path / Folder | LOC | Role (Summary) | Health | Notes |
|---------------|----:|----------------|--------|-------|
| **(total project)** | 5032 | All JS sources (excludes assets/CSS) | B | Concentrated size in `ui/` (61%). Optimization targets identified below. |
| **ROOT:** | 5032 | Root source aggregate | B | Single entry + functional folders; no circular deps observed. |
| `src/main.js` | 146 | Slim entry: DOM skeleton + composition & bootstrap call | B | Could externalize static markup if theming needed. |
| **RUNTIME:** | 128 | Runtime composition & startup orchestration | A | Small, ordered, side-effects isolated. |
| `runtime/runtimeSetup.js` | 75 | Build core runtime context object | A | Straight-line factory, stable. |
| `runtime/bootstrap.js` | 53 | Deterministic startup sequencing | A | Explicit ordering; easy to extend. |
| **STORE:** | 399 | Canonical state, indexes, persistence wiring, demo data | A | Central abstraction stable; watch for UI leakage. |
| `store/memoryStore.js` | 203 | In-memory state + events | A | Clear mutation API. |
| `store/indexes.js` | 70 | Derived indexes | B | Recompute strategy fine; perf tuning later. |
| `store/indexedDbAdapter.js` | 65 | IndexedDB adapter boundary | A | Thin & focused. |
| `store/demoSeeding.js` | 61 | Demo dataset seeding helpers | A | Dev-only; isolated. |
| **MODELS:** | 135 | Data shape factories & model catalog | A | Simple, dependency-light. |
| `models/messagePair.js` | 43 | Message pair factory | A | Minimal. |
| `models/topic.js` | 22 | Topic factory | A | Minimal. |
| `models/modelCatalog.js` | 70 | Model registry & selection | B | Mixes static + active; acceptable scale. |
| **PERSISTENCE:** | 129 | Persistence policy (debounce, migrations) | B | Could extract migrations if they grow. |
| `persistence/contentPersistence.js` | 129 | Persistence orchestration | B | Debounce + schema logic. |
| **SETTINGS:** | 80 | Reactive settings & migrations | A | Cohesive, widely reused. |
| `settings/index.js` | 80 | Settings API | A | Version hook ready. |
| **CONTEXT:** | 212 | Context prediction & token estimation | A | Core heuristics; one legacy file pending removal. |
| `context/boundaryManager.js` | 100 | Predict & cache inclusion boundary | A | Clear invalidation model. |
| `context/tokenEstimator.js` | 90 | Char→token heuristic | A | Simple, calibratable. |
| `context/gatherContext.js` | 22 | Legacy gather logic | L | Remove post test confirmation. |
| **FILTER:** | 213 | Filtering DSL (lex/parse/eval) | A | Pure; ready for topic/date extensions. |
| `filter/lexer.js` | 61 | Tokenization | A | Extensible. |
| `filter/parser.js` | 65 | AST builder | A | Minimal & correct. |
| `filter/evaluator.js` | 87 | Filter execution | A | Extend with topics/dates. |
| **PARTITION:** | 194 | Text wrapping & part sizing | B | Dense; split measurement logic later. |
| `partition/partitioner.js` | 194 | Partition computation | B | Candidate for helper extraction. |
| **SEND** | 168 | Send pipeline & trimming loop | A | Streaming hook pending. |
| `send/pipeline.js` | 168 | Attempt orchestration | A | Ready for events/streaming. |
| **PROVIDER** | 99 | Provider abstraction & OpenAI adapter | A | Add streaming/abort signatures later. |
| `provider/adapter.js` | 39 | Provider registry | A | Extensible. |
| `provider/openaiAdapter.js` | 60 | OpenAI implementation | A | Streaming upgrade path. |
| **API:** | 40 | API key storage | A | Minimal boundary. |
| `api/keys.js` | 40 | Key persistence | A | Fine. |
| **UI:** | 3089 | Presentation, interaction, overlays, instrumentation | B | Largest surface; two large hotspots plus legacy files. |
| `ui/interaction/interaction.js` | 506 | Consolidated interaction logic | B | Consider internal split if >600 LOC. |
| `ui/history/historyRuntime.js` | 278 | History render/layout/fade/stats | B | Could separate visibility/layout later. |
| `ui/history/historyView.js` | 120 | DOM assembly of parts | A | Pure view. |
| `ui/scrollControllerV3.js` | 264 | Anchor-based scroll control | B | Geometry vs animation split possible. |
| `ui/parts.js` | 65 | Part controller & navigation | A | Lean. |
| `ui/newMessageLifecycle.js` | 99 | Pending send & focus heuristics | A | Stable. |
| `ui/modes.js` | 17 | Mode FSM | A | Minimal. |
| `ui/keyRouter.js` | 31 | Mode-aware key dispatch | A | Registry-compatible. |
| `ui/settingsOverlay.js` | 370 | Settings UI | C | Modularize into panels. |
| `ui/topicEditor.js` | 328 | Topic CRUD/navigation | C | Extract tree & keyboard command module. |
| `ui/topicPicker.js` | 139 | Topic selection modal | B | Good; unify list patterns later. |
| `ui/modelSelector.js` | 58 | Model picker | A | Focused. |
| `ui/modelEditor.js` | 84 | Model enable/disable | A | Lean. |
| `ui/apiKeysOverlay.js` | 84 | API key management | A | Minimal. |
| `ui/helpOverlay.js` | 25 | Help overlay | A | Stable. |
| `ui/openModal.js` | 30 | Modal shell | A | Generic primitive. |
| `ui/focusTrap.js` | 33 | Focus management | A | Reusable. |
| `instrumentation/hudRuntime.js` | 216 | Live metrics HUD | B | Verbose string assembly; possible section modules. |
| `instrumentation/requestDebugOverlay.js` | 123 | Request diagnostics overlay | A | Self-contained. |
| `ui/util.js` | 5 | HTML escape util | A | Keep minimal. |
| `ui/anchorManager.js` | 62 | Legacy anchor logic | L | Remove after verification. |
| `ui/windowScroller.js` | 152 | Legacy scroll impl | L | Remove; replaced by V3 controller. |
| **overlays (subset)** | 1234 | (Sum of overlay-related files) | B | Internal modularization candidate (settings/topic). |
| **diagnostics (subset)** | 339 | HUD + request debug | A | Read-only dependencies; removable for prod build. |
| **legacy (subset)** | 236 | Legacy anchor/scroll/context gather | L | Safe to delete post test grep. |
| **styles / misc** | - | (CSS, assets excluded from LOC calc) | - | Out of scope for code health table. |
| **Total (non-legacy)** | 4796 | Active codebase excluding legacy rows | B | Legacy removal will drop noise by ~4.7%. |

Structural Observations:
	* Entry shrink 1389 → 146 LOC reduced composition risk surface dramatically.
	* Hotspots: `ui/interaction/interaction.js` & `ui/history/historyRuntime.js`; both cohesive; monitor size creep.
	* UI folder dominates (61% LOC); targeted splits should prioritize overlays & interaction if complexity grows.
	* Legacy subset isolation clarifies deletion path (no active dependencies expected). Legacy removal reduces search noise.

---
## 4. Architectural Evaluation (Qualitative)
Strengths:
	* Clear vertical seams: prediction, rendering, interaction, diagnostics decoupled via data callbacks—not shared mutable globals.
	* Predictive context pipeline isolated, enabling future model-specific strategies without UI churn.
	* Diagnostics read-only dependency flow prevents instrumentation from influencing core logic (low risk of Heisenbugs).
	* Keyboard-first modality implemented with minimal surface (tiny FSM + router) → adaptable for future keybinding registry.

Tensions / Trade-offs:
	* High LOC interaction module balances latency (fewer indirections) against maintainability; future micro-modularization must avoid over-fragmentation (cognitive load > benefit if premature).
	* Absence of event bus deliberately postpones decoupling; adding one too early could obscure execution order (critical during early correctness maturation).
	* Partition recalculation & scroll measurement are tightly timed; more abstraction could impair performance predictability prior to adding virtualization.

Risks (Residual After Phase 1):
	* Growth in interaction commands may push file >650 LOC → refactor trigger threshold.
	* Settings overlay expansion without decomposition may reduce approachability for new contributors.
	* Manual context overrides (future feature) risk entangling boundary manager with UI state unless mediated by an event or policy layer.

---
## 5. Future Refactoring & Evolution Suggestions (Architecture-Focused)
Ordered by leverage (impact / effort ratio), not by feature marketing priority. These are *suggestions*, not a committed plan document.

1. Remove Legacy Files (Low Effort / High Clarity)
	 Delete `context/gatherContext.js`, `ui/anchorManager.js`, `ui/windowScroller.js` once test grep confirms non-use. Eliminates misleading search hits and reduces cognitive noise.

2. Introduce Lightweight Event / Telemetry Facade (Moderate)
	 Scope: minimal pub/sub for send lifecycle (attempt, success, error) + context prediction outcome. Keep synchronous dispatch; avoid wildcard subscriptions. Benefit: instrumentation & potential future plugin surface without tight coupling to send pipeline. Guardrail: forbid business logic mutations inside subscribers (documentation + TypeScript typedef later).

3. Interaction Module Internal Splitting (Conditional Trigger)
	 If file exceeds ~600 LOC or churn hot-spot emerges, split by concern: `commandExecution`, `menuAndOverlays`, `sendHandlers`, `metadataActions`. Each submodule pure functions returning binder objects to preserve current factory pattern.

4. History Runtime Micro-Split (Deferred)
	 Extract `fadeVisibilityEngine` & `layoutSizing` if additional complexity (e.g., accessibility overlays, virtualization scaffolding) appears. Until then single-file locality aids reasoning about render timing.

5. Provider Streaming & Abort Hooks (Strategic)
	 Add optional callbacks (`onToken`, `onAbort`) to `provider/adapter` contract. Pipeline can branch: immediate optimistic part insertion vs buffered finalize. Architectural prerequisite: stable event facade (#2) to keep diagnostics decoupled from streaming state transitions.

6. Keybinding Registry Abstraction
	 Replace hard-coded conditionals with declarative registry: `{ mode, key, handler, when? }`. Enables dynamic help generation and future user customization. Registry can live adjacent to interaction layer; maintain deterministic ordering (first-match precedence) to avoid ambiguity.

7. Overlay Modularization
	 Apply internal composition to `settingsOverlay.js` & `topicEditor.js` (panel components + data adapters). Benefit: isolate stateful logic for unit testing; reduce PR conflict surface.

8. Manual Context Override Layer
	 Add a “context policy” module sitting between interaction and boundary manager: merges auto-predicted inclusion with user pins/exclusions. Ensures prediction algorithm stays pure; avoids scattering override checks across render & send logic.

9. Adaptive Token Heuristic Calibration
	 Introduce background sampler comparing predicted vs actual token counts (once real provider usage metrics accrued). Event facade (#2) used to feed calibration data; boundary manager updated via stable interface (no structural churn).

10. Virtualized History (Scale Phase)
	 Only upon demonstrated performance pain: replace full re-render of parts with windowed renderer. Keep `ActivePartController` API stable so higher layers unaffected. Partitioning stays separate; virtualization layer becomes a thin mapping from logical part indices → mounted DOM nodes.

Non-Goals (Explicit for Clarity Right Now):
	* Theming system (no concrete need yet).
	* Plugin API (defer until event facade mature & use-cases validated).
	* Full scripting DSL in command line (premature without validated advanced filtering demand).

---
## 6. Summary
The codebase now reflects intentional layering: composition, interaction, rendering, prediction, and diagnostics are separated with minimal abstraction overhead. Remaining architectural debt concentrates in two high-LOC but cohesive modules and in unremoved legacy files. Future leverage lies in introducing a *thin* event/telemetry seam, cautious modularization of large overlays, and preparing seams (streaming, context policy) that do not destabilize current correctness. The design is structurally sound for iterative feature growth while maintaining the keyboard-centric, context-aware vision.

End of document.

---
## Appendix: Proposed Folder & File Inventory (Updated per Instructions)
This proposal applies the requested adjustments: (1) Replace previous `app/` concept with `runtime/` (startup wiring only). (2) Keep `main.js` inside `src/` (conventional source-root entry; avoids root clutter). (3) Relocate `partitioner.js` into the history feature (its behavior is purely about how the user reads & navigates long messages). No file renames or edits—only moves. Health scale: A (clean) · B (watch) · C (refactor desirable) · L (legacy delete candidate).

| Path / Folder | LOC | Role (Summary) | Health | Notes (User-Oriented Responsibility) |
|---------------|----:|----------------|--------|-------------------------------------|
| **(total project)** | 5032 | All JS sources (current) | B | Baseline before performing moves. |
| **Total (non-legacy)** | 4796 | Active code (ex legacy) | B | Working surface after removing deprecated files. |
| src/main.js | 146 | Application entrypoint | B | Slim entry inside conventional `src/` root keeps repository top-level free of noise. |
| **runtime/** | 128 | Startup orchestration layer | A | Houses only boot sequencing & runtime container creation; when reading from top → you see how services are wired before any UI logic. |
| runtime/runtimeSetup.js | 75 | Build service container | A | Instantiates store, settings, context prediction & returns a plain object; no DOM or rendering entanglement. |
| runtime/bootstrap.js | 53 | Ordered initialization | A | Performs provider registration, persistence init, optional seeding, first render, layout sizing—each step obvious & linear for easy auditing. |
| **core/** | 933 | Domain & algorithmic engine | A | Data shapes, persistence policy, settings, predictive heuristics – everything that should remain stable even if UI changes drastically. |
| core/models/messagePair.js | 43 | Message factory | A | Defines the canonical structure of a user ↔ model exchange; single source of truth for message fields. |
| core/models/topic.js | 22 | Topic factory | A | Creates nodes for the hierarchical topic tree; minimal fields. |
| core/models/modelCatalog.js | 70 | Model registry | B | Tracks available LLM models & default selection; mixes config + state (watch growth). |
| core/store/memoryStore.js | 203 | In-memory state & mutations | A | Central mutation API (add messages, update metadata, topics) – other layers call here to change app state. |
| core/store/indexes.js | 70 | Derived indexes | B | Computes fast lookup maps (by topic, id); refactor only if perf hotspots emerge. |
| core/store/indexedDbAdapter.js | 65 | Persistence adapter | A | Encapsulates browser DB specifics so higher layers stay storage-agnostic. |
| core/store/demoSeeding.js | 61 | Demo data loader | A | Dev convenience for instantly populating a realistic conversation; isolated from production logic. |
| core/persistence/contentPersistence.js | 129 | Debounced persistence engine | B | Handles save timing & schema versioning; candidate to split migrations if they expand. |
| core/settings/index.js | 80 | Reactive settings store | A | Central place users’ adjustable preferences live; immediate propagation to runtime consumers. |
| core/context/boundaryManager.js | 100 | Context inclusion predictor | A | Decides which prior messages likely fit within token budget before sending; core to efficient prompting. |
| core/context/tokenEstimator.js | 90 | Token size heuristic | A | Rough sizing function supporting boundary decisions; calibrate later with real telemetry. |
| **features/** | 3043 | User-visible capabilities | B | Organized by “what the user does”: reading history, interacting via keys, filtering, managing topics, composing requests, configuring environment. |
| features/history/historyRuntime.js | 278 | History render & layout engine | B | Builds visual list of message parts, applies fading, recalculates layout on resize; user perceives this as smooth scrolling & consistent anchor. |
| features/history/historyView.js | 120 | History DOM builder | A | Creates actual DOM nodes for parts; intentionally dumb (no business logic) for easy future theming or virtualization swap. |
| features/history/scrollControllerV3.js | 264 | Anchor-based scroll control | B | Maintains chosen anchor (e.g. center) while new content arrives so user’s reading position doesn’t jump. |
| features/history/parts.js | 65 | Part navigation controller | A | Tracks which part is “active” (user focus) & exposes movement operations (j/k style navigation). |
| features/history/newMessageLifecycle.js | 99 | Post-send focus & insertion rules | A | Ensures after sending a prompt the viewport & focus update predictably for continued typing or reading. |
| features/history/partitioner.js | 194 | Message segmentation engine | B | Splits long messages into viewport-sized parts to optimize readability & keyboard navigation granularity. |
| features/interaction/interaction.js | 506 | Keyboard command hub | B | Parses keystrokes (based on mode) and routes to actions (filter, move, star, send); single place user “intent” mapping resides. |
| features/interaction/modes.js | 17 | Mode state machine | A | Minimal finite set (INPUT/VIEW/COMMAND); guarantees only one active mode at a time. |
| features/interaction/keyRouter.js | 31 | Mode-aware key dispatch | A | Sends key events to correct handlers; future registry injection point for customizable bindings. |
| features/command/lexer.js | 61 | Filter language tokenizer | A | Breaks command input into tokens; foundation for extending syntax (topics, dates). |
| features/command/parser.js | 65 | Filter AST builder | A | Converts tokens into a structured tree; errors stay local for clear user feedback. |
| features/command/evaluator.js | 87 | Filter execution | A | Pure function selecting which messages display; easy to test & extend. |
| features/topics/topicEditor.js | 328 | Topic tree editor UI | C | Complex UI: CRUD + reordering + keyboard navigation; needs decomposition into tree + actions panels for clarity. |
| features/topics/topicPicker.js | 139 | Topic selection modal | B | Lets user choose where new message lands; quick keyboard navigation focus. |
| features/compose/pipeline.js | 168 | Send & trimming pipeline | A | Orchestrates retries with shrinking context until provider accepts; central to reliable sending UX. |
| features/config/settingsOverlay.js | 370 | Settings interface | C | All settings panels bundled; refactor into modules to improve discoverability. |
| features/config/modelSelector.js | 58 | Model list UI | A | Simple enable/disable selection surface for models before editing details. |
| features/config/modelEditor.js | 84 | Model configuration editor | A | Adjust per-model parameters (future extension: temperature, etc.). |
| features/config/apiKeysOverlay.js | 84 | API key management UI | A | Secure input & storage boundary for keys the user provides. |
| features/config/helpOverlay.js | 25 | Help & key reference UI | A | Quick on-demand guidance so power users avoid leaving the app. |
| **infrastructure/** | 139 | External integration boundaries | A | All outward calls (providers, key storage) centralized; easy to swap providers or add new ones. |
| infrastructure/provider/adapter.js | 39 | Provider registry facade | A | Unified interface so send pipeline doesn’t care which LLM vendor is active. |
| infrastructure/provider/openaiAdapter.js | 60 | OpenAI provider implementation | A | Concrete implementation; future streaming/abort goes here first. |
| infrastructure/api/keys.js | 40 | Local key persistence | A | Keeps secret handling isolated; future encryption layer slot. |
| **instrumentation/** | 339 | Diagnostics & metrics overlays | A | Read-only observers showing token estimates, counts, request details; safe to remove for performance builds. |
| instrumentation/hudRuntime.js | 216 | Live metrics HUD | B | Aggregates runtime stats; could split into small panels for maintainability. |
| instrumentation/requestDebugOverlay.js | 123 | Request & trimming inspector | A | Displays assembled context & each trim attempt so user understands why context changed. |
| **shared/** | 68 | Reusable UI primitives | A | Cross-feature presentation helpers (modal lifecycle, focus containment, safe HTML escaping) kept small and generic. |
| shared/openModal.js | 30 | Modal container primitive | A | Provides consistent overlay structure, close behavior & focus restoration across features. |
| shared/focusTrap.js | 33 | Focus management helper | A | Constrains keyboard focus within active modal; improves accessibility & prevents accidental context switching. |
| shared/util.js | 5 | HTML escaping helper | A | Central safe text rendering utility preventing unintended HTML execution. |
| **legacy/** | 236 | Deprecated implementations (quarantine) | L | Isolated outdated code; safe to delete after confirming no imports. |
| legacy/gatherContext.js | 22 | Old context assembly | L | Replaced by boundary manager; kept only until deletion PR. |
| legacy/anchorManager.js | 62 | Old anchor logic | L | Superseded by scrollControllerV3; remove soon. |
| legacy/windowScroller.js | 152 | Old scrolling implementation | L | Legacy; replaced by modern scroll controller. |
| **aggregates (overlays subset)** | 1234 | Sum overlay UIs (topics + config + help) | B | Represents interactive surfaces where user edits structure, preferences, and keys. |
| **aggregates (instrumentation subset)** | 339 | HUD + request debug | A | Pure observers; can be stripped for lean production bundle. |
| **aggregates (legacy subset)** | 236 | Deprecated code | L | Pending deletion to reduce noise & search clutter. |

Key Placement Justifications:
* Partitioner moved under history because segmentation serves reading & navigation experience (not a core data concern once algorithm stabilized).
* Runtime separated from core so future additions (events, telemetry init) stay clearly “startup only”.
* main.js remains in `src/` for conventional bundler expectations and to avoid polluting repository root with executable code.
* Core intentionally excludes UI & provider specifics to keep business rules stable amidst UI or vendor changes.

End of appendix.

---
## Appendix: Proposed Immediate Inventory
