# Colon Commands Spec (M22 – part 2)

Status: Draft (awaiting approval)
Scope: Introduce colon commands in the shared input, acting on the filtered set. Ship two commands now: export, tchange.
See also: docs/cli_filtering_language.md, docs/plan.md, docs/dev-notes.md

## Summary

Enable actions over the currently filtered message set using vim-like colon commands in the same input box.

- Filter-only: <filter>
- Filter + Command: <filter> :<command> [args] [--flags]

Examples
- t + r10 :export -json
- t'AI...' :tchange  (change topic of all filtered pairs to the current topic selected in the input bar)

## Goals
- One keyboard-first input for both filtering and actions
- Preserve mental model: filters define “what you see”; commands act on “what you see”
- Minimal grammar, safe defaults, predictable UX, and testable runtime

## Parsing and evaluation pipeline

1) Split input into filter and command
- Find the first colon that is OUTSIDE quotes and parentheses (respect escapes). Optional whitespace around the colon is allowed.
- Left side → filter string. Right side (without the leading ":") → command string.

2) Parse filter
- Use the existing filter parser. On error, do not execute any command; show inline error and keep the input.

3) Evaluate filter → selection sets
- baseIds: result of the filter without applying o/oN (pre-boundary projection)
- boundary: { includedIds, offContextOrder } computed on the base set
- finalIds: result after applying o or oN (the on-screen set)

4) Parse and execute command
- Command grammar: name [positional args...] [--flag] [--flag=value] [-s]
- Dispatch by a command registry. On parse/validation errors, show concise usage.

## Selection semantics for commands
- Default target: finalIds (WYSIWYG: “what you see is what you act on”)
- Optional flag: --base forces operation on baseIds instead
- boundary is available to commands that need it (not required for export/tchange)

## Command runtime architecture
- Registry entry: { name, aliases?, argSchema, execute(ctx, args) }
- Command context (ctx):
  - store: batch mutation helpers, index refresh
  - selection: { baseIds, finalIds, boundary }
  - environment: currentTopic, currentModel, settings
  - ui: notify/info/warn/confirm (non-blocking), optional progress HUD
  - utils: topicResolver, exporter
- Safety/UX:
  - Read-only commands run immediately
  - Mutating commands confirm for large selections (threshold T, e.g., 50), support --no-confirm
  - --dry-run shows counts and a small sample without mutating
  - Success toasts with counts; clear input after success

## Commands (phase 1)

### export
Purpose: Download the selected pairs and metadata.

Syntax
- :export [json|md|txt] [--filename "name"] [--base]

Defaults
- format=json, target=finalIds, filename auto-derived: export-<topic|-all>-<model|-any>-<YYYYMMDD-HHMMSS>.json

Behavior
- json content includes:
  - pairs: [{ id, timestampUser, timestampAssistant, topicPath, topicId, model, stars, flagColor, userText, assistantText, errorState }]
  - meta: { generatedAt, filterInput, count }
- md/txt: minimal readable export (optional; can defer to M23)

Examples
- t + r10 :export -json
- (s>=2 & o5) :export md --filename "important.md"

### tchange
Purpose: Bulk change topic for the selected pairs.

Syntax
- :tchange                  → change to the current topic from the input bar
- :tchange "AI > Planning"  → change to an explicit topic path/name (optional this milestone)

Flags
- --base (operate on baseIds), --no-confirm, --dry-run

Behavior
- Determine target topic: if no arg, use current topic from input bar; otherwise resolve via topicResolver (path or name)
- Confirm for large N unless --no-confirm; show count and target topic
- Perform a single batch mutation, refresh indexes once, trigger selective re-render

Examples
- t'AI...' :tchange
- t'*Neural*' :tchange "AI > Planning" --dry-run

## Errors and validation
- Filter parse errors: show inline; do not run command
- Command parse/arity: show usage for that command
- Topic resolution: if ambiguous/not found, show suggestions and require exact choice
- Execute errors: typed and user-friendly; selection remains unchanged

## Performance and integrity
- Batch store updates; one index refresh
- Chunk very large edits internally to avoid UI stalls (yield to event loop) without breaking logical atomicity
- Reuse selective re-render policy

## Action items (implementation plan)
1) Input splitter: colon-aware, outside quotes/parens
2) Command parser: minimal, with arg/flag validation
3) Command registry + context scaffolding
4) Utilities: topicResolver, exporter (json first)
5) Implement export (json; md/txt optional) and tchange
6) UX: large-N confirmation; notifications; --dry-run
7) Tests: splitter, command parser, tchange batch mutation and indexing, export json content
8) Docs: link from cli_filtering_language.md to this spec (short “Colon commands” section)

## Acceptance criteria
- <filter> :<command> flow works; correct split and error handling
- :export outputs correct JSON for finalIds; honors --base
- :tchange updates topics in one batch with confirmation and re-render
- Unit tests added and passing; no regressions in existing suite
- Docs updated; spec reflects actual behavior

## Out of scope (this milestone)
- Destructive commands (e.g., :delete) and undo/redo (design can be prepared)
- Rich export beyond minimal md/txt

## Open questions
- Should we include explicit topic arg support for :tchange in this milestone or follow-up? (Default: include both forms.)
- Large-N confirm threshold T default (proposal: 50)
- Default export format beyond JSON (proposal: JSON only in M22)
