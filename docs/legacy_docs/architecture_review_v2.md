## MaiChat Architecture Review (Pre-v2 Roadmap)

Date: 2025-09-13
Scope: Assess current codebase health and architectural fit for the v2 roadmap (M20–M28 in `docs/plan.md`). Ignore `docs/legacy_docs/` per request.
See also: `docs/ARCHITECTURE.md`, `docs/ADRs/ADR-000-architecture.md`, `docs/ADRs/ADR-004-topic-system.md`

---
## 1. Functional Structure (Problem / Capability View)
Each numbered capability is the “why”; later layers/files are the “how”. Invariants included where critical to UX determinism.

0. Modal System & Mode Management
- Inputs: keyboard events, pointer events (capture-phase), focus changes.
- Outputs: active mode state (INPUT | VIEW | COMMAND), visible mode indicator, mode-constrained keybindings.
- Invariants: exactly one active mode; key router delegates by mode; modal overlays suspend pointer-mode switching.

1. Message History (rendering, partitioning, active-part, scrolling, fade)
- Concerns: Split pairs into parts sized by viewport fraction, stable active-part navigation, deterministic “stateless one-shot” scroll alignment (top|center|bottom), outer-gap fade near edges.
- Invariant: One active part; meta rows not focusable. Re-measures cause no visible jitter beyond a single correction; dead-band avoids second-scroll.

2. Topic Management
- Hierarchical topic tree CRUD/move/rename, selection for new messages, reassignment of existing pairs.
- Invariant: Every pair references a valid topic ID; root immutable.

3. Command Line: Filtering + Commands
- Filtering: lexer → parser → evaluator produce visible subset of pairs; errors are non-destructive and surfaced inline.
- Commands (new in roadmap M23): colon-prefixed operations over the current filtered selection (e.g., `:export json`, `:changetopic <id|path>`).
- Invariants: Filter evaluation remains pure; command execution is side-effectful but goes only through store mutation APIs, with input validation and explicit feedback (no silent partial changes).

4. New Message Processing & API Interaction
- Predict context boundary (URA budgeting), build request, bounded trimming retry loop, capture response, update store, focus heuristics.
- Invariant: Send pipeline marks sending state, only last accepted attempt commits content or error.

5. Configuration & Preferences
- Settings for spacing/fade/animation, token heuristics, anchor behavior; model catalog enable/disable; API keys.
- Invariant: Settings changes propagate immediately to rendering/layout without inconsistent intermediate states.

Cross-cutting: Local-first persistence (IndexedDB), diagnostics overlays (HUD/Request Debug), shared primitives (openModal, focusTrap), provider abstraction.

---
## 2. Layered Architectural Overview (Implementation View)
| Layer | Responsibility Focus | Key Modules|
|-------|----------------------|------------|
| Entry | Mount DOM shell, orchestrate startup | `src/main.js`, `runtime/bootstrap.js` |
| Runtime | Service container & ordered boot | `runtime/runtimeSetup.js`, `runtime/bootstrap.js` |
| Core (Domain/State) | Store, indexes, persistence, settings, models, context prediction | `core/store/*`, `core/persistence/contentPersistence.js`, `core/settings/index.js`, `core/models/*`, `core/context/*` |
| Features | User-facing capabilities (history, interaction, command, topics, compose, config) | `features/*` |
| Infrastructure | Provider adapters, API key boundary | `infrastructure/provider/*`, `infrastructure/api/keys.js` |
| Instrumentation | Live HUD, request debug overlay | `instrumentation/*` |
| Shared | Modal & focus primitives, utils | `shared/*` |

Layer Interaction Narrative:
- main.js mounts minimal HTML, creates mode manager, builds runtime via `initRuntime()`, composes `historyRuntime` + `interaction`, then calls `bootstrap()`.
- `runtimeSetup` constructs store/indexes/persistence/history view/scroll controller/new message lifecycle, and boundary manager.
- `historyRuntime` owns deterministic rendering loop, fade/spacing styles, and one-shot scroll API usage.
- Filtering (command) composes purely with core state and returns visible pairs for rendering.
- Command execution (planned M23) layers a small command router/registry over the same input box: detect `:` prefix, parse command+args, gather current selection from evaluator, execute against store.
- Provider adapters are registered during bootstrap; send pipeline integrates via `features/compose/pipeline.js`.

