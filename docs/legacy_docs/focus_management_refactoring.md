# Focus Management Refactoring

Date: 2025-09-15
Status: In progress — Core input isolation implemented; adding selective history re-render policy

## Summary
A clean, robust design where the top-most true modal overlay exclusively owns key/pointer/wheel input. Background UI is frozen for outside-target interactions. Inside the modal, keys reach overlay-local handlers and never reach window-level routers. Debug overlays remain non-modal: they never block background input nor require central blocking.

This replaces the brittle "capture-stop + key replay" approach with a simpler, phase-based event policy: block outside at window-capture, allow inside through, and stop inside keys at document-bubble. No event replay.

Scope extension: introduce a selective history re-render policy (centralized gate) so only settings that truly affect history composition/layout cause a re-render. Non-history settings (e.g., topic tree ordering) must not trigger any history refresh and must not disturb focus/scroll position.

---

## Current Issues (Diagnosis)
- Mixed control planes: central blocker at window capture plus multiple window listeners (KeyRouter and others) at bubble/capture.
- Key replay workaround: stopping the original key at capture and replaying it re-enters the event pipeline and leaks to global listeners in the browser.
- Modal detection via DOM queries in different files (KeyRouter, focus utilities), inconsistent and easy to drift.
- Some window capture listeners exist outside overlays, complicating guarantees.
- Tests pass in jsdom because window-capture global routers arent mirrored; browser shows leaks.

Result: "o / Ctrl+O" (and similar) inside overlays can still bubble up to KeyRouter/global handlers in the real browser, despite tests being green.

---

## Desired Architecture

Principles
- Single source of truth: modal stack with API: `modalIsActive()` and `modalTopRoot()`.
- Overlay-local ownership: overlays attach key handlers at their root/backdrop, stop propagation for handled keys; no window listeners inside overlays.
- Global listeners constrained: window-level key handlers exist at bubble phase only and check `modalIsActive()` first.
- Central blocker simplified: no replay. Manage only cross-overlay isolation.

Event Policy
1) Window-capture (central blocker)
   - If target is outside the top modal root: block per policy (keys/pointer/wheel) with preventDefault + stopImmediatePropagation.
   - If target is inside the top modal root: do not block at capture (let overlays see the original event).
2) Document-bubble (central blocker)
   - If target is inside the top modal root and event is a key: stopImmediatePropagation so window-bubble listeners (KeyRouter, etc.) never see overlay-local keys.
3) Window-bubble
   - All app-level routers (KeyRouter, menu handlers, help F1, etc.) run only if `modalIsActive() === false`.

Debug Overlays
- Registered as "exempt roots" (non-modal): central blocker ignores them.
- They do not stop propagation; background app continues to work normally while debug overlays are visible.

---

## Rendering Policy (Selective History Re-render)

Terminology
- History re-render: rebuilding history parts + remeasuring + applying active highlight; may change scroll position if not anchored.
- Policy gate: centralized logic that decides, based on which setting keys changed, whether to re-render history, restyle/layout only, or do nothing.

Principles
- Do not re-render history unless the change affects history composition or layout metrics.
- Keep overlays independent: they can freely call `saveSettings(patch)`; the policy gate determines downstream effects.
- Maintain viewport invariants by default: if no re-render is needed, focus and scroll remain exactly the same.

Initial key categories (extensible)
- No history work (no-op for history): `topicOrderMode`, `scrollAnim*`, `showTrimNotice`, debug/menu/help toggles.
- Layout/spacing restyle only (apply CSS vars + pane layout; no history rebuild): `partPadding`, `gapOuterPx`, `gapMetaPx`, `gapIntraPx`, `gapBetweenPx`, `fade*`.
- Composition/context impacting (requires history re-render): `assumedUserTokens`/`userRequestAllowance`, `charsPerToken`, model switches that change URA model.

Subscriber behavior
- Compute changed keys diff on each `saveSettings` patch.
- For each category:
  - No-op: skip history calls entirely.
  - Restyle-only: `applySpacingStyles` + `layoutHistoryPane` (+ optional `scrollController.remeasure()`), but avoid `renderCurrentView`.
  - Full rebuild: `renderCurrentView({ preserveActive:true })`.

Modal interaction (optional nicety)
- While a true modal is active, it’s acceptable to defer even restyle-only updates to avoid perceptual shifts; flush once modals close. Not required for correctness.

---

## Implementation Plan (Phased, Low Risk)

