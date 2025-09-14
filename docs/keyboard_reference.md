# Keyboard Reference

Status / Scope / Out of scope / See also
- Status: v0.11 (living document)
- Scope: Canonical source for all key bindings, per‑mode behavior, overlays, reserved combinations.
- Out of scope: Scroll math and behavior details (see scroll_positioning_spec.md); full UI layout rationale (see ui_layout.md).
- See also: ARCHITECTURE.md (Glossary), ui_view_reading_behaviour.md, scroll_positioning_spec.md.

Canonical source for all key bindings, per-mode behavior, overlays, and reserved combinations. Updated alongside implementation.

## 0. Modal Windows & Mode Restoration (Unified Spec)
All modal overlays restore the exact mode active at the moment they were opened. Implemented via a shared `openModal` helper (captures prevMode, focus-traps, swallows close keys, restores mode).

Covered overlays:
1. Topic Editor (Ctrl+E)
2. Model Editor (Ctrl+Shift+M)
3. Model Selector (Ctrl+M – INPUT only by design)
4. API Keys Overlay (Ctrl+K or menu, or auto-open on missing/invalid key)
5. Help Overlay (F1)
6. Settings Overlay (Ctrl+,)
7. Topic Quick Picker (Ctrl+T: VIEW/INPUT only per spec)

Notes:
- Menu (Ctrl+.) still uses its own handler but already preserves mode; may migrate to helper later.
- Close keys (Esc, Enter where applicable) are fully swallowed (preventDefault + stopPropagation + stopImmediatePropagation) preventing accidental mode transitions.
- Ctrl+T remains disabled in COMMAND mode (intentional design choice). Ctrl+M remains disabled outside INPUT mode.
- API Keys overlay now fully keyboard navigable (j/k between fields & buttons, Enter activates focused button, Esc closes) and restores prior mode.
- Future overlays must use `openModal` to inherit these guarantees.
- Automated tests for mode restoration are planned (harness pending); manual QA validated behavior.

---

## 1. Modes Overview
Modes: VIEW, INPUT, COMMAND.

Cyclical transitions via Enter / Escape:
VIEW --Enter--> INPUT --Esc--> VIEW --Esc--> COMMAND --Enter--> VIEW

Direct (global) overrides (work in any mode, even when an input has focus):
- Ctrl+v : Jump to VIEW
- Ctrl+i : Jump to INPUT
- Ctrl+d : Jump to COMMAND

## 2. Global (All Modes Unless Noted)
| Key | Action | Notes |
|-----|--------|-------|
| Ctrl+v | Switch to VIEW | Blurs inputs |
| Ctrl+i | Switch to INPUT | Focuses bottom input |
| Ctrl+d | Switch to COMMAND | Focuses command input |
| Ctrl+T | Open topic quick picker (VIEW: reassign active pair topic, INPUT: set pending topic) | Overlay (Selection) (restores prev mode) |
| Ctrl+K | Open API Keys overlay | Overlay (Edit) (restores prev mode) |
| Ctrl+M | Open model selector (INPUT mode only; chooses pending message model) | Overlay (Selection) (restores prev mode) |
| Ctrl+Shift+M | Open model editor (all modes) | Enable/disable models (j/k move · Space toggle · Enter/Esc close) (restores prev mode) |
| Ctrl+E | Open topic editor | Overlay (Edit) (restores prev mode) |
| Ctrl+, | Open settings overlay | Adjust preferences (restores prev mode) |
| Ctrl+. | Open menu | Mode preserved (will migrate to helper) |
| F1 | Help overlay | Esc / F1 close (restores prev mode) |

## 3. VIEW Mode Keys
| Key | Action | Remarks |
|-----|--------|---------|
| j | Next part | Primary navigation |
| k | Previous part | Primary navigation |
| ArrowDown | Next part | Secondary fallback |
| ArrowUp | Previous part | Secondary fallback |
| g | Jump to first part | Single press |
| G | Jump to last part | Shift+g |
| o / Shift+O | Jump to first in‑context pair (boundary) and center it | One-shot center (does not enable the Typewriter Regime) |
| r | Toggle Typewriter Regime | Centers on each j/k; exits on g/G, send/reply, filter change |
| n | Jump to FIRST part of last message | Clears new-message badge; re-anchors even if already there |
| e | Re-ask focused error message | Copies text to input; on Send, old error pair is deleted and a new message is created at the end (uses current context) |
| d | Delete focused error message | Removes the error pair; focus moves to previous part |
| * | Cycle star (0→1→2→3→0) | Affects active pair |
| 1 / 2 / 3 | Set star to 1 / 2 / 3 | Direct rating |
| Space | Set star to 0 | Clear rating |
| a | Toggle color flag (blue↔grey) | Updates flag badge |
| Enter | Switch to INPUT mode | Focus bottom input |
| Escape | Switch to COMMAND mode | Focus top command input |

## 4. INPUT Mode Keys
| Key | Action | Notes |
|-----|--------|-------|
| Enter | Send message & remain in INPUT | Ignored if previous send pending ("AI is thinking") |
| Escape | Return to VIEW | Restores active selection |
| Ctrl+v / Ctrl+d / Ctrl+i | Direct mode switch | Overrides cycle |
| Ctrl+U | Delete from line start to cursor | Emacs-style editing |
| Ctrl+W | Delete previous word | Emacs-style editing |

