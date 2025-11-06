# Assistant Message Styling — Implementation Summary (Completed)

Status: Implemented (production)
Scope: Assistant message body formatting (text flow, lists, inline code, headings)

## User-facing controls (Settings → Reading)
- Two Columns (Assistant Text) — key: `twoColumns` (default: off)
- Justify Text (Two Columns) — key: `justifyColumns` (default: off)

Notes
- Justification is meaningful primarily with two columns; when left aligned, headings/code/tables remain left-aligned regardless.
- Inline code is a production default (no setting) and now visually harmonizes with body text.

## Final behavior
1) Multi-column layout
- `.assistant-body` uses CSS variables for layout:
  - `column-count: var(--assistant-columns, 1)`
  - `text-align: var(--assistant-text-align, left)`
- Split policy: paragraphs may split; lists can span columns; individual `li`, code blocks, tables, display math avoid splitting.
- List indentation adjusts in columns mode with CSS variables.

2) Inline code styling (production default)
- Inline code uses UI font with inherited weight for visual consistency, highlighted via dimmed green:
  - `font-family: var(--font-ui); font-weight: inherit`
  - `color: color-mix(in srgb, #85db87 65%, var(--text) 35%)` with `#85db87` fallback
- Code blocks remain monospace and keep their original color/structure.

3) Headings weight
- `.assistant-body h1..h6 { font-weight: var(--font-w-strong) }` so headings respect user weight settings.

## Design patterns used
- Single source of truth for settings: `src/core/settings/schema.js`
  - New keys: `twoColumns`, `justifyColumns` (renderAction: `restyle`, tab: `reading`)
- Restyle pipeline: `subscribeSettings` → `applySpacingStyles(settings)` → CSS variables update → browser reflow
- CSS variable gating instead of DOM class reshaping
  - Variables set in `spacingStyles.js`: `--assistant-columns`, `--assistant-text-align`, and list padding vars
  - Read by `src/styles/components/history.css` on `.assistant-body`
- String-time rendering preserved
  - We still build one big HTML string per render; no DOM-time mutations for layout/styling

## Files changed (summary)
- Settings
  - `src/core/settings/schema.js` — added `twoColumns`, `justifyColumns`
  - `src/features/config/settingsOverlay.js` — read/write new checkboxes; populate on open/reset
- Application of styles
  - `src/features/history/spacingStyles.js` — sets CSS variables based on settings
  - `src/styles/components/history.css` — variable-driven columns/justify + list indentation; structured blocks left-aligned
  - `src/features/formatting/formatting.css` — inline code default (UI font, inherited weight, dimmed green); blocks monospace
- Cleanup
  - `src/main.js` — removed experimental URL flags
  - `src/features/history/historyView.js` — removed experimental class glue; `assistant-body` markup simplified

## Performance & isolation
- Performance
  - Columns/justify are CSS-only; changes flow through the existing `restyle` path (no rebuild)
  - Inline code remains outside Prism; blocks still string-time highlighted; math rendering unchanged
- Isolation
  - Changes are limited to assistant-body styling and settings plumbing; no data model or pipeline changes; easy rollback by toggling the two settings or reverting the CSS blocks

## Side effects and mitigations
- Message height may shrink with two columns; our stateless alignment remeasures after restyle
- Justification can produce “rivers” in some cases; it’s optional and user-togglable
- Hyphenation is enabled to smooth justified text; copy/paste unaffected

## Removal of experimental paths
- URL flags (`?columns`, `?justify`, `?inlinecode`/`?ic`) and associated globals/classes were removed
- All behavior is now settings-driven; no DOM class toggles are required for layout

## Quick verification checklist
- Reading → toggle Two Columns/Justify → Save & Close → layout updates and persists on reload
- Inline code uses UI font, inherits body weight, and dims with text; code blocks remain monospace
- Headings respond to `fontWeightStrong` changes

