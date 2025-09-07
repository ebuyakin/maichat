# New Message Send & Response Workflow (Draft for Review)

Last updated: 2025-09-01 (post overflow-only trimming, model catalog v2, URA prediction integration)
Status: PARTIALLY IMPLEMENTED – WYSIWYG, URA‑aware prediction, overflow-only trimming, telemetry, bracket counter. Pending: rpm/tdp quota logic, proactive AUT > URA adjustment, enhanced error taxonomy, user-facing trim summaries, optional cancel.

## 1. Core Principle (WYSIWYG Context)
"What You See Is What You Send": The context sent to the LLM consists of exactly the *currently visible* message pairs in the history pane **after** the active filter is applied, in the on‑screen order (top → bottom), plus the *new user request* being sent. No hidden / filtered out / partially excluded content is added implicitly. Visual partitioning (multiple rendered parts of one logical message) collapses back to a single user or assistant message in the API payload.

### Model Selection Source (Correction)
Unless explicitly overridden, all budgeting (prediction boundary, trimming attempts) uses the **currently selected model in the input zone (model selector)** – NOT the model of the newest existing pair. If no selection exists (edge case during first load), we fall back to the newest pair's model or a default (`gpt`).

### Payload Terminology (Authoritative)
We distinguish between structured *payloads* (ordered arrays of role/content messages) and their numeric *token estimates*. Each payload name gains a token counterpart by appending `Tokens`. Terms below supersede any earlier informal wording; if a prior section used a different label, this glossary is canonical.

Definitions:
* PredictedHistoryPayload – The ordered set of existing (already sent) message pairs selected by the prediction algorithm (newest→oldest) that fit when reserving URA; does NOT include the *new* user request being composed.
* PredictedHistoryTokens – Estimated token sum of PredictedHistoryPayload.
* PredictedTotalPayload – PredictedHistoryPayload plus the *new* user message (pre‑send, before any trimming). Conceptual sizing aid; not necessarily transmitted if overflow leads to trimming.
* PredictedTotalTokens – Token estimate of PredictedTotalPayload.
* SentAttemptPayload – The concrete payload array (history messages + current user message) used for a single API attempt (initial or trimmed retry). Attempt N may have fewer history pairs than attempt N‑1.
* SentAttemptTokens – Token estimate for a given SentAttemptPayload.
* FinalDeliveredPayload – The SentAttemptPayload of the last successful attempt (assistant response received) OR (in error telemetry) the last attempted payload if all attempts failed.
* FinalDeliveredTokens – Token estimate of FinalDeliveredPayload.
* TrimmingRemovedPayload (optional telemetry) – Ordered list of history pairs dropped (PredictedHistoryPayload \ FinalDeliveredPayload.historyPart) during overflow trimming.
* TrimmingRemovedTokens – Token estimate for TrimmingRemovedPayload.
* JsonDoc – The final JSON document passed to the provider adapter (e.g. `{ model, messages:[...] }`). This contains FinalDeliveredPayload encoded as provider chat messages.

When a telemetry field name ends with `Payload` it always refers to a *sequence of chat messages*. When it ends with `Tokens` it refers to the numeric token estimate for that sequence under the active estimation heuristic (charsPerToken, etc.).

Future extension (out of current scope): augment context with explicit user commands that inject synthetic system or style messages (e.g. tone/style directives). Architecture will leave a hook `composeSystemPrelude()` returning an optional system message (initially returns null).

Implications:
- Any filter (topics, model, star, colorFlag, etc.) directly shapes context. If a pair is not rendered, it is absent from the request.
- The colorFlag (formerly "in/out" include/exclude) is *just another attribute* leveraged exclusively by filters; it does **not** implicitly alter inclusion beyond visibility.
- The user has full manual control of context composition through the command filter language (no secondary hidden rule set).

## 2. Entities & Data Snapshots
| Entity | Description |
|--------|-------------|
| MessagePair | { id, topicId, model, userText, assistantText, star, colorFlag, lifecycleState, timestamp (alias of createdAt) } |
| Lifecycle State | idle, sending, complete, error (canonical; cancel & streaming not yet implemented) |
| Context Snapshot | (Planned) Immutable capture of INCLUDED pair IDs + outgoing prompt on error only. |

