# Overlays Architecture Review — Focus, Keys, and Mode Restoration

Date: 2025-09-16
Owner: Runtime/UI

## Purpose
Provide a clear, robust, and testable contract for modal overlays in MaiChat so they:
- Always own focus/keys while open (no background leakage).
- Close predictably and restore the main UI’s mode/focus correctly.
- Remain resilient to internal DOM updates (no freezes after edits, jumps, or toggles).
- Are simple for feature code to adopt consistently.

References: `docs/focus_management.md`, `docs/overlays.md`, `docs/scroll_positioning_spec.md`.

## Current primitives & patterns (inventory)
- Central modal API: `src/shared/openModal.js`
  - Captures `prevMode = modeManager.mode` at open; on `close()` calls `modeManager.set(prevMode)` if `restoreMode: true`.
  - Installs a central blocker at window-capture to block outside-target keys/pointer/wheel.
  - Adds a document-bubble stopper so overlay-local keys don’t reach global routers.
  - Installs a focus trap (`createFocusTrap`) and attempts to focus `preferredFocus()` or `root`.
- Overlays using `openModal` (non-exhaustive):
  - Config: `modelEditor`, `modelSelector`, `settingsOverlay`, `apiKeysOverlay`, `helpOverlay`, `dailyStatsOverlay`
  - Topics: `topicPicker`, `topicEditor`
  - Menus/Interaction: `interaction` menu modal, confirmation overlays

## Observed failure modes (from recent defects)
1) Focus loss after internal updates (rebuild/move)
   - Overlays rebuild inner lists or blur inputs without immediately focusing a new in-overlay element. Browser focuses `document.body` ⇒ central blocker swallows keys ⇒ overlay appears "frozen".
   - Repro: Edit numeric cell, press `j`/`G`; or toggle enabled (re-renders row). If no in-overlay focus restoration, keys stop working.

2) Mode restoration mismatch on close
   - Expected: After closing any overlay, the app returns to the same UI mode it had at the moment of opening (INPUT/VIEW/COMMAND).
   - Implementation today: `openModal` snapshots `modeManager.mode` at open and restores exactly that on close.
   - Mismatches can occur when:
     - The overlay is opened while the app is already in COMMAND (or the mode changes just before open); user expects to return to previous logical context, not necessarily the transient mode at the moment open was invoked.
     - Focus restoration after close targets an element associated with a different mode, and a downstream listener flips mode based on focus heuristics.
     - Overlay-local key handlers (e.g., Esc) bubble or race with global routers (should be prevented by the blocker, but any stray window listeners can still interfere).

3) Inconsistent `preferredFocus`
   - Some overlays pass a non-focusable element or omit `preferredFocus`. The trap then tries to focus the root, which may not be keyboard-focusable, causing focus drift on open.

4) Scattered event binding strategies
   - Most overlays add root-capture key handlers (good), but some historical code paths used window listeners or relied on default bubbling orders, which can be brittle with the blocker.

## Root causes
- Lack of a standard "post-transition focus" step: After blur/rebuild/move, overlays must guarantee a new in-overlay focus target. Without it, the blocker correctly prevents background input, but the overlay stops receiving keys.
- Ambiguity around mode restoration: `openModal` is correct by spec (restore mode to snapshot at open). However, focus restoration on close may target elements that imply a different mode, and external code may adjust mode based on focus. This coupling between DOM focus and UI mode leads to surprises.
- Weak `preferredFocus` discipline: If the first focus target isn’t guaranteed focusable, the trap can’t stabilize focus on open.

## Desired contract (simple, enforceable)
1) Open
   - Always call `openModal({ root, preferredFocus, closeKeys, restoreMode: true })`.
   - `preferredFocus` must return a focusable element (e.g., a text input, list container with `tabindex="0"`, or a specific row).
   - Overlays must attach all key handlers on the overlay root (capture). No window-level overlay listeners.

2) While active
   - After any transition that can drop focus or replace DOM nodes (blur, j/k row move, g/G jump, PageUp/Down, toggles, inline add/remove rows), call a single helper to focus a safe, in-overlay element:
     - Prefer: same-column input in the new active row → active row element → overlay’s primary list (`ul[tabindex=0]`) → explicit fallback node.
     - If the transition re-renders, run this focus step on the next animation frame to ensure the new DOM exists.

