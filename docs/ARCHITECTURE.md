# MaiChat Architecture (post-refactor)

Date: 2025-09-14
Purpose: Concise, accurate map of the current codebase, with a bridge from `dev-notes.md` to concrete layers and modules.

See also
- ADR-000 Architecture Overview: `ADRs/ADR-000-architecture.md`
- Topic System Spec: `topic_system.md` (pairs with ADR-004)
- Topic System ADR: `ADRs/ADR-004-topic-system.md`

## Bridge: dev-notes components → code

0. Modal system & mode management
- Where: `src/features/interaction/` + `src/shared/`
- Files: `modes.js` (FSM), `keyRouter.js` (mode-aware dispatch), focus containment via `shared/focusTrap.js`; overlays use `shared/openModal.js`.

1. Message history (rendering, partitioning, focus, scrolling, spacing)
- Where: `src/features/history/`
- Files: `historyRuntime.js` (render/layout), `historyView.js` (DOM build), `scrollControllerV3.js` (stateless one-shot scroll API), `parts.js` (active part), `partitioner.js` (text→parts), `newMessageLifecycle.js` (post-send focus rules & reply alignment), `spacingStyles.js` (writes CSS variables for gaps/padding/fade), `fadeVisibility.js` (JS logic for fade opacity).

2. Topic management system
- Where: `src/features/topics/` (+ state in `src/core/store`)
- Files: `topicPicker.js` (assign), `topicEditor.js` (CRUD/move); data in `core/store` and `core/models`.

3. Command line filtering system
- Where: `src/features/command/`
- Files: `lexer.js`, `parser.js`, `evaluator.js` (pure pipeline producing visible IDs).

4. New message processing (request attempts)
- Where: `src/features/compose/` (+ `src/infrastructure/provider`)
- Files: `pipeline.js` (attempts + trimming loop); provider registry/adapters under `infrastructure/provider`.

5. Configuration management
- Where: `src/features/config/`, `src/infrastructure/api/`
- Files: `settingsOverlay.js`, `modelSelector.js`, `modelEditor.js`, `apiKeysOverlay.js`, `helpOverlay.js`; keys boundary: `infrastructure/api/keys.js`.

Cross-cutting enablers
- Runtime: `src/runtime/runtimeSetup.js`, `src/runtime/bootstrap.js`
- Domain & Storage: `src/core/models/*`, `src/core/store/*`, `src/core/persistence/contentPersistence.js`, `src/core/settings/*`, `src/core/context/*`
- IndexedDB adapter: implementation at `src/core/store/adapters/indexedDb.js`; public facade/factory at `src/core/store/indexedDbAdapter.js`.
- Instrumentation: `src/instrumentation/hudRuntime.js`, `src/instrumentation/requestDebugOverlay.js`
- Shared primitives: `src/shared/openModal.js`, `src/shared/focusTrap.js`, `src/shared/util.js`
- Styles: `src/styles/index.css` orchestrates `base.css`, `layout.css`, `components/*.css`; tokens in `src/styles/variables.css`. `components/history.css` consumes CSS vars set by `spacingStyles.js`.

## Layered overview

- Entry
  - `src/main.js` — slim entry; imports `src/styles/index.css`, mounts DOM shell, and calls runtime/bootstrap.

- Runtime (startup wiring)
  - `src/runtime/runtimeSetup.js` — builds service container (store, indexes, persistence, history runtime, scroll controller, lifecycle hooks, pending meta).
  - `src/runtime/bootstrap.js` — ordered startup (providers → persistence init → catalog ensure → optional seeding → first render → layout sizing).

- Core (domain & storage)
  - `src/core/models/` — factories: MessagePair, Topic.
  - `src/core/store/` — memory store (mutations/events), derived indexes, IndexedDB adapter (impl under `adapters/indexedDb.js`, public export/factory at `indexedDbAdapter.js`).
  - `src/core/persistence/contentPersistence.js` — debounced save/load orchestration.
  - `src/core/settings/` — settings API and migrations.
  - `src/core/context/` — token estimator and boundary manager (for predicted inclusion).

