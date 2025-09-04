## Main.js Refactor Plan (Phase 1 – Monolith Decomposition)

Date: 2025-09-04  
Status: Draft (no code changes applied yet)  
Goal: Decompose `src/main.js` (~1.3k LOC) into 7 focused modules + slim entry. Introduce minimal `runtime/` composition folder (approved Option A). ZERO behavior / DOM / API changes.

### 1. Objectives
1. Reduce cognitive load & surface area of the monolith.
2. Preserve identical runtime behavior (shortcuts, timings, rendering, persistence).
3. Introduce minimal composition layer (`runtime/`) to concentrate setup order.
4. Keep each extraction reversible (single-purpose commits, small diff).
5. Avoid premature abstraction (no event bus / streaming yet) while preparing clean seams.

### 2. Non-Goals (Phase 1)
No redesign, no performance tuning, no streaming/abort, no filter language changes, no renaming of public globals, no event system yet.

### 3. Approved Extraction Table (Single Source of Truth)

| File | Final Path | Responsibility (extracted scope) |
|------|------------|----------------------------------|
| `runtimeSetup.js` | `src/runtime/runtimeSetup.js` | Build core runtime context: store, indexes, persistence, boundaryMgr, activeParts, historyView, scrollController, lifecycle, pendingMessageMeta → returns `ctx`. |
| `bootstrap.js` | `src/runtime/bootstrap.js` | Orchestrate startup (providers, persistence init, apply spacing styles, optional seeding, first render, remove loading overlay, beforeunload flush). |
| `demoSeeding.js` | `src/store/demoSeeding.js` | Demo / test dataset (`seedDemoPairs`, word-count dataset, reseed & generate helpers). Dev-only utilities. |
| `historyRuntime.js` | `src/ui/history/historyRuntime.js` | Layout sizing, spacing styles, render pipeline (`renderHistory`, `renderCurrentView`), active part handling, fade visibility, message count & status, context inclusion styling, boundary jump. |
| `requestDebugOverlay.js` | `src/ui/debug/requestDebugOverlay.js` | Request debug overlay creation & rendering (prediction / trimming / timing diagnostics). |
| `hud.js` | `src/ui/debug/hud.js` | HUD container, timestamp formatting, metrics section toggle, continuous update loop. |
| `interaction.js` | `src/ui/interaction/interaction.js` | Modes & key handlers, command history & execution, star/flag toggles, quick topic picker integration, menu system, anchor mode cycle, pending meta rendering, send button enable + animation, request debug toggle dispatch. |
| (slim) `main.js` | `src/main.js` | Root layout HTML & loading guard injection, ordered initializer calls, temporary debug window exposes. |

Unchanged existing domain/pipeline: `/send/pipeline.js`, `/filter/*`, `/context/boundaryManager.js`, `/partition/partitioner.js`, overlays, models, providers.

### 4. Migration Map (Authoritative)
Format: original `main.js` symbol ⇒ final path (from table). Order reflects extraction sequence where relevant.

Core Construction & State (to runtimeSetup):
- createStore / attachIndexes / createIndexedDbAdapter / attachContentPersistence ⇒ `runtime/runtimeSetup.js`
- createBoundaryManager (instance `boundaryMgr`) ⇒ `runtime/runtimeSetup.js`
- ActivePartController instance (`activeParts`) ⇒ `runtime/runtimeSetup.js`
- createHistoryView / bindHistoryErrorActions wiring ⇒ `runtime/runtimeSetup.js`
- createScrollController (instance `scrollController`) ⇒ `runtime/runtimeSetup.js`
- createNewMessageLifecycle (instance `lifecycle`) ⇒ `runtime/runtimeSetup.js`
- pendingMessageMeta initialization ⇒ `runtime/runtimeSetup.js`
- Exposure bundling into returned `ctx` ⇒ `runtime/runtimeSetup.js`

