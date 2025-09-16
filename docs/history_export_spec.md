# History Export Specification (M23)

Status: Draft (awaiting approval)
Scope: Export the currently filtered message history via `:export` — JSON (`json`, default), Markdown (`md`), and Plain Text (`txt`). CSV is explicitly out of scope for this milestone.
See also: `docs/plan.md` (M23), `docs/colon_commands_spec.md` (command grammar and selection semantics), `docs/cli_filtering_language.md` (filter pipeline and `o/oN`).

## Summary

Enable users to download the current selection (“what you see”) as JSON (default), Markdown, or Plain Text using `:export`. Preserve ordering by default, include a small metadata header (or meta fields in JSON).

- Entry: `<filter> :export [json|md|txt] [--filename "..."] [--order time|topic]`
- Default selection: WYSIWYG — the exported set equals the filtered set shown on screen.
- File naming: `export_chat-<YYYYMMDD-HHMMSS>.<ext>`

## Design decisions

### Selection semantics
- WYSIWYG: whatever is filtered is exported.
- Ordering is applied after selection.

### Ordering
- Two supported orders:
  - `time` (default): same as on screen (chronological; filters do not change ordering).
  - `topic`: group and order pairs by the logical topic tree order; within each topic group, maintain chronological order.

### Metadata inclusion
- Include a small metadata header at the top to make exports self‑describing and traceable.
- Recommended fields (when available):
  - `generatedAt` (ISO 8601, UTC)
  - `app` (e.g., `MaiChat vX.Y.Z`) — optional if version is known
  - `filterInput` (original input string)
  - `count`: number of exported pairs

### Timestamps and locale
- Use ISO 8601 UTC in metadata. In per‑pair headings, display a concise local date/time for readability.
- In JSON pair objects, `createdAt` is ISO 8601 and preserves the original timezone when known; otherwise emit UTC (`Z`).

### Off‑context distinction
- Not applicable for export. Exports do not distinguish or annotate in‑context vs off‑context items.

## Format specifications

### JSON (`.json`) — default

Overall shape
- A single top‑level object with meta fields and a `pairs` array.
- Pretty‑printed with two‑space indentation for readability.

Top‑level fields
- `schemaVersion`: string (e.g., `"1"`) — bump on breaking changes to the export shape
- `app`: optional string (e.g., `"MaiChat v0.4.1"`)
- `generatedAt`: ISO 8601 UTC timestamp
- `filterInput`: the original input string used (including any `:export` suffix)
- `orderApplied`: `"time" | "topic"`
- `count`: number — total pairs in `pairs`
- `pairs`: array of pair objects (see below)

Pair object fields
- `id`: string
- `createdAt`: ISO 8601 string — pair timestamp (original timezone preserved when available; otherwise UTC)
- `topicPath`: string — human‑readable path (e.g., `"AI > Planning"`)
- `topicId`: string — stable abstract identifier (UUID or `"root"`); does not change on rename or move
- `model`: string
- `stars`: number (0–3)
- `flagColor`: `"blue" | "grey"`
- `userText`: string — verbatim
- `assistantText`: string — verbatim
- `errorState`: boolean — true if the assistant response errored
- `errorMessage`: optional string — present only when `errorState` is true
  (no special fields for in‑context/off‑context)

Note on topics
- `topicId` is a stable identifier used internally for joins/imports. Renaming or moving a topic does not change its `id`.
- `topicPath` is derived at export time and may change over time as the tree structure or names evolve.

Example
```json
{
  "schemaVersion": "1",
  "app": "MaiChat v0.4.1",
  "generatedAt": "2025-09-16T10:11:12Z",
  "filterInput": "t'AI...' & o5 :export",
  "orderApplied": "time",
  "count": 2,
  "pairs": [
    {
      "id": "p_123",
      "createdAt": "2025-09-16T13:44:00+03:00",
      "topicPath": "AI > Planning",
      "topicId": "3a8b2f6e-1c9a-4e2c-9b17-0d5a3c7e2f10",
      "model": "gpt-4o",
      "stars": 2,
      "flagColor": "blue",
      "userText": "How should we structure the plan?",
      "assistantText": "Here is a proposed structure...",
      "errorState": false
    },
    {
      "id": "p_124",
      "createdAt": "2025-09-16T13:48:00+03:00",
      "topicPath": "AI > Planning",
      "topicId": "3a8b2f6e-1c9a-4e2c-9b17-0d5a3c7e2f10",
      "model": "gpt-4o",
      "stars": 1,
      "flagColor": "grey",
      "userText": "Follow‑up details...",
      "assistantText": "",
      "errorState": true,
      "errorMessage": "Timeout contacting provider"
    }
  ]
}
```

