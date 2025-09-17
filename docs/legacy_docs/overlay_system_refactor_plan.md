# Overlay System Refactor Plan

Date: 2025-09-17  
Owner: Runtime/UI refactor pod

---

## 1. Diagnostics

### 1.1 Architectural symptoms
- **State mutation while modal is open:** Editor overlays write directly to shared store/settings, triggering live subscribers (`src/main.js:156-192`) and breaking the “main window freezes” guarantee.
- **Divergent dirty signaling:** Each overlay invents its own `onClose` contract (selectors, editors, menus), producing inconsistent history rebuild and scroll alignment behavior (`src/features/interaction/interaction.js:570-604`, `688-722`).
- **Rebuild calls scattered:** `historyRuntime.renderCurrentView` and `scrollController.alignTo` are invoked from overlays, the settings subscription, lifecycle hooks, and ad hoc debug flows without a central arbiter.
- **Focus/mode drift:** Internal re-renders (Topic/Model editors, settings apply) often drop focus to `document.body`, so the blocker halts input and windows appear frozen (see `docs/overlays_architecture_review.md`).

### 1.2 Impacted subsystems
- **Interaction layer (`src/features/interaction/interaction.js`)** duplicates rebuild code per overlay, mixing UI mode logic with overlay after-effects.
- **History runtime (`src/features/history/historyRuntime.js`)** assumes synchronous callers and can’t distinguish user navigation from overlay-driven refreshes.
- **Settings pipeline (`src/core/settings/index.js`, subscriber in `src/main.js`)** can’t tell whether a change came from UI or a background sync.

### 1.3 Root cause
Overlays share mutable domain objects with the main runtime. Without a formal lifecycle handshake, every overlay decides when to mutate, whether to rebuild, and how to align scroll. The absence of a single “overlay controller” keeps reintroducing regressions even after targeted fixes.

---

## 2. Recommendations

1. **Introduce an Overlay Lifecycle Controller**
   - Single entry point (`openOverlay(type, factory)`), capturing mode/focus and mediating store/settings access.
   - Overlays return an `OverlayResult` (`noop`, `restyle`, `rebuildPreserve`, `rebuildReset`, `pendingChanges`, etc.) plus metadata (`needsBottomAnchor`, `pendingDrafts`).

2. **Stage edits locally**
   - Editor overlays operate on local drafts; controller commits to store/settings only after close, emitting structured diffs.
   - Selector overlays yield the chosen value without mutating state themselves.

3. **Centralize history update requests**
   - Expose `requestHistoryUpdate({ reason, preserveActive, align })` on the runtime; all rebuild/align calls go through it.
   - Align logic (double rAF, bottom anchor) lives in one place and honors specs from `docs/scroll_positioning_spec.md`.

4. **Shared focus keeper utilities**
   - Implement `ensureFocusWithin(root, candidates[])` and integrate with overlays per `docs/overlays_architecture_review.md`.
   - Enforce `preferredFocus` discipline and add dev warnings when a non-focusable node is supplied.

5. **Mode restoration + focus routing**
   - Overlay controller restores the snapshot mode, then explicitly focuses the zone associated with that mode (command input, history pane, compose area), avoiding inference from browser focus.

6. **Test harness expansion**
   - Add jsdom suites that open each overlay, mutate staged state, close, and assert: main window frozen during open, correct history update semantics afterward, focus restored appropriately.

---

## 3. Architectural Changes to Implement

### 3.1 Runtime layer
- Add `src/runtime/overlayController.js` with:
  - `openOverlay({ type, open })` coordinator.
  - Overlay context providing read-only access to store/settings plus a mutation queue.
  - Dispatch to `requestHistoryUpdate`.

### 3.2 Store/settings adapters
- Provide transactional helpers:
  - `beginOverlayTransaction()` returning a copy-on-write proxy that records diffs.
  - `commitOverlayTransaction(diff)` applying mutations in one batch, with hooks for controller analytics/tests.

### 3.3 Interaction layer cleanup
- Replace per-overlay `onClose` wiring in `src/features/interaction/interaction.js:570-604` and `688-722` with controller calls.
- Remove duplicate rebuild/align snippets after migration.

### 3.4 History runtime API
- Add `requestHistoryUpdate({ scope, align })` in `src/features/history/historyRuntime.js`, delegating to existing rendering/scroll logic.
- Expose a future-proof enum for scopes: `none`, `restyle`, `rebuildPreserveActive`, `rebuildReset`.