(Star / include keys intentionally disabled while typing to avoid accidental edits. Future: enable when input empty.)

## 5. COMMAND Mode Keys
| Key | Action | Notes |
|-----|--------|-------|
| Enter | Apply filter then go to VIEW | If filter unchanged, prior active part restored (no jump); if changed or cleared, jump to last part |
| Escape | Clear filter (if any), stay COMMAND | Restores full history |
| Ctrl+P | Previous command in history | Persistent (survives reload, max 100) |
| Ctrl+N | Next command in history | Clears to empty at end |
| Ctrl+v / Ctrl+i / Ctrl+d | Direct mode switch | |
| Ctrl+U | Delete from line start to cursor | Emacs-style editing |
| Ctrl+W | Delete previous word | Emacs-style editing |

## 6. Topic Quick Picker (Ctrl+T)
Hidden root: the conceptual root node is not displayed; top-level rows are its children.
| Key | Context | Action |
|-----|---------|--------|
| (typing) | Search field | Filter topics by name or any ancestor path substring |
| Ctrl+J | Search field | Move focus into tree |
| Esc | Search field | Close picker |
| Esc | Tree | Return focus to search (second Esc closes) |
| j / k | Tree | Move down / up |
| ArrowDown / ArrowUp | Tree | Alternate movement |
 | a | Toggle color flag (blue↔grey) | Updates flag badge |
| l / ArrowRight | Tree | Expand or go to first child |
| Enter | Tree | Select highlighted topic (applies & closes) |

## 7. Topic Editor (Ctrl+E)
Hidden root; operations occur on visible hierarchy.
| Key | Layer | Action |
|-----|-------|--------|
| (typing) | Search | Filter by name/path substring (forces ancestor expansion for matches) |
| Ctrl+J | Search | Focus tree |
| Esc | Search | Close editor |
| Esc | Tree | Return to search (Esc again closes) |
| j / k | Tree | Move down / up |
| h / ArrowLeft | Tree | Collapse / go to parent |
| l / ArrowRight | Tree | Expand / go to first child |
| n | Tree | New child under active topic |
| N (Shift+n) | Tree | New top-level topic (child of hidden root) |
| r | Tree | Rename active topic |
| d then y / n | Tree | Delete (if no children & no direct messages) / cancel |
| m | Tree | Mark topic for move |
| p | Tree | Paste marked topic as child of active (re-parent) |
| Enter | Tree | Select topic (apply callback & close) |

Details pane shortcuts (overlay-local):
| Key | Context | Action |
|-----|---------|--------|
| Ctrl+E | Anywhere in overlay | Focus System message |
| Ctrl+T | Anywhere in overlay | Focus Temperature field |
| Ctrl+O | Anywhere in overlay | Focus Max output tokens |

Notes:

## 8. Navigation Semantics

Pointer interactions (mouse/touch): Clicking in a UI zone automatically switches to that zone’s mode (command/view/input) before the target receives focus. Overlays are excluded. Keyboard behavior unchanged.

## 9. Metadata Editing
Current shortcuts (*, a) are VIEW-only to prevent accidental edits while typing. Potential future: enable when input empty.

## 9a. Settings Overlay (Ctrl+,)
Consistent, scalable key model for all settings controls.
| Key | Context | Action | Notes |
|-----|---------|--------|-------|
| j | Any focused field | Move focus to next control | Wraps at end |
| k | Any focused field | Move focus to previous control | Wraps at start |
| + / = | Focused numeric field | Increment by 0.05 | Uses field step; '=' is unshifted key producing same event on some layouts |
| Shift+ + | Focused numeric field | Increment by 0.10 | Large step |
| - / _ | Focused numeric field | Decrement by 0.05 | Clamped (no wrap) |
| Shift+ - | Focused numeric field | Decrement by 0.10 | Large step |
| Space | Focused select (categorical) | Cycle forward to next option | Wraps |
| Shift+Space | (Reserved) | (No action) | Could cycle backward later |
| Enter | Anywhere in form | Apply (save) without closing | Apply button text changes to 'Saved' and remains until a field changes or overlay closes |
| Esc | Anywhere in form | Cancel & close (discard unsaved edits) | Reverts to previously saved values |
| Tab / Shift+Tab | Native | Standard focus traversal | Unmodified |

Apply writes settings immediately; Cancel discards any unsaved adjustments since last Apply.

## 10. Reserved / Future Keys
| Keys | Planned Purpose | Status |
|------|------------------|--------|
| Ctrl+u / Ctrl+d | Half-page up/down | Planned |
| ? | Help / cheat sheet overlay | Planned |
| p | Context preview overlay | Planned |
| / | Inline search (history) | TBD |
| Shift+* variants | Direct star set | TBD |

## 11. Extension Interference
Vim-style navigation (j/k) may be intercepted by browser extensions (e.g. Vimium). Exclude this site for full functionality. Arrow keys remain as fallback.

## 12. Design Principles Recap
1. Primary keys (j/k, g/G) frictionless (no modifiers).
2. Enter/Escape cycle reduces mnemonic load.
3. Direct Ctrl+<mode> shortcuts allow instant mode jumps.
4. Avoid overloading same key with conflicting semantics across modes.
5. Fallbacks (arrows) never overshadow primary Vim-style keys.

## 13. Change Log

Edits welcome; propose changes via spec discussion before implementation.