Design Rationale:
- Vanilla JS + ES modules for transparency and performance; narrow boundaries (store, persistence, filtering, history, provider) to keep refactors localized.
- Stateless scroll controller avoids sticky anchor state and reduces complex coupling.

---
## 3. Folder & File Inventory (Hierarchical Health)
Health Scale: A (clean & cohesive) · B (minor issues / watch) · C (refactor desirable) · L (legacy)

| Path / Folder | LOC | Role (Summary) | Health | Notes |
|---------------|----:|----------------|--------|-------|
| (total project – JS under `src/`) | ~5100 | All JS sources (excludes assets/CSS) | B | Based on `file_search` scan and representative reads; exact count varies with tests not included here. |
| ROOT | ~150 | Slim entry: DOM shell, runtime/bootstrap wiring, HUD dev toggles | B | main.js verbose with debug guards; acceptable; keep under ~180 LOC. |
| `src/main.js` | ~300 | Entry and DOM template | B | Includes dev diagnostics and HUD toggles; could move HTML skeleton to `public/index.html` later if theming required. |
| RUNTIME | ~190 | Composition & startup orchestration | A | Straight-line factory; explicit bootstrap steps. |
| `runtime/runtimeSetup.js` | ~120 | Build runtime context | A | Narrow dependencies; exposes only needed services. |
| `runtime/bootstrap.js` | ~70 | Ordered boot, initial layout & key checks | A | Good error insulation; idempotent init. |
| CORE/STORE | ~270 | Canonical state, events, topic counts, indexes | A | Clear mutation API; indexes rebuild on updates. |
| `core/store/memoryStore.js` | ~170 | In-memory store + topic tree + events | A | Solid; count maintenance correct; cycle checks on move. |
| `core/store/indexes.js` | ~70 | Derived indexes (by topic/model/star/flag) | B | `_updatePair` rebuilds all maps; acceptable at current scale; consider incremental later. |
| `core/store/indexedDbAdapter.js` | ~5 | Re-export of adapter | A | Thin boundary; OK. |
| CORE/PERSISTENCE | ~140 | Debounced save/load, schema/migrations | B | Inline migrations present; acceptable; could extract if grows. |
| `core/persistence/contentPersistence.js` | ~140 | Orchestrates IndexedDB adapter | B | Good debounce; legacy field migrations handled. |
| CORE/SETTINGS | ~120 | Settings load/save/migrate/subscribe | A | Immediate propagation; defaults clear. |
| CORE/MODELS | ~220 | MessagePair, Topic, Model Catalog | B | Catalog includes base + custom; small normalization code. |
| CORE/CONTEXT | ~150 | Token estimation & boundary manager | A | Clear API; predictable stats for HUD. |
| FEATURES/HISTORY | ~1,000 | View, runtime, parts, partitioner, scroll controller, lifecycle | B | Cohesive; minor CSS-in-JS in `applySpacingStyles` could migrate to CSS vars. |
| `features/history/historyRuntime.js` | ~360 | Render loop, fade visibility, status | B | Long but cohesive; could split fade/spacing helpers. |
| `features/history/historyView.js` | ~200 | DOM assembly of parts | A | Pure view; binds error actions via helper. |
| `features/history/scrollControllerV3.js` | ~330 | Stateless scroll & alignment | A | Robust; instrumentation hooks present. |
| `features/history/partitioner.js` | ~230 | Text → parts with caching | B | Uses canvas measure; good invalidation; tests cover edge cases. |
| `features/history/newMessageLifecycle.js` | ~200 | Reply focus heuristics, filter-aware | A | Narrow inputs/outputs; test-backed. |
| FEATURES/INTERACTION | ~350 | Modes, key router, pointer-mode switcher, sanitizer | B | `interaction.js` is a hotspot; watch size growth. |
| FEATURES/COMMAND | ~260 | Lexer, parser, evaluator, topic resolver | A | Pure and well-tested. |
| FEATURES/TOPICS | ~320 | Picker & Editor overlays | B | Keyboard-first; tree ops mirrored in store. |
| FEATURES/COMPOSE | ~170 | Send pipeline & trimming loop | A | Ready for streaming/abort extension. |
| FEATURES/CONFIG | ~450 | Settings, models, API keys, help, daily stats | B | Overlay UIs; candidates for shared list/table primitives. |
| INFRASTRUCTURE | ~120 | Provider registry & OpenAI adapter, API keys | A | Thin and extendable. |
| INSTRUMENTATION | ~350 | HUD & request debug overlays | B | Dev-only; removable behind flag. |
| SHARED | ~70 | Modal + focus primitives, util | A | Stable minimal primitives. |