assistantText is absent until response arrives (no empty assistant placeholder block). A lightweight inline status badge is shown instead ("…" while sending).

## 3. State Machine (Logical)
```
idle → sending → complete
            ↘ error

Re-ask (error only): error (user triggers re-ask) → sending (creates a NEW pair at the end; old error pair is deleted)
```
Notes:
- No separate awaiting state; `sending` covers until response or error.
- No cancel path yet; Esc does not abort active network call.
- Re-ask is available for error pairs. It copies the earlier user text to the input, and on send uses current context, deletes the old error pair, and appends a new pair at the end (new id, new timestamp).

## 4. Standard Flow (Happy Path)
1. User types text in input field.
2. User presses Enter or clicks Send.
3. System gathers *visible* message pairs (render order) at that instant (candidate list; INCLUDED subset resolved via prediction boundary – see §§6 & 7).
4. Creates new MessagePair with userText; (no assistant part yet), lifecycleState = `sending` (displayed with a subtle inline "thinking…" badge).
5. (Planned) Optional context snapshot of visible pairs prior to adding the new pair; currently only telemetry/debug payloads (no stored snapshot).
6. Input remains active (user can compose next prompt). Send button indicates busy (disabled) to prevent a second concurrent send.
7. Calls OpenAI Chat Completions with messages:
   - For each visible pair (in order):
     - If userText present: { role: "user", content: userText }
     - If assistantText present & non-empty: { role: "assistant", content: assistantText }
   - Append new outgoing: { role: "user", content: newUserText }
8. On 200 OK success: append assistantText with provider content; lifecycleState = `complete`; busy state cleared.
9. Update HUD / internal stats (optional dev view) and scroll anchoring logic as usual.
10. Scroll / focus policy (Refined):
  - After send, the new user part is focused (INPUT mode retained).
  - When assistant reply renders, measure its full rendered height (top of first assistant part to bottom of last assistant part of that reply).
  - If current mode is INPUT, input box is empty, and the reply height exceeds the viewport (cannot fully fit): switch to VIEW mode and focus the first assistant part of the new reply.
  - If the reply fully fits: remain in INPUT mode; focus stays in input (user can continue drafting next prompt).
  - If user changed to VIEW or COMMAND while waiting (not in INPUT at arrival): do not alter mode or focus.
  - Future options (not implemented): user preference to always/never switch; partial-height threshold tuning.

## 5. Branch Scenarios
### 5.1 Provider Error (4xx/5xx JSON)
1. Response arrives with error.
2. Placeholder replaced with formatted error text (e.g. `[error: <short classification>] <provider message>`); lifecycleState = error.
3. Inline actions: `[Re-ask]` (`e` in VIEW), `[Delete]` (`d` in VIEW). Buttons are always clickable; keyboard shortcuts are VIEW-only.
4. UI unlocks.

### 5.2 Network Error / Timeout
Similar to provider error but classification `[network]`.

### 5.3 User Abort
Not implemented in M6 (no abort path). Esc retains its existing mode behavior only.

### 5.4 Re-ask (Error Pair; No Branching)
1. Available for pairs in state: `error`.
2. Action `e` (VIEW mode) copies the error pair's userText into the bottom input (no inline editor in history).
3. On Send: the old error pair is deleted; a new pair is created at the end with the current timestamp/id, inheriting topic/model; the request uses the current visible context (WYSIWYG).
4. Success: assistant response arrives for the new pair; chronology remains honest (no rewrites/branching).
5. Delete (`d` in VIEW): removes the focused error pair (no confirm needed for error-only pairs).

### 5.5 User Edits Filter During In-Flight Send
- In-flight request is *not* affected; context already snapped.
Visible list may hide the sending pair; it will only reappear if filter later includes it (documented; no toast Phase 1).

### 5.6 User Switches Model After Sending (Before Reply)
- Does not alter in-flight model; new model takes effect only for next send.

### 5.7 Deleting a Pair
- Provide a command (future) or inline action to delete a MessagePair (only acts locally; persistence layer updates and saves). Not mandatory for first M6 slice except for abort delete path if Option A chosen.

