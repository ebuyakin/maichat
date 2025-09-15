# Focus Management and Modal Isolation

## Goals
- Predictable, keyboard‑first interaction without accidental background actions.
- Isolation: Active modal/overlay fully owns focus and key handling.
- Restoration: Return user to prior logical focus after overlay closes.
- Extensibility: New overlays adopt the same mechanism with minimal code.

## Architecture overview
1) Focus containment (inside the overlay)
- `focusTrap.js#createFocusTrap(container, getPreferredEl)` installs a capturing `focusin` listener that re‑focuses inside the container whenever focus would escape. Returns `{ release, refocus }`.
- Each overlay (Topic Picker, Topic Editor, Settings, etc.) creates a trap after DOM insertion and releases it on teardown.

2) Central modal blocker (keyboard/pointer/wheel) — replay‑free
- Implemented in `shared/openModal.js` for true modals. While any true modal is open, a small set of capture/bubble listeners is installed and removed when the last modal closes.
- Outside‑target events (targets outside the active modal root) are blocked at window‑capture with `preventDefault + stopImmediatePropagation` → background UI never sees them (no scroll, no clicks, no keys).
- Inside‑modal keys are allowed through at capture so overlays receive the original event naturally. At document‑bubble we stop overlay‑local keys to ensure window‑bubble routers never see them. No event replay is used.
- Non‑modal debug overlays are exempt: they do not block background input (useful for diagnostics).

3) Global listeners (`KeyRouter`, help, etc.)
- Registered at window‑bubble only and early‑return when `modalIsActive()` is true. This is defense‑in‑depth; correctness is provided by the blocker.

4) Behavioral contract while a true modal is open
- No background scrolling, hotkeys, or focus changes from outside‑target interactions.
- Overlay keybindings remain local‑only. On close, the main window is exactly as it was before (focused part, scroll, mode).

5) Modal state API
- `modalIsActive()` → boolean; `modalTopRoot()` → active modal root element. Exported from the modal module for consistent checks.

## UI Modes and modal overlays
- Modes: INPUT, VIEW, COMMAND. Exactly one is active at a time. Modes define which global keys are enabled and which UI zone owns focus by default.
- Not a mode: Typewriter Regime is a temporary reading alignment toggle that affects j/k positioning only (see scroll spec), independent of the UI mode.

### Focus zones by mode
- INPUT → bottom compose area (textarea + pending meta controls).
- VIEW → middle history area (active part navigation and actions).
- COMMAND → top CLI input (filter entry).

### Minimal mode FSM (contract)
- VIEW: Enter → INPUT; Escape → COMMAND.
- COMMAND: Enter → apply filter and switch to VIEW; Escape → clear input (no apply), remain COMMAND.
- INPUT: Escape → VIEW. Send uses post-send focus rules (see scroll spec “Send/Reply”).

### Interaction with overlays
- Opening a true modal overlay freezes background and does not change the current mode. On close, restore the exact pre-open focus and mode.
- Settings/model-driven rebuilds while a modal is open preserve mode; after rebuild completes and measurements update, bottom-align the preserved focused part once (see scroll spec item 10). Debug overlays are non-modal and never freeze background.

### Keys and routing
- Global key routing is mode-aware (handled by the key router) and runs only when `modalIsActive() === false`.
- Overlay-local keys remain local: they never reach window-bubble routers while the overlay is active.

References:
- Full keymaps by mode: `docs/keyboard_reference.md`.
- Scroll and post-action positioning rules (including send/reply and filter apply): `docs/scroll_positioning_spec.md`.
- Architecture pointers (mode FSM and key router files): `docs/ARCHITECTURE.md`.

## Overlay focus conventions
| Action | Behavior |
|--------|----------|
| Open overlay | Primary text input (search box) receives focus. |
| Ctrl+J | Moves focus from search input to tree/list pane (Topic overlays). |
| Esc (inside tree) | Returns focus to search input (overlay remains). |
| Esc (inside search input) | Closes overlay, restores previous focus (mode and cursor preserved). |
| Inline edit (rename/new) | Focus moves to inline input; Esc cancels; Enter commits; returns to prior tree/search focus context. |