Structural Observations:
- Composition surface is clear: runtime context -> history + interaction -> bootstrap. No framework dependency.
- Stateless scroll model is a good fit for predictable UX and reduces complex anchor bugs.
- Hotspots: `features/history/historyRuntime.js` and `features/interaction/interaction.js` (monitor LOC; consider modularization if they exceed 450–600 LOC).
- Duplicated adapters under `src/store/*` remain for compatibility; actual core is `src/core/store/*`. Consider removing old copies if unused.

---
## 4. Architectural Evaluation (Qualitative)

Strengths
- Clear separation of domain/state (Core) from UI (Features), with thin Infrastructure boundaries.
- Deterministic rendering and stateless scrolling make behavior testable and predictable.
- Filtering pipeline is pure and covered by unit tests; DSL is extensible.
- Runtime/bootstrap sequence is explicit and easy to extend (e.g., providers, streaming hooks).

Tensions / Trade-offs
- CSS-in-JS for spacing/fade lives in `historyRuntime.applySpacingStyles`. Pros: instant propagation; Cons: style duplication risk and harder theming. CSS variables could retain dynamic control while centralizing definitions.
- Indexes recompute wholesale on `pair:update`. Fine at current sizes, but may require incremental maintenance for large histories or virtualization.
- `main.js` contains the DOM shell string. It’s convenient but makes visual diffs noisier; moving static scaffold to `public/index.html` would isolate concerns.

Risks
- Large history performance: partitioning and measuring depend on DOM metrics; without virtualization, rendering cost grows with history size.
- Future provider streaming may tempt coupling UI to network events. Keep streaming strictly behind the compose pipeline and provider adapter.
- Model catalog normalization complexity could grow as more providers are added; maintain a provider-agnostic meta schema and map provider-specific fields in adapters.

Fit vs Roadmap (M21–M28)
- M21 System message + per-topic request params: FIT = High. Extend `core/models/modelCatalog` for defaults; store per-topic overrides in store or a new `core/models/topicPrefs.js`; apply in compose pipeline via topic lookup before send. Topic Editor overlay gets a params panel.
- M22 Multiple providers (Claude/Gemini): FIT = High. Provider registry already exists; add adapters under `infrastructure/provider/`; include mapping to common request envelope consumed by compose pipeline.
- M23 oN filters by context boundary: FIT = Medium-High. Evaluator can call boundary manager to tag in/out and then include last N out-of-context pairs. Requires exposing boundary results to evaluator or adding a small helper in command layer.
- M23 CLI colon-commands (operations over selection): FIT = High. Add a `commandRouter` in `features/command/` that dispatches side-effectful commands. Pattern:
	1) If input starts with `:`, parse `:<name> <args...>`.
	2) Obtain selection via current filter (reuse evaluator).
	3) Execute command handler with (store, selection, args), emitting user feedback (success/errors) in the command area.
	4) Example handlers: `export json` (downloads JSON), `changetopic <id|path>` (bulk update `topicId` with confirmation).
	Guardrails: dry-run preview for destructive ops; consider simple undo buffer later.
- M24 Markdown/LaTeX/code formatting: FIT = Medium. HistoryView is plain HTML; add a formatting pipeline (markdown-it + syntax highlighter) behind a strict sanitizer. Need XSS-safe rendering and measuring impact on partitioning (line height, code blocks). Consider pre-render caching.
- M25 Attachments/images: FIT = Medium. Model request payload structure already abstracted; UI requires message part types beyond plain text (e.g., embeds). Partitioning/parts will need to support media blocks with known heights.
- M26 Export history: FIT = High. Store has canonical state; export JSON with versions; optional markdown export via a formatter layer.
- M27 Large history virtualization: FIT = Medium. Stateless scroll + parts/measurements align with virtualization; introduce a windowed parts provider with stable IDs; decouple view from full list.
- M28 Archiving/restoration: FIT = High. Persistence adapter boundary can support archives (batch read/write), plus migrations.

---
## 5. Future Refactoring & Evolution Suggestions

1) History Runtime split (target <= 250 LOC per module)
- Extract fade/spacing CSS generation into `features/history/spacingStyles.js` and fade computation into `features/history/fadeVisibility.js`.
- Acceptance: existing tests (`fade_visibility`, `scroll_jitter`, `partition_anchor`) stay green; no visual regressions in a manual smoke run.
 - Status: Proceed with Phase A only now (pure extraction, no behavior change, public API intact). Defer optional status bar/filter UI extractions to later.

