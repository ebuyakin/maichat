# Plain Text Output Policy & Markdown Suppression Spec

Status: Phase 1 Implemented (System instruction + sanitizer active)
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
- HUD now shows the exact final JSON (system message included) under "RAW REQUEST JSON".
- No sanitizer yet; responses stored verbatim as `assistantText`.

## 5. Goals (Phase 1)
1. Reduce Markdown artifacts (headings ≥ level 3, bold markers) and collapse redundant blank lines.
2. Preserve numbered lists and paragraph boundaries (max 2 consecutive blank lines).
3. Guarantee idempotent transformation (running sanitizer twice yields same text).
4. Avoid altering text inside future code fences (fences currently discouraged; safeguard optional).

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

## 8. Planned Sanitizer (Phase 1 Implementation Spec)
Position: Apply immediately before `store.updatePair(id, { assistantText: ... })` on successful response.

### 8.1 Contract
Input: raw model reply string `raw` (UTF-16 JS string).
Output: sanitized string `clean`.
Guarantees:
- Length may shrink; never expands more than trivial whitespace adjustments.
- If transformation would yield empty while original non-empty, fallback to original (safety guard).
- Idempotent: `sanitize(sanitize(raw)) === sanitize(raw)`.

### 8.2 Transformations (Ordered)
1. (Optional Fence Split – DEFERRED) If triple backticks present, skip transformations inside fenced blocks. Phase 1: ignore (treat all text uniformly).
2. Remove heading lines starting with three or more hashes: delete lines matching `/^#{3,}\s+.*$/`.
3. Strip bold markers:
  - `**text**` → `text` using `/\*\*(.*?)\*\*/g` (non-greedy)
  - `__text__` → `text` using `/__(.*?)__/g`
4. Remove ALL blank (empty/whitespace-only) lines (revision: UI partitions handle paragraph separation; densify output).
5. Trim leading & trailing blank lines (intermediate safety; mostly redundant after step 4).
6. Normalize trailing spaces per line: trim end (`/ +$/`).

### 8.3 Preservation Rules
- Preserve numbered lists: lines matching `/^\s*\d+\.\s+/` remain untouched.
- Preserve single/double blank lines.
- Leave single `#`, `##` heading lines (treated as ordinary text) to avoid harming code directives (`#include`, shebangs) – only ≥`###` removed.

### 8.4 Non-Transformations (Phase 1)
- Italic markers (`*text*` or `_text_`) left intact (rare & harmless) – may be added later.
- Inline code backticks not explicitly stripped unless part of bold removal (system instruction should suppress them).
- Fenced code detection deferred until leakage justifies complexity.

### 8.5 Pseudocode
```
function sanitize(raw) {
  let s = raw
  const original = s
  // Remove ###+ heading lines
  s = s.split('\n').filter(line => !/^#{3,}\s+/.test(line)).join('\n')
  // Bold markers
  s = s.replace(/\*\*(.*?)\*\*/g, '$1').replace(/__(.*?)__/g, '$1')
  // Collapse 3+ blank lines
  s = s.replace(/\n{3,}/g, '\n\n')
  // Trim leading/trailing blank lines
  s = s.replace(/^(\s*\n)+/, '').replace(/(\n\s*)+$/,'')
  // Trim trailing spaces
  s = s.split('\n').map(l => l.replace(/\s+$/,'')).join('\n')
  if (s.length === 0 && original.trim().length) return original // safety fallback
  return s
}
```

### 8.6 Test Cases (Illustrative)
| Case | Input (excerpt) | Expected |
|------|-----------------|----------|
| Heading removal | `### Title` | (line removed) |
| Bold | `This is **important** note.` | `This is important note.` |
| Bold nested punctuation | `(**Alpha**)` | `(Alpha)` |
| Numbered list preserved | `1. Start` | unchanged |
| Multiple blanks | `Line\n\n\n\nNext` | `Line\nNext` |
| Triple hash only | `###Title` (no space) | removed (regex requires space? *Decision*: accept; keep rule with space OR broaden; choose space-only to reduce false positives) |
| Fallback empty | `### Header Only` | becomes empty → fallback to original? (Yes: original retained) |

Decision: keep space after hashes requirement (`^#{3,}\s+`) to avoid removing lines like `#####error_code` if no space.

### 8.7 Telemetry (Optional Future)
Counters: `sanitizedChanged=1|0`, `removedHeadingLines`, `boldReplacements` to HUD for debugging (deferred unless needed).

## 9. Phased Rollout
Phase 0 (Done): SystemInstruction injection + token reservation.
Phase 1 (Planned): Sanitizer (headings ≥###, bold, blank line collapse) – no raw archival.
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

## 11. Acceptance Criteria (Phase 1)
- SystemInstruction always present at messages[0] (verified in HUD raw JSON).
- EffectiveMaxContext applied (history never exceeds window when adding system message).
- Sanitizer (once implemented) removes targeted artifacts; idempotent; preserves numbered lists.
- No change to existing tests (new tests can be additive and isolated to sanitizer utility).

## 12. Open Questions
- Should we also strip italic markers? (Defer until observed noise.)
- Should we detect & unwrap single backtick inline code? (Pending usage feedback.)
- Need raw/original preservation? (Add only if sanitizer modifications cause user confusion.)

## 13. Future Extensions
- Few-shot system examples to reinforce style for weaker models.
- Logit bias (negative) on formatting tokens (requires token IDs – deferred).
- Adaptive sanitizer (only apply if leakage frequency > threshold).

---
End of spec. Consolidation into a unified architecture doc may follow after Phase 1 implementation.
