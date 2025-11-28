# Keyboard Reference

Status / Scope / Out of scope / See also
- Status: v0.11 (living document)
- Scope: Canonical source for all key bindings, per‑mode behavior, overlays, reserved combinations.
- Out of scope: Scroll math and behavior details (see scroll_positioning_spec.md); full UI layout rationale (see ui_layout.md).
- See also: ARCHITECTURE.md (Glossary), ui_view_reading_behaviour.md, scroll_positioning_spec.md.

Canonical source for all key bindings, per-mode behavior, overlays, and reserved combinations. Updated alongside implementation.

## 0. Modal Windows & Mode Restoration (Unified Spec)
All modal overlays restore the exact mode active at the moment they were opened. Implemented via a shared `openModal` helper (captures prevMode, focus-traps, swallows close keys, restores mode).

Exception (by design): Re-ask overlay (VIEW → model pick for in-place re-ask) does not restore the previous mode on confirm; it keeps INPUT mode active until the response arrives to match the standard send flow and alignment rules.

Covered overlays:
1. Topic Editor (Ctrl+E)
2. Model Editor (Ctrl+Shift+M)
3. Model Selector (Ctrl+M – INPUT only by design)
4. API Keys Overlay (Ctrl+; or menu, or auto-open on missing/invalid key)
5. Help Overlay (F1)
6. Settings Overlay (Ctrl+,)
7. Topic Quick Picker (Ctrl+T: VIEW/INPUT only per spec)
8. Sources Overlay (Ctrl+Shift+S: VIEW only)
9. Re-ask Overlay (VIEW only; exception: does not restore mode on confirm)

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
| Ctrl+T | Open topic quick picker (VIEW: reassign active pair topic, INPUT: set pending topic) | Full topic tree overlay (restores prev mode) |
| Ctrl+P | Open chrono topic picker (VIEW/INPUT: quick access to recent topics) | Recent topics list overlay (restores prev mode) |
| Ctrl+Shift+T | Open topic editor | Overlay (Edit) (restores prev mode) |
| Ctrl+; | Open API Keys overlay | Overlay (Edit) (restores prev mode) |
| Ctrl+M | Open model selector (INPUT mode only; chooses pending message model) | Overlay (Selection) (restores prev mode) |
| Ctrl+Shift+M | Open model editor (all modes) | Enable/disable models (j/k move · Space toggle · Enter/Esc close) (restores prev mode) |
| Ctrl+Shift+R | Open PDF export settings | Export filtered history to PDF (restores prev mode) |
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
| u | Jump to previous message | Aligns message to top of viewport |
| d | Jump to next message | Aligns message to top of viewport |
| U | Scroll current message to top | No navigation, stays on current message |
| g | Jump to first part | Single press |
| G | Jump to last part | Shift+g |
| o / Shift+O | Jump to first in‑context pair (boundary) and center it | One-shot center (does not enable the Typewriter Regime) |
| r | Toggle Typewriter Regime | Centers on each j/k; exits on g/G, send/reply, filter change |
| n | Jump to FIRST part of last message | Focuses first part; bottom-anchors end (last assistant or meta); clears badge |
| e | Re-ask | Error message: copies text + attachments to input; on Send, old error pair is deleted and a new message is created at the end. Normal message: if it's the last in the filtered set (LFS), opens Re-ask overlay and replaces the assistant answer in-place; otherwise no-op. |
| w | Delete focused error message | Removes the error pair; focus moves to previous part |
| Shift+E | Restore previous answer | Swaps current assistant response with previously saved answer (from re-ask); re-extracts code/equations; aligns to bottom if it fits or top if it doesn't |
| c | Copy code block | Single block: copies immediately. Multiple blocks: wait for digit (c1, c2, c3...) |
| y | Copy equation (yank) | Single equation: copies LaTeX immediately. Multiple equations: wait for digit (y1, y2, y3...) |
| Y | Copy entire message (Shift+y) | Copies raw message text (user input or assistant response) from data model |
| v | View code in overlay | Single block: opens immediately. Multiple blocks: wait for digit (v1, v2, v3...) |
| m | View equation in overlay | Single equation: opens immediately. Multiple equations: wait for digit (m1, m2, m3...) |
| l | Show link hints in active assistant message | Displays ephemeral numeric badges on links; 1–9 opens link in new tab; Esc cancels |
| Ctrl+Shift+S | Open Sources overlay for active assistant message | Shows sources (citations); j/k move focus between links; Enter opens; c copies all URLs; Esc / outside click closes |
| i | Open image overlay for active user message | Views attached images; j/k navigate; digits 1-9 jump to Nth image; Esc closes |
| * | Cycle star (0→1→2→3→0) | Affects active pair |
| 1 / 2 / 3 | Set star to 1 / 2 / 3 | Direct rating |
| Space | Set star to 0 | Clear rating |
| a | Toggle color flag (blue↔grey) | Updates flag badge |
| Enter | Switch to INPUT mode | Focus bottom input |
| Escape | Switch to COMMAND mode | Focus top command input |