## 6. Context Assembly Rules (Formal)
1. Candidate List: All currently *visible* (filtered) message pairs in on‑screen (chronological top→bottom) order at send time.
2. Prediction Boundary (see §7): Walk newest→oldest accumulating pair token estimates until adding the next would violate `(predictedHistoryTokens + URA) ≤ ML` (model limit). Mark accumulated pairs as INCLUDED. Remaining visible pairs are EXCLUDED (OOC: still rendered, not sent).
3. Serialization Order: INCLUDED pairs are serialized in chronological (top→bottom) order. For each INCLUDED pair:
  a. If `userText.trim() !== ''` emit `{ role:'user', content:userText }`.
  b. If `assistantText.trim() !== ''` emit `{ role:'assistant', content:assistantText }`.
4. Append New Outgoing: Add the new user prompt as the final message `{ role:'user', content:newUserText }`.
5. (Optional Future) If `composeSystemPrelude()` returns a system/style message, prepend it (not yet implemented).
6. (Planned) Context Snapshot: On *error only* capture `{ includedPairIds, outgoingUserText }` for retry/debug display. Not yet implemented; current debug HUD derives info live.
7. Excluded / OOC Pairs: Never serialized into the provider request; presence is purely visual (styling + boundary navigation aid).
8. Trimming Non‑Recompute: We do not recompute X during trimming; the loop operates on the initial predicted INCLUDED set minus oldest removals.
9. Metadata Exclusion: Topic, star, colorFlag, and other metadata are not injected into message contents.

### 6.9 Prediction Boundary Update Policy
The prediction boundary (INCLUDED vs EXCLUDED pairs) is intentionally *stable* during ordinary typing to honor zero‑cost keystrokes. It is recomputed only when underlying inputs that can change the maximal includable suffix change.

Recompute Triggers (set boundary dirty → recompute lazily on next need or immediately if user opens HUD / counter refresh / send):
- Filter execution (user submits/executes a new filter query changing visible set or order).
- Model change (different context window or tpm → ML changes).
- URA (userRequestAllowance) change.
- charsPerToken change.
- Assistant reply arrival (assistantText appended; token length of a pair grows).
- Pair deletion.
- Pair edit commit (userText or assistantText modified & saved).
- Topic/star/flag edit that affects current filter result (visibility changes).
- Bulk load/import that adds or mutates pairs.

Non‑Triggers (no boundary recompute):
- Individual keystrokes while drafting a new prompt (URA reserve absorbs size variance).
- Scroll/viewport/partitioning adjustments.
- Pure metadata edits not referenced by current filter (no visibility change).
- Interim overflow trimming attempts inside a send (the original predicted set X is conceptually preserved; trimming operates on a working copy).

Send Action Behavior (Option A – current):
- On send, if boundary is clean (not dirty) we reuse cached INCLUDED set.
- If dirty, we recompute once just before assembling messages.
- If `predictedHistoryTokens + AUT > ML` (actual prompt larger than reserved URA budget), we still attempt the send with the predicted INCLUDED set. Overflow, if any, is handled by the runtime trimming loop. No preflight shrink or UI re-render occurs.

Rationale for Option A:
- Avoids UI churn/flicker at the moment of submission.
- Keeps the mental model: boundary reflects a stable reserve policy (URA), not reactive to every character of the outgoing prompt.
- Simpler implementation; rare large prompts incur at most one extra overflow attempt.

Future Enhancement (Deferred – Option B):
- Preflight invisible trimming: if `predictedHistoryTokens + AUT > ML`, drop oldest included pairs until fit before first provider call (still no UI boundary change). Would reduce wasted overflow attempts while preserving visual stability.

Invariant: User never sees the boundary shrink *because* of last‑second prompt length; any trimming performed (overflow loop, or future preflight) is only revealed post‑send via the bracket counter `[X-T]/Y` and tooltip telemetry.

## 7. Token Budgeting & Trimming (Current Implementation + Planned Enhancements)

We distinguish between the pre-send predicted context (what is visibly marked included) and the final sent context (after any runtime overflow trims). Implementation: URA‑aware newest→oldest prediction, provider overflow classification, single-pair iterative trimming, and telemetry surfaced in the debug HUD.

### 7.1 Definitions (Current Terminology & Invariants)
We explicitly separate *message counts* from *token counts* to avoid dimension confusion.

