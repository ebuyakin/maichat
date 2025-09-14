# Focus Management Strategy

Status / Scope / Out of scope / See also
- Status: Introduced Phase 5 (Topic Management MVP); Active.
- Scope: Focus rules for overlays and main panes; prevention of global side-effects; restoration.
- Out of scope: Scroll math, reading behaviour, and lifecycle alignment.
- See also: ARCHITECTURE.md (Glossary), ui_layout.md, keyboard_reference.md.

## Goals
- Predictable, keyboard-first interaction without accidental background actions.
- Isolation: Active modal/overlay fully owns focus & key handling.
- Restoration: Return user to prior logical focus after overlay closes.
- Extensibility: New overlays adopt the same mechanism with minimal code.

## Mechanism Overview
1. `focusTrap.js` exports:
   - `createFocusTrap(container, getPreferredEl)` – installs a capturing `focusin` listener that re-focuses inside the container whenever focus would escape. Returns `{ release, refocus }`.
   - `modalIsActive()` – utility to detect if any recognized modal is present.
2. Each overlay (Topic Picker, Topic Editor) creates a focus trap immediately after DOM insertion and releases it on teardown.
3. Global key router (`KeyRouter`) and global Ctrl+* shortcuts in `main.js` early-return when `modalIsActive()` is true, ensuring overlays receive keystrokes exclusively.
4. Previous active element is stored and restored upon `release()`; if it no longer exists, no-op.

## Overlay Focus Conventions
| Action | Behavior |
|--------|----------|
| Open overlay | Primary text input (search box) receives focus. |
| Ctrl+J | Moves focus context from search input to tree/list pane (Topic overlays). |
| Esc (inside tree) | Returns focus to search input (overlay remains). |
| Esc (inside search input) | Closes overlay, restores previous focus (mode and cursor preserved). |
| Inline edit (rename/new) | Focus moves to inline input; Esc cancels; Enter commits; returns to prior tree/search focus context. |

## Keystroke Ownership Hierarchy
1. Active inline edit input inside overlay.
2. Overlay tree/list navigation layer.
3. Overlay search input layer.
4. Global application (suppressed while 1–3 are active).

## Preventing Background Side-Effects
- Because global handlers (mode switching, view navigation) are suppressed while a modal is active, repeated j/k or star toggles cannot affect the message history unintentionally.
- Focus leakage (e.g., external browser focus changes) triggers trap re-focus via capturing `focusin`.
- Pointer interactions (mouse/touch) switch modes before focus/activation: a capture-phase `pointerdown` listener on the main document promotes the app to the clicked zone’s mode (command/view/input) using `data-mode` markers. Overlays are excluded via `modalIsActive()`.
- Meta parts in history are never focus targets: keyboard navigation already skips them; mouse clicks on the meta surface do not change the active selection. Interactive controls inside meta still operate normally without altering selection.

## Adding a New Overlay (Checklist)
1. Create container element with distinctive backdrop class (e.g., `.my-overlay-backdrop`).
2. Append to DOM.
3. Call `createFocusTrap(container, () => contextElement)` where `contextElement` returns the currently intended focal node (search input vs tree).
4. Add key handling directly on the backdrop (or specific child) – not on `window` – so it is naturally isolated.
5. On teardown, call `trap.release()` before removing the container.
6. Update `modalIsActive()` selector if you use a new backdrop class.
7. Avoid `tabindex="-1"` unless you purposely exclude element from sequential tab order; rely on trap to keep focus internal.

## Edge Cases & Mitigations
| Edge Case | Behavior | Mitigation |
|-----------|----------|------------|
| User presses browser shortcut (Cmd+L) | Browser steals focus | Trap refocuses when user returns (focusin). |
| Underlying element removed before restore | Restore attempt no-ops | Acceptable; minimal overhead. |
| Multiple overlays stacked | Currently unsupported | Design: only one modal at a time; future: maintain stack in focusTrap. |
| Programmatic focus shift inside overlay | Allowed | Trap ignores since within container. |

## Future Enhancements
- Focus ring styling for accessibility (currently disabled outline; we will add custom ring soon).
- ARIA roles & `aria-modal="true"` for overlays.
- Automated focus-management tests (simulate key sequences with jsdom or headless browser harness).
- Stack-based trap management for nested modals if introduced.

## Rationale
A bespoke lightweight solution avoids pulling in dependencies and keeps mental model simple: *If modal visible → global keys paused; all focus must stay inside.* This supports the terminal-like, distraction-free UX while preserving power-user efficiency.

---
End of document.
