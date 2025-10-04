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



## Appendix UX in filtering and command application:

### command line filtering UX and scenarios:
To avoid misunderstanding/confusion: command/filter line, command/filter input box - all refer to the control element that is used to type and apply the filter/commands. line/box - are generally used interchangeably.
Apply filter / execute command - actually means to execute whatever command is supposed to be executed. The most standard case is the execution is just filtering/refresh of the message history.

1. Message history reflects the filter displayed in the filter/command line (top zone)
2. Filter/command can be changed only in the command mode. When command mode is activated (by Esc from the view mode or via Ctrl-Dk) the command/filter input box gets focus automatically.

3. When the command/filter box is active:
- Esc clears the filter (but doesn't apply it)
- Enter applies the filter (only Enter key applies the filter) and switch to View mode.
- Ctrl-W - delete the last word in the command line
- Ctrl-U - delete all text in the command line (same as Esc)


Command/filter history:
- when the filter/command is applied (by pressing Enter) the command that has been applied is stored in localHistory and can be re-used later by the user (convenience to avoid re-typing the same command). NB the command is only stored when it's applied (not any typed text is stored).

- Ctrl-P - replaces the current content of the command/filter line (but doesn't apply filter until Enter)
- Ctrl-N - replaces the current content of the command line with the next filter in history.

Some typicals key secquences:
Starting from the view mode with no filter applied:
1. Esc (go to command mode, focus on command line)
2. 'r10' (for example) - type some filter
3. Enter - applie typed filter and switch to  View mode.
.... do something in view or input mode
4. Esc - back to command mode (focus on command line)
5. Esc or Ctrl-U - delete the existing filter
6. 's2' - type new filter
7. Enter - apply new filter


or another scenario:
5. Ctrl-P - replaces 'r10' with the previous filter from the history (say 'd<5')
6. Enter - apply 'd<5'
7. Ctrl-P - replaces 'd<5' with 'r10' (as it's now previous filter)
8. Ctrl-N - replaces 'r10' with 'd<5' (as it's the next filter in the history)
9. Esc - clear filter again
10. Enter - apply empty filter and switch to view mode (ie get the whole message history).