**Note:** Digit keys (1-9) have context-dependent behavior:
- After `c` press: Copy code block N
- After `y` press: Copy equation N  
- After `v` press: View code block N in overlay
- After `m` press: View equation N in overlay
- After `l` press: Open link N in new tab (link hints mode)
- After `i` press: Jump to image N in overlay
- Without prefix: Set star rating (1/2/3 only)
- Pending state clears after 3 seconds or unrelated keypress

**Note:** Chrono Topic Picker (Ctrl+P) displays 6 items (1 current + 5 previous), scrollable for older history (up to 20 stored).

## 4. INPUT Mode Keys
| Key | Action | Notes |
|-----|--------|-------|
| Enter | Send message & remain in INPUT | Ignored if previous send pending ("AI is thinking") |
| Ctrl+C | Cancel pending request | Aborts in-flight AI request; shows abort error |
| Escape | Return to VIEW | Restores active selection |
| Ctrl+v / Ctrl+d / Ctrl+i | Direct mode switch | Overrides cycle |
| Ctrl+P | Open chrono topic picker | Quick access to recent topics; sets pending topic for next message |
| Ctrl+F | Open file picker for image attachment | Attach images to draft message (up to 4 images, 30MB total) |
| Cmd+V / Ctrl+V | Paste images from clipboard | Attach copied images to draft message |
| Ctrl+Shift+O | Open draft image overlay | View/remove attached images before sending; j/k navigate; digits 1-9 jump; Delete/x remove current |
| Ctrl+A | Move cursor to start of line | Emacs-style editing |
| Ctrl+E | Move cursor to end of line | Emacs-style editing |
| Ctrl+U | Delete from line start to cursor | Emacs-style editing |
| Ctrl+W | Delete previous word | Emacs-style editing |
| Ctrl+Shift+F | Move cursor forward one word | Emacs-style editing |
| Ctrl+Shift+B | Move cursor backward one word | Emacs-style editing |

(Star / include keys intentionally disabled while typing to avoid accidental edits. Future: enable when input empty.)

## 5. COMMAND Mode Keys
| Key | Action | Notes |
|-----|--------|-------|
| Enter | Apply current filter (including empty) → VIEW | Rebuilds history; keep focused if still present else focus last; bottom-anchor focused |
| Escape | Clear filter input (no apply) | No rebuild; stays COMMAND; same as Ctrl‑U |
| Ctrl+P | Previous command in history | Persistent (survives reload, max 100) |
| Ctrl+N | Next command in history | Clears to empty at end |
| Ctrl+v / Ctrl+i / Ctrl+d | Direct mode switch | |
| Ctrl+A | Move cursor to start of line | Emacs-style editing |
| Ctrl+E | Move cursor to end of line | Emacs-style editing |
| Ctrl+U | Delete from line start to cursor | Emacs-style editing |
| Ctrl+W | Delete previous word | Emacs-style editing |
| Ctrl+Shift+F | Move cursor forward one word | Emacs-style editing |
| Ctrl+Shift+B | Move cursor backward one word | Emacs-style editing |

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
| O | Anywhere | Toggle ordering mode: Manual ↔ Recent (persists) |

## 7. Topic Editor (Ctrl+Shift+T)
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
| O | Anywhere | Toggle ordering mode: Manual ↔ Recent (persists) |
| Shift+J | Tree (Manual mode) | Move topic down among siblings |
| Shift+K | Tree (Manual mode) | Move topic up among siblings |

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

See also: scroll_positioning_spec.md (Core flows §4, §5–§9). Edits welcome; propose changes via spec discussion before implementation.
