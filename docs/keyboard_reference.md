# Keyboard Reference

Status: v0.1 (living document)

Canonical source for all key bindings, per-mode behavior, and reserved combinations. Updated alongside implementation.

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
| Ctrl+T | Open topic selector (VIEW: active pair + set currentTopic / INPUT: pending topic) | Overlay |
| Ctrl+M | Open model selector (INPUT only) | Overlay |

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
| Escape | Return to VIEW | Restores active part selection |
| Ctrl+v / Ctrl+d / Ctrl+i | Direct mode switch | Overrides cycle |

(Deliberately NOT enabling * / a / number star keys here yet to avoid accidental metadata edits while typing. Future: allow when input empty.)

## 5. COMMAND Mode Keys
| Key | Action | Notes |
|-----|--------|-------|
| Enter | Parse + apply filter, then go to VIEW | Shows filtered subset |
| Escape | Clear filter (if any), stay COMMAND | Restores full history |
| Ctrl+v / Ctrl+i / Ctrl+d | Direct mode switch | |

## 6. Navigation Semantics
- Active Part: exactly one part is active; movement changes only index, not selection state inside text.
- Auto-Scroll: After movement, active part is scrolled into view (center bias; may adjust later to top-third rule).
- Pair Association: Star/include actions operate on the whole pair containing the active part (regardless of user, assistant, or meta part chosen).

## 7. Metadata Editing
Current shortcuts (*, a) are VIEW-only. Rationale: avoid conflicts while typing prompt or command lines. Potential future behavior: enable in INPUT when input field is empty or behind a meta-edit prefix.

## 8. Reserved / Future Keys
| Keys | Planned Purpose | Status |
|------|------------------|--------|
| Ctrl+u / Ctrl+d | Half-page up/down | Planned |
| Ctrl+T | Topic selector | Implemented |
| Ctrl+M | Model selector | Implemented |
| ? | Help / cheat sheet overlay | Planned |
| t | Topic palette overlay | Planned |
| p | Context preview overlay | Planned |
| / | Inline search (maybe) | TBD |
| Shift+* variations | Direct star set | TBD |

## 9. Extension Interference
Extensions like Vimium may intercept j/k. Users should exclude the site to retain primary Vim-style navigation. Arrow keys exist as a fallback only. We intentionally do not consume Ctrl+j / Ctrl+k so they remain available for future features.

## 10. Design Principles Recap for Keys
1. Primary keys (j/k, g/G) must remain frictionless (no modifiers).
2. Core mode cycle uses Enter/Escape to minimize mnemonic burden.
3. Direct Ctrl+<mode-initial> shortcuts provide muscle memory bypass.
4. Avoid overloading same key across modes with different destructive behaviors.
5. Fallbacks (arrows) never displace primaries visually or conceptually.

## 11. Change Log
- v0.2: Implemented topic (Ctrl+T) & model (Ctrl+M) selectors; replaced gg with g; numeric star keys (1/2/3) + Space clear.
- v0.1: Initial extraction from `ui_layout.md`; added mode cycle, direct shortcuts, current & future sets.

---
Edits welcome; propose changes via PR or spec discussion before implementation.