Seeding & Dataset Utilities:
- seedDemoPairs ⇒ `store/demoSeeding.js`
- buildWordCountDataset ⇒ `store/demoSeeding.js`
- baseLoremWords ⇒ `store/demoSeeding.js`
- window.seedTestMessages / window.generateWordCountDataset ⇒ `store/demoSeeding.js`

Rendering & Layout (historyRuntime):
- layoutHistoryPane ⇒ `ui/history/historyRuntime.js`
- applySpacingStyles ⇒ `ui/history/historyRuntime.js`
- renderHistory ⇒ `ui/history/historyRuntime.js`
- renderCurrentView ⇒ `ui/history/historyRuntime.js`
- applyActivePart ⇒ `ui/history/historyRuntime.js`
- updateFadeVisibility ⇒ `ui/history/historyRuntime.js`
- updateMessageCount ⇒ `ui/history/historyRuntime.js`
- applyOutOfContextStyling ⇒ `ui/history/historyRuntime.js`
- jumpToBoundary ⇒ `ui/history/historyRuntime.js`
- renderStatus ⇒ `ui/history/historyRuntime.js`

Request Debug Overlay:
- ensureRequestDebugOverlay ⇒ `ui/debug/requestDebugOverlay.js`
- renderRequestDebug ⇒ `ui/debug/requestDebugOverlay.js`

Interaction & Commands (interaction):
- pushCommandHistory / historyPrev / historyNext ⇒ `ui/interaction/interaction.js`
- viewHandler / commandHandler / inputHandler ⇒ `ui/interaction/interaction.js`
- cycleStar / setStarRating / toggleFlag ⇒ `ui/interaction/interaction.js`
- openQuickTopicPicker ⇒ `ui/interaction/interaction.js`
- toggleMenu / menuGlobalKeyHandler / closeMenu / activateMenuItem / runMenuAction ⇒ `ui/interaction/interaction.js`
- renderPendingMeta / formatTopicPath / middleTruncate ⇒ `ui/interaction/interaction.js`
- updateSendDisabled (button + animation) ⇒ `ui/interaction/interaction.js`
- cycleAnchorMode ⇒ `ui/interaction/interaction.js`
- Request debug toggle (Ctrl+Shift+R) listener wiring ⇒ `ui/interaction/interaction.js`

HUD / Diagnostics:
- formatTimestamp ⇒ `ui/debug/hud.js`
- updateHud ⇒ `ui/debug/hud.js`
- __hudState & click binding ⇒ `ui/debug/hud.js`

Bootstrap & Lifecycle:
- bootstrap (full function body) ⇒ `runtime/bootstrap.js`
- beforeunload persistence flush listener ⇒ `runtime/bootstrap.js`

Remaining in slim `main.js`:
- Root layout HTML + loading guard creation
- Ordered initializer invocation (runtimeSetup → historyRuntime → requestDebugOverlay → hud → interaction → bootstrap)
- Temporary debug window exports (`window.__store`, etc.)

Explicitly NOT moved (already separate modules):
- Filter language (parse/evaluate)
- Boundary algorithms (boundaryManager)
- Partition logic (partitioner) & parts builder (ui/parts.js)
- Send pipeline domain logic (`send/pipeline.js`)

Legacy slated for removal later (not part of this extraction): `ui/anchorManager.js`, `ui/windowScroller.js`, `context/gatherContext.js`.

### 5. Initialization Sequence (Target Order)
1. Inject root layout & loading guard (slim `main.js`).
2. `initRuntime()` → build & return `ctx` (DOM-neutral beyond existing modules).
3. `createHistoryRuntime(ctx)` → returns rendering API; applies spacing styles if needed.
4. `initRequestDebug(ctx)` → sets up overlay (hidden unless enabled).
5. `initHud(ctx)` → HUD container + loop (off until `:hud` command).
6. `initInteraction(ctx)` → key routing, command handlers, menu, send logic, request debug toggle binding.
7. `bootstrap(ctx)` → providers registration, persistence init, seeding, first render, loading guard removal.