- Features (user-facing capabilities)
  - History: `src/features/history/*` — render and layout of message parts; stateless one‑shot scrolling; partitioning; active‑part control; post‑send focus rules.
  - Helpers: `spacingStyles.js` sets `:root` CSS vars (`--gap-outer`, `--gap-meta`, `--gap-intra`, `--gap-between`, `--part-padding`, `--fade-transition-ms`); `fadeVisibility.js` applies fade opacity.
  - Interaction: `src/features/interaction/*` — mode FSM and mode‑aware key routing; bindings for navigation, stars/flags, topic/model actions, send, and overlay invocation.
    - `pointerModeSwitcher.js` — capture-phase mouse/touch mode switching based on `[data-mode]` zones; excluded while a modal is active. Keyboard routing unaffected.
  - Command: `src/features/command/*` — filter DSL pipeline (lexer → parser → evaluator); pure computation of visible message IDs.
  - Topics: `src/features/topics/*` — keyboard‑first topic picker and editor (CRUD/move); updates topic references in store.
  - Compose: `src/features/compose/pipeline.js` — request assembly and send attempts with bounded trimming; integrates with provider registry.
  - Config: `src/features/config/*` — settings overlay (spacing, reading position, etc.), model selector/editor, API keys, and help overlays.

- Infrastructure (external boundaries)
  - `src/infrastructure/provider/*` — provider registry and adapters.
  - `src/infrastructure/api/keys.js` — API key persistence.

- Instrumentation (read-only diagnostics)
  - `src/instrumentation/hudRuntime.js` — live HUD metrics.
  - `src/instrumentation/requestDebugOverlay.js` — request/context attempts inspector.

- Shared
  - `src/shared/openModal.js`, `src/shared/focusTrap.js`, `src/shared/util.js`.

## Key contracts

- Store (core/store/memoryStore)
  - Input: mutation calls (add/update messages, topics, metadata, settings).
  - Output: state snapshots + change events; indexes recompute on demand.

- Filter pipeline (features/command)
  - Input: filter string; state + indexes.
  - Output: ordered visible MessagePair IDs (pure; deterministic).

- History runtime (features/history)
  - Input: state + visible IDs + settings.
  - Output: DOM for parts; active part control; one‑shot align/ensureVisible via scrollControllerV3.
  - Style contract: CSS variables written by `spacingStyles.js` and consumed by `src/styles/components/history.css` determine gaps, padding, and fade timing.

- Compose pipeline (features/compose)
  - Input: pending message + predicted context (boundary manager).
  - Output: attempt results; state commits; bounded trimming retries.

- Overlays (shared/openModal + focusTrap)
  - Input: open/close intents; focus origin.
  - Output: modal lifecycle + focus restoration; Esc closes.

## Core flows

- Startup: runtimeSetup → bootstrap (providers, persistence, catalog, seed, render, layout).
- Filtering: Enter in COMMAND → lexer/parser/evaluator → visible IDs → history render.
- Navigation: j/k/arrows move active part; default Ensure‑Visible; optional Typewriter Regime centers on j/k; only middle pane scrolls.
- Send: Enter in INPUT → compose pipeline attempts → store update → focus rules via newMessageLifecycle.
- Settings: Apply in settings overlay updates CSS variables via `spacingStyles.js`; history re-measures and re-anchors without jitter.

## Invariants & performance

- Passive keystrokes stay cheap; explicit actions do heavier work.
- One active part at a time; meta rows are never focusable.
  - Mouse clicks on meta do not change selection; interactive controls inside meta remain functional without altering the active part.
- Dead-band validation avoids visible “second-scroll” corrections.
- Deterministic rendering from store state; pure filtering.
- Stateless scroll: no persistent scroll policies; one-shot align/ensureVisible calls own the scroll once, then release.
 - Visual edges: CSS overlays on `#historyPane` fade content within the fixed outer gap so content never touches pane borders.
 - Spacing uses CSS variables at `:root` (no inline heights on gap elements); fade timing reads `--fade-transition-ms`.

## Testing

- `tests/unit/` includes: parser/evaluator, indexes, persistence, partitioning/anchor, fade visibility, mask controller, model selector/editor, new message lifecycle, overflow handling.

## Start here

- Read: `src/runtime/runtimeSetup.js`, `src/features/history/historyRuntime.js`, `src/features/interaction/interaction.js`, `src/features/command/*`.
- Styles: `src/styles/index.css`, `src/styles/variables.css`, `src/styles/components/history.css`.
- UX rationale: `docs/ui_layout.md`, `docs/keyboard_reference.md`.

## Glossary (canonical terms)
- Pair, Part, Meta Row, Focused Part
- Outer Gap (`--gap-outer`), Usable Band, Internal Gaps (`--gap-meta`, `--gap-intra`, `--gap-between`), Part Padding (`--part-padding`), Fade Transition (`--fade-transition-ms`)
- Ensure‑Visible, AlignTo('top'|'bottom'|'center')
- Typewriter Regime (reading regime): optional j/k centering while reading; not a UI Mode
- Context Boundary (first included pair), Included/Off (context), Trimming, URA, CPT
