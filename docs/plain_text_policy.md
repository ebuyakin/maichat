# OUTDATED! NOT RELEVANT. IGNORE

# Plain Text Output Policy & Markdown Suppression Spec

Status / Scope / Out of scope / See also
- Status: Phase 1 + 1.1 Implemented (System instruction + sanitizer + soft‑wrap merge).
- Scope: System instruction, sanitizer rules, and token budget integration.
- Out of scope: Scroll/reading semantics, layout tokens, provider transport specifics.
- See also: ARCHITECTURE.md (Glossary), new_message_workflow.md (send pipeline), ui_view_reading_behaviour.md (partitioning policy).
Last updated: 2025-09-11
Scope: Isolated specification for enforcing plain-text assistant replies (no Markdown formatting) via a fixed system message + planned lightweight sanitizer.

## 1. Purpose
Ensure assistant responses display as clean plain text without Markdown structural noise (headings, bold markers, excessive blank spacing) while preserving numbered lists and code readability, with minimal runtime cost and zero impact on existing partitioning or context prediction logic.

## 2. Problem Statement
Observed issues (esp. with smaller / lighter models):
- Headings (e.g. `### Title`) introduce vertical bulk and fragment reading flow.
- Bold markers (`**term**`) add visual clutter when rendered as literal asterisks (no Markdown renderer is active)
- Excess blank paragraphs inflate scroll height and reduce information density.
- Model-specific compliance variance: larger models obey plain-text instructions more reliably; smaller ones leak Markdown.

We want a deterministic end-state independent of model style drift, without adopting a full Markdown parser or renderer.

## 3. Constraints & Non-Goals
Constraints:
- Do NOT split or modify numbered list semantics ("1. Step") – numbering is helpful.
- Keep implementation surgical: no broad architecture changes, minimal token estimator impact.
- Preserve raw semantic content (no paraphrasing, only formatting symbol removal / whitespace normalization).
- Avoid heavy parsing libraries (footprint & complexity).

Non-Goals (Phase 1):
- Full Markdown normalization or syntax highlighting.
- Table / block quote semantic reinterpretation.
- Complex code fence restructuring.
- User-configurable style policies.

## 4. Current State (Implemented)
- Fixed system instruction constant (`SYSTEM_INSTRUCTION`) prepended as first message (`role:'system'`) on every send.
- Token budgeting reserves its cost: `effectiveMaxContext = maxContext - systemTokens` used during history prediction; trimming loop never removes the system message.
- HUD shows the exact final JSON (system message included) under "RAW REQUEST JSON".
- Phase 1 sanitizer active: removes heading lines (≥ `###` + space), strips bold markers (`**..**`, `__..__`), trims trailing spaces, removes ALL blank lines (paragraph spacing now delegated to UI partitioning), preserves numbered list lines.
- Idempotent + safety fallback if everything would be stripped.

Soft-wrap Strategy 2 merge implemented: mid‑sentence single newlines merged when safe.

## 5. Goals (Phase 1 / 1.1)
1. Reduce Markdown artifacts (headings ≥ level 3, bold markers) — DONE.
2. Densify output by removing all blank lines (delegating vertical structure to partitioning) — DONE.
3. Preserve numbered list semantics — DONE.
4. Guarantee idempotent transformation with safety fallback — DONE.
5. Soft-wrap mid‑sentence newline merge (Strategy 2) — DONE.
6. Avoid altering future fenced code blocks (still deferred until needed).

## 6. System Instruction (Authoritative Text)
Embedded constant (pipeline layer):
```
STRICT FORMAT POLICY: Output ONLY plain text. NEVER use Markdown or any formatting characters (#, *, -, +, `, ``` , >, |, _, ~), no code fences, no inline backticks, no bulleted or numbered lists, no tables, no block quotes, no HTML, no JSON unless explicitly requested, no attachments, no images, no links unless explicitly requested. If code is required, indent each code line with four spaces; do NOT wrap code or add language labels. Replace any list you would normally produce with plain sentences separated by a single blank line. Ignore formatting in earlier assistant messages—always normalize to this plain style. Provide only the answer content: no preamble, no closing summary, no disclaimers.
```
(Note: Implementation still permits numbered steps; sanitizer will NOT remove them.)

## 7. Token Budget Integration
- `systemTokens = estimateTokens(SYSTEM_INSTRUCTION)` using existing `charsPerToken` heuristic.
- `effectiveMaxContext = max(0, maxContext - systemTokens)` is used in prediction loop inclusion test.
- Early guard: if `(userTokens + systemTokens) > maxContext` → `user_prompt_too_large` error.
- Trimming loop only shifts history pairs; system instruction never examined.

## 8. Sanitizer Specification
Execution point: Immediately before `store.updatePair(id, { assistantText: ... })` on successful response.

### 8.1 Contract
Input: raw model reply string `raw` (UTF-16 JS string).
Output: sanitized string `clean`.
Guarantees:
- Length may shrink; never expands more than trivial whitespace adjustments.
- If transformation would yield empty while original non-empty, fallback to original (safety guard).
- Idempotent: `sanitize(sanitize(raw)) === sanitize(raw)`.

### 8.2 Transformations (Current Order)
1. (Fence handling DEFERRED) Treat whole text uniformly.
2. Remove heading lines starting with ≥3 `#` followed by space: delete lines matching `/^#{3,}\s+.*$/`.
3. Strip bold markers:
  - `**text**` → `text` via `/\*\*(.*?)\*\*/g`
  - `__text__` → `text` via `/__(.*?)__/g`
4. Remove ALL blank (empty or whitespace-only) lines.
5. Trim trailing spaces on each remaining line.
6. Safety fallback: if result becomes empty while original had non-whitespace, revert to original.