## Keystroke ownership hierarchy
1. Active inline edit input inside overlay.
2. Overlay tree/list navigation layer.
3. Overlay search input layer.
4. Global application (suppressed while 1–3 are active).

## Preventing background side‑effects
- Central blocker prevents background handlers from observing inside‑modal keys and blocks all outside‑target interactions at capture. Repeated j/k or ordering toggles inside overlays cannot affect history.
- Focus leakage (e.g., browser steals focus) is corrected by the trap via capturing `focusin`.
- Pointer interactions (mouse/touch) switch modes before focus/activation via a capture‑phase pointerdown in the main document, but true modals exclude background switching due to the blocker.
- Meta parts in history are never focus targets: keyboard navigation skips them; clicks on the meta surface don’t change selection. Interactive controls inside meta still work without altering selection.

### Simple checks (browser)
- With Topic Editor open:
   - Trackpad scroll over history → no movement.
   - Click outside overlay → no focus change, no background reaction.
   - PageUp/PageDown/Space outside inputs → no background scroll.
   - `o` / `Ctrl+O` inside overlay → only overlay updates; background does nothing.

## Rendering interactions (selective re‑render)
Some overlays save settings that can affect the history view. A centralized policy decides whether to rebuild history, restyle only, or do nothing:
- No history work: `topicOrderMode`, `scrollAnim*`, `showTrimNotice`, debug/help/menu toggles.
- Restyle‑only (CSS vars + pane layout; no history rebuild): `partPadding`, `gap*`, `fade*`.
- Rebuild required (composition/context): `userRequestAllowance`, `charsPerToken`, model switches affecting URA model.

Behavior on rebuilds triggered by settings/model editor:
- Preserve the focused part if possible and perform a one‑shot bottom anchor on the focused part after re‑measurement to ensure visibility. Mode unchanged.
- Timing: act on commit/save, not on overlay close.
- Reference: see `docs/scroll_positioning_spec.md` item 10 for precise bottom‑anchor semantics.

### Overlay‑specific history re‑render policy (summary)
- Topic Picker
   - Selecting topic for pending message: NO history re‑render.
   - Reassigning topic for active pair (quick pick): NO history re‑render; badges update on next explicit render.
   - Toggling topic ordering (o/Ctrl+O): NO history re‑render.
- Topic Editor
   - Create/rename/move/delete topics: NO history re‑render at commit; reflected on next natural refresh.
   - Reassigning a pair from within editor: not supported; never re‑renders.
- Settings
   - Spacing/fade: Restyle‑only.
   - Context‑affecting (URA/assumedUserTokens, charsPerToken): Rebuild with preserveActive + bottom‑anchor.
   - Scroll animation: NO history re‑render.
- Model Selector: Changing pending model → NO history re‑render.
- Model Editor: Rebuild only if URA model context computation depends on the active model; otherwise none.
- API Keys, Daily Stats, Help/Tutorial/App Menu: NO history re‑render.

## Edge cases & mitigations
| Edge Case | Behavior | Mitigation |
|-----------|----------|------------|
| Browser shortcut (Cmd+L) | Browser steals focus | Trap re‑focuses when user returns (`focusin`). |
| Underlying element removed | Restore attempt no‑ops | Acceptable; minimal overhead. |
| Multiple overlays stacked | Top‑most true modal owns input | Blocker + trap maintain a stack. |
| Programmatic focus shift inside overlay | Allowed | Trap ignores internal focus moves. |
| Window‑bubble global listeners observe keys | Prevented | Document‑bubble stopper mutes overlay‑local keys; no replay. |

## References
- Scroll positioning: `docs/scroll_positioning_spec.md` (one‑shot actions, ensure‑visible, typewriter regime; item 10 for settings/model rebuilds).
- Rendering policy gate: `src/runtime/renderPolicy.js`; subscriber wiring in `src/main.js`.

## Rationale
A lightweight, phase‑based, replay‑free design keeps the mental model simple: If a modal is visible, global keys are paused and all focus must stay inside. That supports the terminal‑like, distraction‑free UX while preserving power‑user efficiency.

---
End of document.