### 3.5 Overlay modules
- Refactor `modelEditor`, `topicEditor`, `settingsOverlay`, `apiKeysOverlay`, `modelSelector`, `topicPicker` to:
  - Consume the overlay context (read-only projections + staged mutations).
  - Report results via `OverlayResult`.
  - Use shared focus keeper utilities.

---

## 4. Step-by-Step Action Plan

### Phase 0 – Prep (1–2 days)
1. **Document contracts**
   - Extend `docs/overlays.md` with overlay result taxonomy and transaction expectations.
   - Update `docs/focus_management.md` to reference the controller + focus keeper.

2. **Add shared utilities**
   - Implement `overlayUtils.ensureFocusWithin` and unit tests.

### Phase 1 – Overlay Controller Skeleton (2–3 days)
1. Create `src/runtime/overlayController.js`:
   - Manage mode snapshot, focus restoration, transaction staging.
   - Provide `openOverlay(type, factory, options)` API.

2. Update `src/main.js` to instantiate the controller and expose it to interaction layer.

3. Write unit tests covering mode/focus restoration and result dispatch.

### Phase 2 – History Update Gateway (2 days)
1. Refactor `historyRuntime` to expose `requestHistoryUpdate`.
2. Migrate settings subscriber and lifecycle hooks to call the new API.
3. Add tests verifying single bottom-align execution per rebuild.

### Phase 3 – Overlay Migrations (approx. 1 week)
1. **Model Editor**
   - Switch to staged edits; return `OverlayResult` with dirty flag.
   - Remove direct store mutations.
   - Add focus keeper to all navigation paths.

2. **Topic Editor**
   - Mirror model editor pattern; ensure tree operations emit diffs instead of live store calls.

3. **Settings Overlay**
   - Stage form edits; controller applies diff and triggers history update via `requestHistoryUpdate`.

4. **Selectors (Topic/Model)**
   - Return selected value without side effects; controller updates `pendingMessageMeta` and decides on history refresh (usually `noop`).

5. **Menus / API Keys / Info overlays**
   - Wrap with controller for consistent mode restore, even if results are `noop`.

### Phase 4 – Interaction Layer Cleanup (1–2 days)
1. Replace ad hoc onClose handlers in `interaction.js` with controller initiation (`overlayController.open` calls).
2. Simplify `runMenuAction` responses to handle only overlay result routing.
3. Ensure keybindings reuse the controller.

### Phase 5 – Testing & Hardening (1 week)
1. **Jsdom suites** for each overlay verifying:
   - Main window frozen during open.
   - Focus remains inside overlay after navigation.
   - History rebuild/align occurs exactly once when required.

2. **Regression tests** for settings/model flows referencing `docs/scroll_positioning_spec.md`.

3. Add coverage for “overlay opens while COMMAND mode active” to guarantee restore semantics.

### Phase 6 – Cleanup & Documentation (2 days)
1. Remove deprecated overlay helper code.
2. Update `docs/ARCHITECTURE.md` and `docs/overlays_architecture_review.md` with the new controller structure.
3. Publish migration notes for future overlay additions (template using controller + staged mutations).

---

## 5. Whole-System Considerations

- **History runtime and store** stay the single source of truth; transactions ensure history updates happen only once per overlay close.
- **Settings subscriber** remains authoritative for rebuild vs. restyle decisions; controller simply feeds diffs into it.
- **Pending message metadata** updates (model/topic selectors) route through controller to avoid bypassing upcoming staging logic.
- **Instrumentation (`hudRuntime`, `requestDebug`)** can observe overlay transactions via hooks in the controller for diagnostics.
- **Tests** preserve existing coverage for parser, evaluator, persistence, ensuring no ripple effects on non-overlay components.

---

## 6. Risk Assessment

| Risk | Mitigation |
|------|------------|
| Controller introduces latency or UI flicker | Keep transactions synchronous; reuse existing render/align code paths. |
| Incomplete overlay migration leaves mixed patterns | Track progress in `docs/plan.md`, gate releases on completion. |
| Settings diffs miss restyle triggers | Augment tests to simulate edge cases (changing `partFraction`, `charsPerToken`). |
| Focus keeper misapplied | Dev warnings when `preferredFocus` fails; jsdom tests cover transitions. |

---

## 7. Success Criteria

- Main window never updates while an overlay is open.
- Closing any overlay restores the exact mode and focus zone captured at open.
- History rebuilds/alignments respect `docs/scroll_positioning_spec.md` with no duplicated logic.
- Overlay modules operate only on staged state; commits happen once via controller.
- Test suite includes overlay lifecycle coverage preventing regressions.