| Term | Meaning | Constant During Send? |
|------|---------|-----------------------|
| ML (Model Limit) | `effectiveMaxContext = min(model.contextWindow, model.tpm)` – simplistic throughput-aware cap (rpm/tdp not yet modeled). | Yes (unless model switched mid-send – not supported) |
| CPT (Chars Per Token) | Heuristic divisor (default 3.5 via `charsPerToken`). | Yes |
| URA (User Request Allowance) | Fixed reserve (default 100) subtracted during prediction (boundary calc). | Yes |
| Predicted Message Count (X) | Number of INCLUDED (prediction boundary) message pairs. | Yes |
| Predicted History Tokens | Token sum of those X predicted pairs at prediction time. | Yes |
| Predicted Total Tokens | `predictedHistoryTokens + URA` – conceptual envelope reserved for history plus allowance. | Yes |
| AUT (Actual User Tokens) | Estimated tokens of outgoing user prompt; error if `AUT > ML`. | N/A (single value) |
| Attempt History Tokens | Token sum of currently *still included* pairs this attempt (after any trims so far). | Decreases (monotonic) |
| Attempt Total Tokens | `attemptHistoryTokens + AUT`. | Decreases (monotonic) |
| Trimming (Runtime) | Overflow-only removal of one oldest predicted pair per overflow attempt (≤ NTA). | — |
| T (Trimmed Count) | Number of pairs removed so far in overflow loop. | Increases (monotonic) |
| sentCount | `X - T` after loop finishes (final included pairs actually sent). | Final value only |
| NTA (Max Attempts) | `maxTrimAttempts` setting (default 10). | Yes |

Initial attempt relationships:
- `attemptHistoryTokens (attempt 1) = predictedHistoryTokens`
- `attemptTotalTokens (attempt 1) = predictedHistoryTokens + AUT`
- Therefore `attemptTotalTokens (attempt 1) = predictedTotalTokens + AUT - URA`

Invariants:
- All fields prefixed `predicted...` are *frozen* for the lifecycle of one send.
- All fields prefixed `attempt...` may change only via trimming (never increase).
- We never “refund” URA; it is purely a planning reserve.
- Message count (X) and token sums are tracked separately; token-based decisions never alter X mid-loop except through explicit trimming (which updates attemptHistoryTokens, not X; X stays as original predictedMessageCount used for bracket notation `[X-T]/Y`).

### 7.2 Two-Stage Assembly (Mechanics)
1. Prediction: accumulate newest→oldest maintaining `cumulativeHistoryTokens`; stop before a next pair whose addition would make `(cumulativeHistoryTokens + nextPairTokens + URA) > ML`; included set becomes predicted context X (then freeze `predictedHistoryTokens = cumulativeHistoryTokens`).
2. Validation: estimate user prompt tokens (AUT). If `AUT > ML` raise `user_prompt_too_large` (no trimming attempts).
3. Send Attempt: build messages from predicted context + user prompt and call provider.
4. Overflow Loop: if classified overflow → remove exactly one oldest predicted pair, increment T and attempts count, retry (≤ NTA). Stops on success or when attempts exhausted → error `context_overflow_after_trimming`.
5. Telemetry: emits on each attempt with fields: `predictedMessageCount (X)`, `predictedHistoryTokens`, `predictedTotalTokens`, `attemptHistoryTokens`, `attemptTotalTokens`, `AUT`, `trimmedCount (T)`, `attemptsUsed`, `remainingReserve`, plus stage labels (`overflow_initial`, `overflow_retry`, `overflow_exhausted`, etc.). Legacy field aliases removed.

### 7.3 Counter Display Logic (Implemented)
Idle / no trimming: `X / Y` (predicted included / total visible pairs).
After a send where trimming occurred: `[X-T]/Y` where `X` = predicted count before trimming, `T` = trimmed count, displayed as `[sent-trimmed]/Y` (e.g. `[12-1]/34`).
Tooltip (current content): indicates predicted vs visible, URA mode active, number trimmed last send, and total included tokens. Future enhancement: richer breakdown (Predicted, Trimmed, Sent, Visible, URA, AUT, CPT, ML) and user-facing wording.