Encoding and MIME
- UTF‑8, LF newlines (`\n`). Suggested MIME: `application/json; charset=utf-8`.

Versioning
- Changes to field names or meanings will bump `schemaVersion`. Additive fields will not change the version.

### Markdown (`.md`)

Overall shape
- Header section: a fenced JSON meta block.
- One section per pair in order, using headings and fenced code blocks for message texts.

Header (example)
````
```json meta
{
  "generatedAt": "2025-09-16T10:11:12Z",
  "app": "MaiChat v0.4.1",
  "filterInput": "t'AI...' & o5 :export md --order topic",
  "orderApplied": "topic",
  "count": 12
}
```
````

Per pair
- Heading level 2 with ordinal, topic path, model, and local date/time.
- Optional inline meta: `Stars: N`, `Flag: blue/grey`.
- Two subsections: `### User` and `### Assistant`, each followed by a fenced code block containing verbatim text.
- If the assistant errored, annotate the heading line with `— error` and include the error message below Assistant (preceding the fenced block) as `> Error: ...`.

Example
````
## 7. AI > Planning — gpt-4o — 2025-09-16 13:45 (local)
Stars: 2 · Flag: blue

### User
```
User message text …
```

### Assistant
````
Assistant response …
````
````

Fences
- Use dynamic backtick fence length: detect the maximum run of backticks in the content of each block, and choose a fence length of `maxRun + 1` to avoid collisions. Default to triple backticks when unnecessary to extend.
- Language hint: omit or set to `text` to avoid unintended highlighting.

Encoding and MIME
- UTF‑8, LF newlines (`\n`). Suggested MIME: `text/markdown; charset=utf-8`.

### Plain Text (`.txt`)

Overall shape
- Header section: a compact textual meta block.
- One block per pair, separated by a line of dashes.

Header (example)
```
Meta:
  generatedAt: 2025-09-16T10:11:12Z
  app: MaiChat v0.4.1
  filterInput: t'AI...' & o5 :export txt --order time
  orderApplied: time
  count: 12

---
```

Per pair
- First line: `#<ordinal> <topic path> — <model> — <local date/time>` and append ` [error]` when applicable.
- Second line (optional): `Stars: N · Flag: blue/grey`.
- Message sections:
  - `[User]\n<text>\n`
  - `[Assistant]\n<text>\n`
- Separator: a line of 80 dashes between pairs.

Encoding and MIME
- UTF‑8, LF newlines (`\n`). Suggested MIME: `text/plain; charset=utf-8`.

## File naming
- Auto pattern: `export_chat-<YYYYMMDD-HHMMSS>.<ext>`.
- Respect `--filename` exactly when provided, without appending another extension.

## Non‑goals (M23)
- CSV, HTML, or PDF exports.
- Splitting by message parts (pairs remain the unit). A future `--parts` flag may revisit this.
- Advanced time zone controls (assume local display + ISO UTC in meta).

## Implementation outline
- Extend `:export` command to accept `md` and `txt`.
- Add `--order time|topic` flag and apply ordering after selection.
- Add pure serializers: `buildMarkdownExport({ pairs, meta })`, `buildTextExport({ pairs, meta })`.
- Reuse the existing download helper to save Blob URLs.
- Tests:
  - Meta block presence and correctness.
  - Fencing algorithm edge cases (content containing triple backticks and longer runs).
  - Error annotations appear as specified.
  - Ordering correctness for `time` vs `topic`.

## Acceptance criteria
- `:export md` and `:export txt` successfully download files with:
  - A metadata header, present and correct.
  - All selected pairs ordered according to `--order` (default `time`), with `[error]` annotations when applicable.
  - Verbatim message bodies (no content transformation beyond safe fencing).
- JSON export remains the default when no format is specified.
- Auto filenames follow the pattern; `--filename` overrides are respected.
- Unit tests for serializers are added; existing suite remains green.
