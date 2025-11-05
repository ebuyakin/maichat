# Re-ask Replaces Answer — Minimal Spec (Source of Truth)

Status: Draft for implementation review
Scope: In-place re-ask that replaces the assistant answer of the last visible pair; no variants, no families
Out of scope: Multi-variant storage, primary flags, family/grouping UIs, filter grammar changes

## Core principles
- Simplicity and transparency: message pair remains the only unit of interaction.
- Minimalism: keep existing list composition and filter semantics unchanged.
- Predictability: re-ask updates the same pair; chronology and navigation remain stable.

## Rendering constraints and DOM policy
- History is rendered in a single pass: build a full HTML string and assign to the `#history` container once.
  - Function of record: `historyRuntime.renderCurrentView()` → `historyView.renderMessages(messages)`.
- Allowed live updates (no layout/order changes): adjust badges/attributes/text on existing nodes (stars, flag, topic, offctx, sources), focus classes.
- Not allowed live updates: reordering, inserting/removing message nodes, or moving nodes. Any change to message content or set should use `renderCurrentView()`.

## Data model additions (pair-level)
Add optional fields to `MessagePair`:
- `previousAssistantText?: string`
- `previousModel?: string`
- `replacedAt?: number` (ms epoch)
- `replacedBy?: string` (e.g., model or actor tag)
Notes:
- Single-slot history is enough for MVP. (Future: chain if needed.)
- No `variantOf`, no `isPrimary`, no family structures.

## UX
### Definition: last in filtered set (LFS)
- “Last in filtered set” means the most recent pair within the current filter result set, regardless of what portion is currently scrolled into view. It is not tied to on-screen visibility.

\- Re-ask (View mode)
  - Trigger: `e` on focused user/assistant.
  - Behavior depends on message state:
    - Error-containing message (unchanged): immediately delete the error pair and copy its user text + attachments into the input box (pre-fill). No overlay. User sends via the normal input flow; result is a new message pair (fresh `createdAt`).
    - Normal message: open a dedicated Re-ask overlay (separate from the standard model picker). On Enter/confirm, perform in-place replacement of the assistant answer (do not copy to input; no new pair).
  - Guard for normal messages only: allowed only for the last pair in the current filtered set (LFS). If not last, no action is performed.
  - Re-ask overlay (normal-only): model selector (default = current active model), concise note “Replace this answer; the previous will be saved.” Enter/confirm triggers immediate send and in-place replacement; Escape/cancel aborts.
- Restore previous (optional, normal messages only)
  - `Shift+E` swaps current answer with `previousAssistantText` if available (single-slot toggle).

### Controls in history (buttons)
- Show compact icon buttons on the assistant meta line (right side) but keep the UI uncluttered by hiding when not applicable:
  - Re-ask: ↻ (title: “Re-ask (e)”).
  - Delete (only for error messages): ✕ (title: “Delete error (w)”).
- Visibility rules (render-time):
  - Error messages: show both ↻ and ✕ regardless of position in the list.
  - Normal messages: show ↻ only if the pair is the last in the current filtered set (LFS); otherwise hide both buttons.
  - The colon command `:delete` remains available for deleting normal messages; we do not show ✕ for normal messages.
  - Visibility is recomputed on normal re-render (filter change, new message, settings rebuild).

## Sending and lifecycle
- Context assembly: unchanged; strict WYSIWYG based on current filter and boundary manager.
- Important: Error resend/delete is already fully implemented today and requires no code changes.
- Error resend flow (new pair, unchanged):
  1) Delete the error pair immediately after copying its user text + attachments to the input draft.
  2) User sends via the normal input flow (no overlay); provider returns a new answer.
  3) A new message pair is created with a fresh `createdAt` (chronological append); normal post-processing (code/equations/citations).
  4) Re-render view (preserveActive where sensible); focus moves to the new last message.