### 6. Extraction Order (Commit Plan)
Each commit: (a) copy code verbatim, (b) export API, (c) replace original block with import/use, (d) run tests & manual smoke, (e) document verification in commit body.

1. Add `runtime/runtimeSetup.js` (introduce `initRuntime`).
2. Add `store/demoSeeding.js` (wire into bootstrap via ctx or direct import).
3. Add `ui/history/historyRuntime.js` (replace rendering calls; keep fallback until verified then remove originals).
4. Add `ui/debug/requestDebugOverlay.js`.
5. Add `ui/debug/hud.js`.
6. Add `ui/interaction/interaction.js` (remove all related handlers from main).
7. Add `runtime/bootstrap.js` + slim `main.js` cleanup.
8. Optional tidy pass (import ordering, inline comments summarizing init sequence).

### 7. Context & Module Interfaces
`initRuntime()` ⇒ ctx object:
```
{
  store,
  persistence,
  activeParts,
  historyView,
  scrollController,
  boundaryMgr,
  lifecycle,
  pendingMessageMeta,
  getSettings,
  getActiveModel
}
```
`createHistoryRuntime(ctx)` ⇒ `{ renderHistory, renderCurrentView, applyActivePart, updateFadeVisibility, updateMessageCount, jumpToBoundary, applySpacingStyles }`.
`initRequestDebug(ctx)` ⇒ `{ renderRequestDebug, setEnabled(flag) }`.
`initHud(ctx)` ⇒ `{ setEnabled(flag) }`.
`initInteraction(ctx)` ⇒ `{ keyRouter, updateSendDisabled }`.
`bootstrap(ctx)` ⇒ `void`.

All existing global debug exposures retained temporarily (Phase 1) for parity.

### 8. Risks & Mitigations
| Step | Risk | Mitigation |
|------|------|------------|
| runtimeSetup | Hidden dependency on pre-existing DOM nodes | Keep DOM-neutral; defer DOM lookups to later modules |
| historyRuntime | Closure variable loss (e.g., commandErrEl) | Pass through ctx or re-query inside function safely |
| requestDebugOverlay | Overlay fails to render / stale state | Immediate manual toggle (Ctrl+Shift+R) post-commit |
| interaction | Missed keybinding or duplicate listeners | Remove originals atomically; run navigation & command smoke set |
| bootstrap | Initialization order altered | Preserve original sequence comments; diff before removal; run full smoke |

### 9. Validation Checklist (Every Commit)
1. All unit tests green.
2. Browser load: no console errors, layout intact.
3. Navigation: j/k, g, G, active highlight correct.
4. Filtering: `m:gpt` applies; error path still surfaces parse error.
5. Metadata: star (1/2/3/space) & flag (a) still update.
6. Send: button enable/disable cycle + pending animation; missing key overlay opens on error.
7. Request debug overlay: Ctrl+Shift+R toggles, populates after send.
8. HUD: `:hud` on/off updates visibility.
9. No duplicate event listener side-effects (scroll or key spam in console).

### 10. Rollback Criteria
Immediate git revert of last commit if ANY of:
- Two consecutive reload failures.
- Previously green test fails without one-line obvious fix.
- Core nav (j/k) or send pipeline regresses.
- Request debug overlay throws on toggle.

### 11. Post-Phase (Deferred)
1. Introduce event bus (`events/`) for send/context/UI telemetry.
2. Consolidate global debug exports into `exposeDebug(ctx)`.
3. Remove legacy files (`anchorManager.js`, `windowScroller.js`, `gatherContext.js`).
4. Unify duplicated send logic branches (Enter vs button) into shared helper.
5. Extend filter language (topics, dates) after structural stabilization.

### 12. Next Action
Proceed with Step 1: create `src/runtime/runtimeSetup.js` (copy + export), adapt `main.js` to call `initRuntime()`, leave original code blocks until verified, then remove. (Awaiting explicit go from user to start implementation.)

(End of Document – Refactor Plan v1 Option A)