### 7.4 Parameters (Defaults / Settings)
* `charsPerToken` (CPT): 3.5 (settings)
* `userRequestAllowance` (URA): 100 (settings)
* `maxTrimAttempts` (NTA): 10 (settings)
* Trimming granularity: one whole oldest pair per overflow attempt
* Assistant reply reserve: none (removed legacy `responseReserve`); reply size not pre-reserved yet.

### 7.5 Overflow Classification
Detection hierarchy (case-insensitive):
1. Provider error code `context_length_exceeded` (if surfaced by adapter).
2. Substring match in message for any of:
  - `context_length`
  - `maximum context length`
  - `too many tokens`
  - `context too long`
  - `exceeds context window`
  - `request too large`
  - `too large for`

Rationale: API variants sometimes emit concise messages ("Request too large for <model>") lacking legacy phrases; expanded list reduces false negatives so trimming loop activates reliably.

### 7.6 Edge Conditions
| Scenario | Behavior |
|----------|----------|
| AUT alone > ML | Immediate error `user_prompt_too_large` before first attempt (implemented). |
| All predicted trimmed still overflow | Error `context_overflow_after_trimming` (implemented); future: improved user-facing guidance. |
| Filter changes mid-loop | Current: trimming loop operates on snapshot list; UI may hide some pairs; no abort logic yet. Planned: explicit abort + notice if filter changes during retries. |
| URA adjustment mid-session | Prediction uses latest settings value each send; running overflow loop does not re-expand after settings change. |

### 7.7 Telemetry Fields (Active Schema)
Schema:
`{ model, budget:{maxContext,maxUsableRaw}, selection:[{id,model,tokens}], predictedMessageCount, predictedHistoryTokens, predictedTotalTokens, attemptHistoryTokens, attemptTotalTokens, AUT, trimmedCount, attemptsUsed, charsPerToken, remainingReserve, stage, lastErrorMessage?, overflowMatched?, messages[] }`

Derived convenience: `sentCount = predictedMessageCount - trimmedCount`.

### 7.8 Status
Implemented: effectiveMaxContext=min(cw,tpm); URA reserve in prediction & boundary; overflow-only trimming loop; bracket counter `[X-T]/Y`; telemetry (HUD PARAMETERS / TRIMMING / ERROR groups); resizable HUD.
Pending: rpm/tdp live quota modeling; proactive adjustment when `AUT` encroaches on URA; richer tooltip & user-facing trim summaries; enhanced error taxonomy (distinguish rate limits vs network vs context exhaustion); abort-on-filter-change policy.

## 8. UI Elements (Initial M6 Slice)
| Element | Behavior |
|---------|----------|
| Send Button → "AI is thinking…" badge | Indicates in-flight (button disabled); input still editable. |
| In-flight badge | Inline small muted text after user message (not a separate assistant block). |
| Context Counter | Shows `X / Y` or `[X-T]/Y` post-trim. Tooltip currently summarizes predicted vs visible, URA active, trimmed last send (future: richer breakdown). Updates live. |
| Out-of-Context (OOC) Marking | Excluded pairs (beyond prediction boundary) get `.ooc` class, reduced opacity, "off" badge. |
| Boundary Jump | Shift+O jumps to first included pair (boundary). If all included shows HUD notice. |
| Error Display | `[error: code] shortMessage` + buttons `[Re-ask] [Delete]`. Keyboard: `e`/`d` in VIEW mode; per-row buttons clickable in any mode. |
| Re-ask Draft | Copies earlier user text into the bottom input; Esc cancels; Enter sends. Old error pair is deleted on send; a new pair is appended. |
| Delete | Removes pair. For error pairs, no confirm. |
| Token Estimate | Small gray `~N` near Send (debounced). |
| Over-budget Alert | Blocking confirm dialog (no auto-trim). |

### Error codes (UI labels)
Recognized short codes shown in history for failed sends:
- auth — invalid/missing API key; 401/403
- quota — 429, rate/quota/tpm/rpm; context/window exceeded
- net — network/fetch failures/timeouts
- model — unknown/invalid/deprecated/removed model name
- unknown — fallback when not matched

## 9. Defer / Removed / Revised From M6
- Streaming partial response (defer).
- System/style injection (hook only; no UI yet).