2) Indexes incremental maintenance
- Maintain `byTopic`, `byModel`, `byStar`, and flags incrementally on updates; only rebuild affected buckets.
- Acceptance: `indexes.test.js` extended to measure update complexity with 10K pairs; no O(n) rebuild in `pair:update` hot path.
 - Status: Deferred for now. Rationale: current histories are small; full rebuild is simpler and safer. Revisit when histories grow or during M27 (virtualization).
	 - Revisit triggers: noticeable lag on updates (>16–30ms), histories >3–5k pairs, or virtualization work.
	 - Low-risk prep: add a simple HUD metric to time index rebuilds to inform when to prioritize this.

3) Stylesheet modularization (split legacy `style.css`)
- Create a CSS structure under `src/styles/` with one import-orchestrating entry for predictable cascade:
	- `src/styles/index.css` (entry only):
		- `@import './variables.css';`
		- `@import './base.css';`
		- `@import './layout.css';`
		- `@import './components/history.css';`
		- `@import './components/command.css';`
		- `@import './components/input.css';`
		- `@import './components/overlays.css';`
		- `@import './components/instrumentation.css';` (optional)
	- `src/styles/variables.css`: defaults for spacing/fade variables (px/ms) to prevent FOUC.
	- `src/styles/base.css`: resets/typography/colors/utilities.
	- `src/styles/layout.css`: app shell (topBar/historyPane/inputBar) sizing/positioning.
	- `src/styles/components/*.css`: feature-specific rules (history, overlays, etc.).
- Integration: change `src/main.js` import from `./style.css` to `./styles/index.css` (done). The legacy `src/style.css` has been removed.
- Acceptance: Visual parity under manual smoke + existing unit tests unaffected. No JS changes yet; `applySpacingStyles` remains in use.
- Risks: cascade/order regressions; mitigate by keeping `index.css` import order stable. Missing default values; mitigate with `variables.css` fallbacks.
- Status: Planned. This step should precede CSS variables (next item) to make the switch safer and contained.

4) CSS variables for spacing/fade/animation
- Define CSS vars in a single stylesheet; `settings` writes vars to `:root`; history runtime subscribes for changes. Gap elements use CSS classes (no inline heights).
- Acceptance: All spacing/fade tests pass; switching settings updates visuals without JS-generated `<style>` duplication.
 - Status: Done for spacing. JS now sets `--gap-*`, `--part-padding`, and `--fade-transition-ms`; fade computation remains in JS.

5) Remove duplicate legacy `src/store/*` files (with IndexedDB adapter inversion)
- Do NOT delete the adapter prematurely. Current state: `core/store/indexedDbAdapter.js` re-exports from `../../store/indexedDbAdapter.js` (real impl lives under `src/store`).
- Safe removal path:
	- Step A (invert dependency): move the actual adapter implementation into Core, e.g. `core/store/indexedDbAdapter.js` (or `core/store/adapters/indexedDb.js`). Keep a shim at `src/store/indexedDbAdapter.js` that re-exports from Core for a transition period.
	- Step B (update imports): grep for `src/store/indexedDbAdapter` and switch callers to `core/store/indexedDbAdapter` only. Leave the shim until grep shows zero references to `src/store/indexedDbAdapter`.
	- Step C (verify & remove): run tests and a quick boot to confirm persistence still works with existing IndexedDB data, then delete `src/store/*` remnants.
- Acceptance: no imports from `src/store/*` (including the adapter); app boots with existing data intact; unit tests green.
- Status: Done. IndexedDB adapter lives under `core/store/adapters/indexedDb.js` with public export from `core/store/indexedDbAdapter.js`. All imports updated; tests green. The legacy `src/store/` folder can be removed safely.
Out of scope for this section (feature work; see roadmap `docs/plan.md`)
- M23: Command router and selection-based operations (feature implementation).
- M24: Formatter pipeline (markdown/LaTeX/code) with sanitizer (feature implementation).

---
## 6. Summary
The codebase is modular, purposeful, and test-backed. The architecture fits the planned v2 features with minimal friction. Largest risks are performance at very large histories and safe rich-text rendering. Tackle refactors 1–3 early to keep UI code maintainable and to prepare for M24/M27. Provider expansion (M22) is low-risk given current boundaries. Overall health: B+ trending to A with the proposed cleanups.
