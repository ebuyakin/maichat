# Keyboard Reference

Status: v0.6 (living document)

Canonical source for all key bindings, per-mode behavior, overlays, and reserved combinations. Updated alongside implementation.

## 0. Modal Windows & Mode Restoration (Unified Spec)
All modal overlays MUST restore the exact mode active at the moment they were opened. Target set (v0.10 spec):
1. Topic Editor (Ctrl+E)
2. Model Editor (Ctrl+Shift+M)
3. API Keys Overlay (auto, menu, or future shortcut)
4. Help Overlay (F1)
5. Settings Overlay (Ctrl+,)
6. Menu (Ctrl+.)
7. Topic Quick Picker (Ctrl+T)

Current State Snapshot (implementation audit):
- Topic Editor: captures & restores mode (caller wraps with prevMode).
- Model Editor: captures & restores mode (caller wraps with prevMode).
- Model Selector (Ctrl+M, INPUT-only): restores mode (caller wraps with prevMode); only openable in INPUT mode by design.
- API Keys: menu & manual open paths restore mode; auto-open on missing/invalid key DOES NOT yet restore previous mode (opened during send sequence while in INPUT; after close user currently remains in INPUT implicitly — acceptable but still should explicitly restore).
- Help (F1): restores mode (caller wraps with prevMode).
- Settings (Ctrl+,): restores mode (caller wraps with prevMode).
- Menu (Ctrl+.): restores mode (prevMode captured inside toggleMenu/runMenuAction implementation) – verify after any refactor.
- Topic Quick Picker (Ctrl+T): now attempts restoration; regression under investigation (observed fallback to COMMAND). Root cause hypothesis: an Enter/Escape key event propagates to keyRouter after overlay teardown, triggering default mode transitions (Enter→INPUT / Escape→COMMAND) before restoration executes OR restoration executes first then a late key event re-triggers transition. Mitigation plan: consume (stopImmediatePropagation) triggering key inside overlay before teardown, OR set a transient suppression flag for next keydown cycle.

Specification Reinforcement:
- Overlay close handlers must: (a) remove event listeners, (b) restore focus to previously focused element iff that element still in DOM, (c) synchronously call modeManager.set(prevMode) BEFORE allowing event to bubble.
- All overlay keyboard handlers must prevent default + stop propagation for their close/confirm keys (Enter / Escape) so global keyRouter never sees them.

Action Items:
- [ ] Add propagation suppression to Topic Picker Enter/Escape.
- [ ] Add explicit prevMode restoration to auto-open API Keys path (missing key / auth failure) for consistency.
- [ ] Introduce shared helper openWithModeRestore(fn) to wrap overlays (DRY) – reduces drift risk.
- [ ] Add unit test matrix: modes × overlay open/close -> same mode.

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
| Ctrl+T | Open topic quick picker (VIEW: reassign active pair topic, INPUT: set pending topic) | Overlay (Selection) (spec: restore prev mode) |
| Ctrl+M | Open model selector (INPUT mode only; chooses pending message model) | Overlay (Selection) (spec: restore prev mode) |
| Ctrl+Shift+M | Open model editor (all modes) | Enable/disable models (j/k move · Space toggle · Enter/Esc close) (spec: restore prev mode) |
| Ctrl+E | Open topic editor | Overlay (Edit) (spec: restore prev mode) |
| Ctrl+, | Open settings overlay | Adjust preferences (spec: restore prev mode) |
| Ctrl+. | Open menu | Menu navigation isolated; spec: restore prev mode |
| F1 | Help overlay | Esc / F1 close; spec: restore prev mode |

## 3. VIEW Mode Keys
| Key | Action | Remarks |
|-----|--------|---------|
| j | Next part | Primary navigation |
| k | Previous part | Primary navigation |
| ArrowDown | Next part | Secondary fallback |
| ArrowUp | Previous part | Secondary fallback |
| g | Jump to first part | Single press |
| G | Jump to last part | Shift+g |
| Shift+R | Cycle reading position (Bottom → Center → Top → Bottom) | Implemented anchorMode cycle |
| n | Jump to FIRST part of last message | Clears new-message badge; re-anchors even if already there |
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

(Star / include keys intentionally disabled while typing to avoid accidental edits. Future: enable when input empty.)

## 5. COMMAND Mode Keys
| Key | Action | Notes |
|-----|--------|-------|
| Enter | Parse + apply filter, then go to VIEW | Shows filtered subset |
| Escape | Clear filter (if any), stay COMMAND | Restores full history |
| Ctrl+v / Ctrl+i / Ctrl+d | Direct mode switch | |

## 6. Topic Quick Picker (Ctrl+T)
Hidden root: the conceptual root node is not displayed; top-level rows are its children.
| Key | Context | Action |
|-----|---------|--------|
| (typing) | Search field | Filter topics by name or any ancestor path substring |
| Shift+J | Search field | Move focus into tree |
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
| Shift+J | Search | Focus tree |
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

Notes:
- Marked + Paste updates counts and prevents cycles; root cannot be marked.
- Top-level creation (N) ensures consistent indentation (depth 0).

## 8. Navigation Semantics
- Active Part: exactly one part is active; movement changes only index.
- Auto-Scroll & Anchoring: Active part aligned to user-selected reading position (Bottom default) using spacer logic; meta row is never focusable.
- Pair Association: Star / include act on the entire pair.
- Meta Row: Visible but skipped in navigation; edits apply based on active part's pair.
- 'n' vs 'G': 'n' = first part of last message; 'G' = last part of last message.
- New reply auto-focus only if user remained at end (no navigation since send); otherwise badge appears.

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
- v0.9: Model selector limited to INPUT mode; model editor (Ctrl+Shift+M) available in all modes (j/k move, Space toggle, Enter/Esc close); Enter removed as toggle.
- v0.8: Settings overlay unified keyboard model (j/k navigation, +/- numeric adjust with large Shift step, Space cycles selects, Enter apply w/out close, Esc cancel, persistent 'Saved' label until dirty).
- v0.7: Implemented Shift+R anchor cycle; dev reseed helper (Ctrl+Shift+S) for partition testing; forced smaller part size for testing.
- v0.6: New message behavior (single pending send), 'n' key (first part of last message), Enter blocked during pending, badge logic.
- v0.5: Settings overlay (Ctrl+,); meta row declared non-focusable; anchoring model (Bottom/Center/Top) + Shift+R cycle; clarified navigation semantics.
- v0.4: Hidden root topic; hierarchical quick picker; Topic Editor adds top-level creation (N) and updated help; path-based search & display.
- v0.3: Topic Editor focus model (Shift+J tree focus; Esc layering); mark/paste m/p; delete confirm; global key router modal suppression.
- v0.2: Topic (Ctrl+T) & model (Ctrl+M) selectors; replaced gg with g; numeric star keys (1/2/3) + Space clear.
- v0.1: Initial extraction from `ui_layout.md`; mode cycle, direct shortcuts, initial sets.

---
Edits welcome; propose changes via spec discussion before implementation.