Phase A: API + Hygiene — DONE
- Expose `modalIsActive()` and `modalTopRoot()` from `shared/openModal.js` (or re-export from `shared/focusTrap.js`).
- Update global listeners to consult `modalIsActive()` and early-return when true.
  - Files likely affected:
    - `src/features/interaction/keyRouter.js` (replace DOM query check with modal API)
    - `src/features/interaction/interaction.js` (window keydown registrations)
    - Any other `window.addEventListener('keydown', ...)` in features/config/* overlays
- Remove/avoid window-capture key listeners outside overlays.

Phase B: Central Blocker Simplification (no replay) — DONE
- In `shared/openModal.js`:
  - Remove key replay logic and the replay tracking.
  - Keep capture blocking for outside-target events.
  - Add document-bubble stopper for inside-modal keys.
- Ensure pointer/wheel inside modal are allowed; outside are blocked.

Phase C: Overlay Locality Review — DONE
- Verify overlays use root/backdrop listeners and call stopImmediatePropagation for handled keys:
  - Topic Editor (`src/features/topics/topicEditor.js`)
  - Topic Picker (`src/features/topics/topicPicker.js`)
  - Model Selector (`src/features/config/modelSelector.js`)
  - Model Editor (`src/features/config/modelEditor.js`)
  - Settings (`src/features/config/settingsOverlay.js`)
  - Api Keys (`src/features/config/apiKeysOverlay.js`)
  - Daily Stats (`src/features/config/dailyStatsOverlay.js`)
- Remove any overlay-added window listeners unless truly necessary and ensure they are removed on teardown.

Phase D: Tests & Browser Sanity — DONE
- Add unit tests simulating a window-bubble router to assert it doesnt see inside-modal keys.
- Optional: add a synthetic window-capture test (limited in jsdom) or a tiny puppeteer smoke for leakage.
- Manual browser check: with Topic Editor open, press `o`/`Ctrl+O` and `j/k`; ensure history doesnt scroll or react.

---

Phase E: Selective History Re-render Policy — NEW
- Settings diff: compute changed keys in `core/settings/index.js` and pass to subscribers (2nd arg), or expose a getter for last snapshot so subscribers can diff.
- Central policy gate: update the settings subscriber in `src/main.js` to:
  - Map changed keys to categories.
  - Perform minimal necessary work: none, restyle-only, or full `renderCurrentView({ preserveActive:true })`.
- Tests:
  - Toggling topic tree ordering (`topicOrderMode`) must not call `renderCurrentView`; viewport unchanged pre/post.
  - Spacing change triggers restyle + layout only (no rebuild).
  - Context-affecting change triggers rebuild and preserves the active part.
- Optional: When a modal is active, coalesce restyle-only and rebuild work until modal closes; then perform one recompute + `ensureVisible(active)`.

---

## Overlay-specific History Re-render Policy

This section states plainly which overlays trigger a history re-render and exactly when.

- Topic Picker (`src/features/topics/topicPicker.js`)
  - Selecting a topic for the pending message (Input mode): NO history re-render. Only pending meta updates.
  - Reassigning a topic for the active pair (View mode quick picker): NO history re-render; focus and viewport remain unchanged. The pair’s topicId changes persist without forcing a rebuild; history will naturally reflect updated topic badges on the next explicit render.
  - Toggling topic ordering (o/Ctrl+O): NO history re-render. Internal overlay UI updates only.

- Topic Editor (`src/features/topics/topicEditor.js`)
  - Creating, renaming, moving, deleting topics: NO history re-render at commit time. History shows any new topic names/paths next natural refresh (e.g., after send) or on explicit reload; focus/scroll remain unchanged on close.
  - Reassigning a topic for a specific pair from within the editor: not supported; effectively NEVER triggers history re-render.
  - Toggling topic ordering (o/Ctrl+O): NO history re-render.

- Settings (`src/features/config/settingsOverlay.js`)
  - Spacing/fade settings (partPadding, gap*, fade*): Restyle-only apply (CSS vars + layout) without history rebuild; optional `scrollController.remeasure()`; focus/scroll preserved.
  - Context-affecting settings (URA/assumedUserTokens, charsPerToken): History re-render with `{ preserveActive: true }`.
  - Scrolling animation settings (scrollAnim*): NO history re-render.

- Model Selector (`src/features/config/modelSelector.js`)
  - Changing pending model (Input mode): NO history re-render. Only pending meta updates.

- Model Editor (`src/features/config/modelEditor.js`)
  - Enabling/disabling models, changing active model: NO immediate history re-render unless URA model context computation depends on the active model. If it does, trigger history re-render with `{ preserveActive: true }`.

- API Keys (`src/features/config/apiKeysOverlay.js`)
  - Adding/removing keys: NO history re-render.

- Daily Stats (`src/features/config/dailyStatsOverlay.js`)
  - Viewing stats: NO history re-render.

- Help/Tutorial/App Menu overlays
  - Purely informational or navigation: NO history re-render.

Notes
- “Re-render” above refers to `historyRuntime.renderCurrentView({ preserveActive: true })`.
- “Restyle-only” refers to `applySpacingStyles` + `layoutHistoryPane` + optional `scrollController.remeasure()` — no history rebuild.
 - Timing: When re-rendering is warranted, it happens at the moment the change is committed (saveSettings/store update), not on overlay close.

## Files Affected
- `src/shared/openModal.js` (blocker simplification; modal API additions if needed)
- `src/shared/focusTrap.js` (may re-export modalIsActive; small consolidation)
- `src/features/interaction/keyRouter.js` (use modalIsActive; ensure bubble-phase, not capture)
- `src/features/interaction/interaction.js` (guard window keydown handlers with modalIsActive)
- Overlays listed above (review for local-only listeners; ensure stopImmediatePropagation on handled keys)
- Tests under `tests/unit/` (add tests for modal isolation; update any assumptions)

New files (optional)
- None required. Optionally, `src/shared/modalState.js` to host modal API if we prefer separating concerns.

Additional for Phase E
- `src/core/settings/index.js` (emit changed keys or expose last snapshot for diffing)
- `src/main.js` (selective re-render policy in the settings subscriber)

---

## Impact on Other Components
- Interaction/KeyRouter: becomes more predictable; early-return on `modalIsActive()` simplifies logic. No functional regressions expected.
- Overlays: they already use local handlers; well align any stragglers. No user-visible changes except elimination of leakage.
- Debug overlays: unchanged behavior (non-modal). They remain exempt and do not block or consume keys.
- Focus trap: unchanged; continues to keep focus inside overlays.
- Performance: negligible change; fewer synthetic events than the replay approach.

Selective re-render policy impact
- Prevents unnecessary history rebuilds, removing spurious viewport shifts during modal interactions.
- Centralizes responsibility; overlays remain simple and local.

Isolation & Safety
- The change is mostly internal wiring and guards; external APIs and UX stay the same.
- We avoid touching business logic or rendering; only event routing is adjusted.
- Tests will protect against regressions; we add targeted tests for modal isolation.

---

## Coexistence with Existing Overlay Mechanisms
- Some overlays already stop propagation locally on their root/backdrop. This aligns with the new architecture and can remain as a secondary defense.
- Where overlays attached window listeners, well localize them or wrap with `modalIsActive()` checks and ensure teardown removes them.
- The central blocker provides top-level guarantees; local overlay stoppers provide immediate containment near the target. These layers complement each other when consistent with the phase policy.

The rendering policy is orthogonal to input isolation: overlays continue to call `saveSettings(patch)`; the subscriber decides if any history work is warranted.

---

## Risks & Mitigations
- Hidden capture listeners: a stray window-capture key listener could still observe inside-modal keys. Mitigation: audit grep for `addEventListener('keydown'` and ensure capture=false outside overlays.
- DOM-query modal checks drift: replace with `modalIsActive()` everywhere.
- Test blind spots: add a test that simulates a global router and verify it stays silent during modals.

Policy-specific
- Misclassification of settings → stale UI or unnecessary re-renders. Mitigate via a keyed policy map with tests per key family and clear comments.
- Future settings: require categorization on addition; add a test stub to enforce mapping.

---

## Acceptance Criteria
- With any true modal open, pressing overlay keys (e.g., `o`, `Ctrl+O`, `j/k`, `Esc`) never triggers KeyRouter or background handlers.
- Outside-target interactions (clicks, wheel, PageUp/Down) do not affect the background.
- Debug overlays do not block or consume keys; background behaves normally when only debug overlays are visible.
- All tests green; new isolation tests pass in jsdom; manual browser check shows no leakage.

Overlay-specific policy
- Topic ordering toggles in Picker/Editor do not cause history re-render and do not move the viewport.
- Topic create/rename/move/delete in Editor does not cause history re-render on close; focus/scroll unchanged.
- Topic reassignment of the active pair (Picker/View path or Editor) rebuilds history and preserves the focused part.
- Spacing/fade changes restyle without rebuilding and preserve focus/scroll.

Selective re-render policy
- Toggling topic tree ordering (`topicOrderMode`) does not re-render history and does not change viewport.
- Changing spacing/fade settings restyles without rebuilding history.
- Changing context-affecting settings (URA, charsPerToken) rebuilds history and preserves the focused part.

---

## Rollback Plan
- If unexpected regressions appear, we can revert to the previous blocker version. Because changes are confined to event routing, the rollback surface is small.

For the rendering policy gate, rollback by restoring the prior unconditional subscriber in `main.js`. The change surface is small and isolated.

---

End of document.
