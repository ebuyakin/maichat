# Keyboard Reference

Status: v0.4 (living document)

Canonical source for all key bindings, per-mode behavior, overlays, and reserved combinations. Updated alongside implementation.

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
| Ctrl+T | Open topic quick picker (VIEW: reassign active pair topic, INPUT: set pending topic) | Overlay (Selection) |
| Ctrl+M | Open model selector (INPUT only) | Overlay |
| Ctrl+E | Open topic editor | Overlay (Edit) |

## 3. VIEW Mode Keys
| Key | Action | Remarks |
|-----|--------|---------|
| j | Next part | Primary navigation |
| k | Previous part | Primary navigation |
| ArrowDown | Next part | Secondary fallback |
| ArrowUp | Previous part | Secondary fallback |
| g | Jump to first part | Single press |
| G | Jump to last part | Shift+g |
| * | Cycle star (0→1→2→3→0) | Affects active pair |
| 1 / 2 / 3 | Set star to 1 / 2 / 3 | Direct rating |
| Space | Set star to 0 | Clear rating |
| a | Toggle includeInContext | Updates badge |
| Enter | Switch to INPUT mode | Focus bottom input |
| Escape | Switch to COMMAND mode | Focus top command input |

## 4. INPUT Mode Keys
| Key | Action | Notes |
|-----|--------|-------|
| Enter | Send message & remain in INPUT | Active part moves to new last part |
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
| h / ArrowLeft | Tree | Collapse or go to parent |
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
- Auto-Scroll: Active part scrolled into view after movement.
- Pair Association: Star / include act on the entire pair.

## 9. Metadata Editing
Current shortcuts (*, a) are VIEW-only to prevent accidental edits while typing. Potential future: enable when input empty.

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
- v0.4: Hidden root topic; hierarchical quick picker; Topic Editor adds top-level creation (N) and updated help; path-based search & display.
- v0.3: Topic Editor focus model (Shift+J tree focus; Esc layering); mark/paste m/p; delete confirm; global key router modal suppression.
- v0.2: Topic (Ctrl+T) & model (Ctrl+M) selectors; replaced gg with g; numeric star keys (1/2/3) + Space clear.
- v0.1: Initial extraction from `ui_layout.md`; mode cycle, direct shortcuts, initial sets.

---
Edits welcome; propose changes via spec discussion before implementation.