- In-place replacement flow (normal pair):
  1) Pair enters `sending` state; UI shows spinner badge.
  2) On success:
     - Move `assistantText` → `previousAssistantText`; set `previousModel`.
     - Set `assistantText` to the new content; update `model`, `lifecycleState='complete'`.
     - Re-run code/equation extraction and citations processing as today.
     - Set `replacedAt = Date.now()`, `replacedBy = selected model`.
  3) On error: set `lifecycleState='error'`; do not modify `previousAssistantText`.
  4) Rendering update: call `renderCurrentView({ preserveActive: true })` after state changes.

### Timestamp policy
- Normal re-ask (in-place replacement):
  - Do NOT change `createdAt`. It remains the original timestamp for ordering and date filtering.
  - Record `replacedAt` for telemetry/inspectors. Display keeps `createdAt`.
- Error re-ask (new pair):
  - New pair gets a fresh `createdAt` at send/response time; it will appear at the end chronologically.
  - This mirrors the user explicitly re-sending the question as new.

## Rendering (history)
- No composition changes. Each pair renders as today (user/meta/assistant).
- No extra badges for "previous" in MVP. The restore feature is keyboard-only.

\- `e` — re-ask action.
  - Error: always available; deletes the error pair and pre-fills input (no overlay); user sends as usual; new pair is created.
  - Normal: only on the last pair in the current filtered set (LFS); opens the dedicated Re-ask overlay; otherwise no action.
- `Shift+E` — restore previous answer (normal-only); otherwise no-op.
- `w` — delete error messages (matches current behavior). For normal messages, prefer `:delete`; no UI delete button.
- Existing keys (`j/k/u/d/g/G`, `r`, etc.) unchanged.

## Filters and history composition
- No changes to the filter language, parser, or evaluator.
- Chronological order and navigation behavior remain unchanged.

## Export & debug (optional niceties)
- Export continues to output the current `assistantText`. (Future: JSON export may include `previousAssistantText` when a flag is set.)
- HUD may show `replacedAt` in info panels (optional).

## Risks / side effects
- Ensure active focus and scroll alignment stay stable after re-render.
- Ensure token caches (`_tokenCache`) are invalidated on `assistantText` changes.
- Preserve image attachments on the user message across replacements.
- Keep error resend path consistent with new overlay (unify implementations).

## Action plan (small, verifiable steps)
1) Model & store
   - Extend `MessagePair` typedef with the four optional fields.
   - No schema migrations required; lazy presence is fine.
   - Add a helper to clear per-pair token cache on content change.
2) Overlay (normal-only)
  - Implement a dedicated Re-ask overlay (separate from the standard model selector) with model picker and confirm/cancel.
  - Enter/confirm in this overlay triggers immediate send and in-place replacement; Escape/cancel aborts.
  - Wire `e` to open this overlay for normal messages; enforce “last in filtered set (LFS)” guard (no-op when not LFS).
  - For error messages, do not use this overlay at all (reuse the existing error re-ask flow).
3) In-place replace flow
   - Implement `reAskInPlace(pairId, model)`:
     - Build messages via existing pipeline (WYSIWYG), call provider.
     - On success, update the same pair per lifecycle above; call `renderCurrentView({ preserveActive: true })`.
4) Restore
   - Implement `restorePrevious(pairId)` for `Shift+E` (swap fields; re-extract code/equations; re-render preserveActive).
5) Tests
   - Replace happy path; error path; restore; not-last guard; focus/scroll preservation.
6) Docs/help
   - Update keyboard reference and tutorial shortly before release.

## Acceptance criteria (MVP)
- `e` on error: deletes the error, pre-fills input, sends as a new pair with fresh timestamp.
- `e` on normal (last-only): replaces assistant in-place; previous answer stored; `Shift+E` can restore.
- No filter or ordering changes for normal replacements; navigation (`j/k/u/d/g/G`) and alignment behave as before.
- Error and success flows use the same overlay/pipeline pattern and keep the UI responsive.


