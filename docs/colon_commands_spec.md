# Colon Commands Specification (M22 – part 2)

Status: Implemented
Scope: Colon commands in the shared input act on the currently filtered set. Phase 1 commands: `export`, `tchange`.
See also: `docs/cli_filtering_language.md` (Filtering Language) — both documents cross-reference each other.

## Summary

Colon commands enable actions over the filtered message set using a vim‑like grammar in the same input box.

- Filter‑only: `<filter>`
- Filter + Command: `<filter> :<command> [args] [--flags]`

Examples
- `t + r10 :export`
- `t'AI...' :tchange`  (change topic of all filtered pairs to the current topic selected in the input bar)

## Parsing and Evaluation Pipeline

1) Split input into filter and command
- Find the first colon that is outside quotes and parentheses (respects escapes). Optional whitespace around the colon is allowed.
- Left side → filter string. Right side (without the leading `:`) → command string.

2) Parse filter
- Use the existing filter parser. On error, do not execute any command; show inline error and keep the input.

3) Evaluate filter → selection sets
- `baseIds`: result of the filter without applying `o`/`oN` (pre‑boundary projection)
- `boundary`: `{ includedIds, offContextOrder }` computed on the base set
- `finalIds`: result after applying `o` or `oN` (the on‑screen set)

4) Parse and execute command
- Command grammar: `name [positional args…] [--flag] [--flag=value]`
- Dispatch via a command registry. On parse/validation errors, show concise usage.

## Selection Semantics for Commands
- Default target: `finalIds` (WYSIWYG: “what you see is what you act on”).
- Optional flag: `--base` forces operation on `baseIds` instead.
- `boundary` is available to commands that need it.

## Command Runtime Architecture
- Registry entry: `{ name, aliases?, argSchema?, execute(ctx, args) }`
- Command context (`ctx`):
  - `store`: batch mutation helpers, index refresh
  - `selection`: `{ baseIds, finalIds, boundary }`
  - `environment`: `currentTopic`, `currentModel`, `settings`
  - `ui`: `notify/info/warn/confirm` (non‑blocking), optional progress HUD
  - `utils`: `topicResolver`, `exporter`
- Safety/UX:
  - Read‑only commands run immediately
  - Mutating commands confirm for large selections (threshold T, e.g., 50); support `--no-confirm`
  - `--dry-run` shows counts and a small sample without mutating
  - Success toasts with counts; after execution the input retains only the filter
  - Confirm overlays use the standard overlay classes so `modalIsActive()` detects them

## Commands

### export
Purpose: Download the selected pairs and metadata.

Syntax
- `:export [json|md|txt] [--filename "name"] [--base]`

Defaults
- `format=json`, `target=finalIds`, filename auto‑derived: `export-<topic|-all>-<model|-any>-<YYYYMMDD-HHMMSS>.json`

Behavior
- JSON content includes:
  - `pairs`: `[{ id, timestampUser, timestampAssistant, topicPath, topicId, model, stars, flagColor, userText, assistantText, errorState }]`
  - `meta`: `{ generatedAt, filterInput, count }`
- md/txt: minimal readable export (may be added later)

Examples
- `t + r10 :export`
- `(s>=2 & o5) :export --filename "important.json"`

### tchange
Purpose: Bulk change topic for the selected pairs.

Syntax
- `:tchange`                  → change to the current topic from the input bar
- `:tchange "AI > Planning"` → change to an explicit topic path/name

Flags
- `--base` (operate on baseIds), `--no-confirm`, `--dry-run`

Behavior
- Determine target topic: if no arg, use current topic from input bar; otherwise resolve via `topicResolver` (path or name)
- Confirm for large N unless `--no-confirm`; show count and target topic
- Perform a batch mutation, refresh indexes once, trigger selective re‑render

Examples
- `t'AI...' :tchange`
- `t'*Neural*' :tchange "AI > Planning" --dry-run`

## Errors and Validation
- Filter parse errors: show inline; do not run command.
- Command parse/arity errors: show usage for that command.
- Topic resolution: if ambiguous/not found, show suggestions and require exact choice.
- Execute errors: typed and user‑friendly; selection remains unchanged.

## Performance and Integrity
- Batch store updates; one index refresh.
- Chunk very large edits internally to avoid UI stalls (yield to event loop) without breaking logical atomicity.
- Reuse selective re‑render policy.

## Cross‑References
- Filtering Language: see `docs/cli_filtering_language.md` for the filter grammar including `o`/`oN` boundary projection.
- Architecture map: `docs/ARCHITECTURE.md` lists the colon command modules and integration points.