3) Close
   - `openModal` restores `prevMode` (the mode at open) and releases the trap.
   - Overlays must not rely on browser default focus restoration. Instead, main-layer code should set focus based on the restored mode (e.g., history pane for VIEW, compose for INPUT, CLI for COMMAND) if necessary.
   - `beforeClose(trigger, { prevMode })` is the place to notify about dirty state; it must be side-effect–free w.r.t. modes.

## Concrete improvements
A) Shared helper: Focus keeper utility
- Small function in `shared/overlayUtils.js` (or local per overlay) to ensure focus remains inside the overlay after transitions.
- Signature: `ensureFocusWithin(root, candidates: (()=>Element|null)[])`; the first non-null focusable wins; fallback to root if focusable.
- Usage: Call after any blur/re-render/move path; in re-render cases, wrap in `requestAnimationFrame`.

B) Strengthen `preferredFocus`
- Each overlay must pass a function that returns a guaranteed focusable node (set `tabindex=-1` when needed).
- Add a tiny check in `openModal` (non-breaking) to warn in dev builds if `preferredFocus()` returns a non-focusable element.

C) Decouple mode restoration from DOM focus on close
- Keep `restoreMode: true` as our source of truth.
- After close, the main interaction layer should explicitly set focus based on the restored mode, instead of relying on browser auto-restoration of `activeElement`. This avoids unintended mode inference from focus.
- Optional future: `openModal` option `restoreFocus: false` to skip automatic previous focus restore by the trap (today the trap attempts to restore previous focus in `release()`). Callers can manage it for deterministic outcomes.

D) Tests (per overlay)
- Open overlay → focus is inside overlay; global keys muted.
- j/k/g/G/PageUp/Down/Space within overlay never leak to routers; after these transitions, focus remains inside the overlay.
- Enter/Esc inside overlay do the overlay’s action and don’t affect global mode.
- Close overlay → mode restored to snapshot (at open); main focus routed to the right target for that mode.

## Migration plan (overlay by overlay)
1) Model Editor
- Adopt a single local `ensureOverlayFocus()` used after: toggles, numeric-edit Enter, j/k/g/G/PageUp/Down, inline add row, and any render that replaces rows.
- Confirm `preferredFocus` targets the active row/list.
- Tests: already added; extend with mode restoration test on close.

2) Topic Editor
- Audit for the same transitions (rename, move, toggles); add focus keeper after any re-render.
- Ensure `preferredFocus` points to search input or tree.

3) Selectors (Topic/Model)
- Lighter: ensure `preferredFocus` is the list; avoid window listeners; verify Esc/Enter do not leak.

4) Settings / API Keys / Help / Daily Stats / Menu overlays
- Verify `preferredFocus`; ensure any internal reflows don’t drop focus; add minimal tests.

## Answers to specific incidents
- "Returned to COMMAND mode on close": Check which mode was active at the exact moment of opening (overlay snapshot), and whether the interaction layer changes mode on focus after close. The fix is to let `restoreMode` be authoritative and ensure post-close focus is set consistently with the restored mode (not inferred from browser’s previous active element).
- "Freeze after TPM edit + j/g/G": This is the focus-loss-after-transition case. Use the focus keeper immediately after the move/jump; for rebuilds, run it on rAF.

## Minimal shared changes vs local fixes
- We can deliver immediate reliability by introducing the focus keeper locally in each overlay (lowest risk).
- For long-term maintainability, a tiny shared utility (overlay focus keeper) and optional `restoreFocus: false` in `openModal` would reduce duplication and prevent cross-overlay drift, still without changing the blocker’s core behavior.

## Acceptance criteria
- No overlay ever loses focus to `document.body` while visible.
- Keys never leak to background while a modal is open.
- Closing an overlay always restores the mode to what it was at open and sets focus appropriately for that mode.
- DOM updates inside overlays do not cause freezes.
- Tests exist per overlay to enforce the above.

## Next steps
- Apply the local focus keeper pattern to Topic Editor and Settings overlays; add tests.
- Add a mode-restoration test to Model Editor close (ensures we return to the open-time mode).
- Optionally add `overlayUtils.ensureFocusWithin()` and migrate overlays gradually.