### 8.3 Soft-Wrap Newline Merge (Implemented)
Problem: Some model variants insert manual hard newlines mid‑sentence for ~80 column wrapping, creating artificial fragmentation.

Heuristic (Strategy 2 – stricter, safety first). Merge newline to space iff:
1. Char before `\n` not in `[.!?:;]`.
2. Char before `\n` matches `[a-zA-Z0-9)]`.
3. First non-space char after `\n` matches `[a-z(]`.
4. Next line is NOT a numbered list (`/^\s*\d+\.\s/`).

Applied after removal of blank lines. Idempotent. Lists and sentence boundaries preserved.

### 8.4 Preservation Rules (Updated)
- Preserve numbered lists: lines matching `/^\s*\d+\.\s+/` remain separate (newline before them never merged).
- Single/ double blank lines no longer exist post-transform (we removed all blank lines intentionally).
- Leave `#` / `##` lines (potential code or hash-prefixed identifiers) untouched; only ≥`###` removed.
- Do not merge across what appears to be a sentence boundary (punctuation guard).

### 8.4 Non-Transformations (Phase 1)
- Italic markers (`*text*` or `_text_`) left intact (rare & harmless) – may be added later.
- Inline code backticks not explicitly stripped unless part of bold removal (system instruction should suppress them).
- Fenced code detection deferred until leakage justifies complexity.

### 8.5 Pseudocode (Current Implementation + Planned Merge)
```js
function sanitizePhase1(raw){
  if(!raw || typeof raw !== 'string') return raw || ''
  const original = raw
  let s = raw
  // Headings ≥ ### + space
  s = s.split('\n').filter(line => !/^#{3,}\s+/.test(line)).join('\n')
  // Bold markers
  s = s.replace(/\*\*(.*?)\*\*/g,'$1').replace(/__(.*?)__/g,'$1')
  // Remove ALL blank lines
  s = s.split('\n').filter(l => l.trim()!=='').join('\n')
  // Trailing spaces
  s = s.split('\n').map(l=> l.replace(/\s+$/,'')).join('\n')
  if(s.length===0 && original.trim().length) return original
  return s
}

// Phase 1.1 (planned) soft-wrap merge
function mergeSoftWraps(s){
  return s.replace(/([a-zA-Z0-9)])\n([a-z(])/g, (m,a,b)=> a + ' ' + b)
}
```

### 8.6 Test Cases (Illustrative)
| Case | Input (excerpt) | Expected |
|------|-----------------|----------|
| Heading removal | `### Title` | (line removed) |
| Bold | `This is **important** note.` | `This is important note.` |
| Bold nested punctuation | `(**Alpha__)` with markers | Markers removed, punctuation preserved |
| Numbered list preserved | `1. Start` | unchanged |
| Blank lines removed | `A\n\nB` | `A\nB` |
| Fallback empty | `### Header Only` | original retained |
| Soft wrap (planned) | `cocido madrileño (a\nmeat and vegetable stew)` | `cocido madrileño (a meat and vegetable stew)` |
| Sentence boundary (planned) | `...end.\nNext sentence` | unchanged (newline kept) |
| List boundary (planned) | `Intro\n1. Item` | unchanged |

Decision: keep space after hashes requirement (`^#{3,}\s+`) to avoid removing lines like `#####error_code` if no space.

### 8.7 Telemetry (Optional Future)
Counters: `sanitizedChanged=1|0`, `removedHeadingLines`, `boldReplacements` to HUD for debugging (deferred unless needed).

## 9. Phased Rollout
Phase 0 (Done): SystemInstruction injection + token reservation.
Phase 1 (Done): Sanitizer (headings ≥###, bold, blank line removal) – no raw archival.
Phase 1.1 (Planned): Soft-wrap newline merge (Strategy 2) — no raw archival yet.
Phase 2 (Optional): Add rawAssistantText preservation & fenced-block skip.
Phase 3 (Optional): Few-shot style examples, temperature tuning, stop sequences.
Phase 4 (Optional): User toggle to disable sanitizer.

## 10. Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| False positive removal of code lines starting with ### inside legitimate text | Require space after hashes; only ≥3 hashes |
| Sanitizer accidental full wipe | Fallback to original if becomes empty |
| Model still outputs heavy markdown lists | Could extend sanitizer to strip leading `- ` or `* ` in Phase 2 |
| Performance overhead for large replies | Single O(n) string passes; negligible vs network latency |

## 11. Acceptance Criteria (Phase 1 / 1.1)
Met:
- SystemInstruction always present at messages[0].
- EffectiveMaxContext applied (system message never trimmed).
- Sanitizer removes headings ≥###, bold markers, all blank lines; trims trailing spaces.
- Soft-wrap merge (Strategy 2) applied; does not merge across sentence punctuation or before list items.
- Numbered lists preserved; idempotent; safety fallback works.
- Tests cover removal, preservation, and soft-wrap merging scenarios.

## 12. Open questions & future specs
- Should we also strip italic markers? (Defer until observed noise.)
- Should we detect & unwrap single backtick inline code? (Pending usage feedback.)
- Need raw/original preservation? (Add only if sanitizer modifications cause user confusion.)

## 13. Deferred / future enhancements
Planning note: Any step-like activities are tracked in `plan.md`.
- Few-shot system examples to reinforce style for weaker models.
- Logit bias (negative) on formatting tokens (requires token IDs – deferred).
- Adaptive sanitizer (only apply if leakage frequency > threshold).

---
End of spec. Consolidation into a unified architecture doc may follow after Phase 1 implementation.
