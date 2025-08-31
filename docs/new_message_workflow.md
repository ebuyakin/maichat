# New Message Send & Response Workflow (Draft for Review)

Last updated: 2025-08-30
Status: APPROVED – extended WYSIWYG with token budget marking (Phase 1 M6 starting).

## 1. Core Principle (WYSIWYG Context)
"What You See Is What You Send": The context sent to the LLM consists of exactly the *currently visible* message pairs in the history pane **after** the active filter is applied, in the on‑screen order (top → bottom), plus the *new user request* being sent. No hidden / filtered out / partially excluded content is added implicitly. Visual partitioning (multiple rendered parts of one logical message) collapses back to a single user or assistant message in the API payload.

Future extension (out of current scope): augment context with explicit user commands that inject synthetic system or style messages (e.g. tone/style directives). Architecture will leave a hook `composeSystemPrelude()` returning an optional system message (initially returns null).

Implications:
- Any filter (topics, model, star, in/out, etc.) directly shapes context. If a pair is not rendered, it is absent from the request.
- The in/out (include/exclude) flag is *just another attribute* leveraged exclusively by filters; it does **not** implicitly alter the context beyond visibility.
- The user has full manual control of context composition through the command filter language (no secondary hidden rule set).

## 2. Entities & Data Snapshots
| Entity | Description |
|--------|-------------|
| MessagePair | { id, topicId, model, userText, assistantText, meta (star, in/out, etc.), lifecycleState, timestamp } |
| Lifecycle State | idle, sending, awaiting, succeeded, error, canceled |
| Context Snapshot | Immutable array captured at send time: list of visible pairs (user+assistant messages present at that moment) + pending user message (if new). Stored for retry/error introspection. |
| Pending Send Lock | Global flag preventing concurrent sends. |

assistantText is absent until response arrives (no empty assistant placeholder block). A lightweight inline status badge is shown instead ("thinking…").

## 3. State Machine (Logical)
```
Draft → (Enter/Send) → Sending(User Pair Created) → AwaitingResponse
  → ResponseSuccess → Done
  → ProviderError → ErrorShown → (Retry | Delete | LeaveAsIs)
  → NetworkError  → ErrorShown → (Retry | Delete | LeaveAsIs)
  → UserAbort (Esc) → Canceled (pair optionally deleted per decision) 
```
Notes:
- Sending & AwaitingResponse may be merged (we still show immediately so user sees their prompt).
- Retry uses stored snapshot (context stability across edits after initial send).

## 4. Standard Flow (Happy Path)
1. User types text in input field.
2. User presses Enter or clicks Send.
3. System gathers *visible* message pairs (render order) at that instant.
4. Creates new MessagePair with userText; (no assistant part yet), lifecycleState = `sending` (displayed with a subtle inline "thinking…" badge).
5. Captures context set = *visible pairs prior to adding* the new pair, plus the new user message (never the assistant part). Not persisted on success; only on error.
6. Input remains active (user can compose next prompt). Send button indicates busy (disabled) to prevent a second concurrent send.
7. Calls OpenAI Chat Completions with messages:
   - For each visible pair (in order):
     - If userText present: { role: "user", content: userText }
     - If assistantText present & non-empty: { role: "assistant", content: assistantText }
   - Append new outgoing: { role: "user", content: newUserText }
8. On 200 OK success: append assistantText with provider content; lifecycleState = `succeeded`; busy state cleared.
9. Update HUD / internal stats (optional dev view) and scroll anchoring logic as usual.
9. Scroll / focus policy:
  - If assistant reply fits in viewport: keep mode INPUT; focus stays in input.
  - If reply overflows and user is not actively typing (no keystroke in last 1s): auto-switch to VIEW and focus first assistant part.
  - If user is typing: do not steal focus; mark first assistant part with a small "(new)" badge.
  - Setting: `autoEnterViewOnOverflow` (default true).

## 5. Branch Scenarios
### 5.1 Provider Error (4xx/5xx JSON)
1. Response arrives with error.
2. Placeholder replaced with formatted error text (e.g. `[error: <short classification>] <provider message>`); lifecycleState = error.
3. Inline actions (Phase 1): `[Edit & Resend]` (`e`), `[Delete]` (`x`).
4. UI unlocks.

### 5.2 Network Error / Timeout
Similar to provider error but classification `[network]`.

### 5.3 User Abort
Not implemented in M6 (no abort path). Esc retains its existing mode behavior only.

### 5.4 Edit & Resend (Replaces Retry)
1. Available for pairs in states: `succeeded` (refinement) or `error`.
2. Action `e` transforms userText into inline editable area (assistant part hidden during edit; previous assistant text discarded once resend starts).
3. On submit (Enter / Ctrl+Enter): lifecycleState → `sending`; assistant part removed; send uses current visible context + edited user text.
4. Success: assistant response added; history remains single concise pair.
5. Delete (`x`): removes pair (confirmation if existing assistant text).

### 5.5 User Edits Filter While AwaitingResponse
- In-flight request is *not* affected; context already snapped.
Visible list may hide the sending pair; it will only reappear if filter later includes it (documented; no toast Phase 1).

### 5.6 User Switches Model After Sending (Before Reply)
- Does not alter in-flight model; new model takes effect only for next send.

### 5.7 Deleting a Pair
- Provide a command (future) or inline action to delete a MessagePair (only acts locally; persistence layer updates and saves). Not mandatory for first M6 slice except for abort delete path if Option A chosen.

## 6. Context Assembly Rules (Formal)
1. Source list = array of MessagePairs currently rendered (already filtered & ordered) at *send time*.
2. For each pair in order:
   a. If userText.trim() != "": push user message.  
   b. If assistantText.trim() != "": push assistant message.
3. Append new outgoing user message (if this is a send action).
4. Omit any placeholder assistant value.
5. Do not include metadata (topics, stars) in message content (they are purely filter & indexing attributes now).
6. Snapshot persisted only on error (for potential debugging display); not on success.

## 7. Token Budgeting (Heuristic First Pass)
Definitions:
- charsPerToken = 4 (configurable later).
- estimatedTokens = sum( ceil(len(content)/charsPerToken) ).
- modelMaxTokens table (heuristic):
  - gpt-4o-mini: 128k (context) – we will treat a soft cap e.g. 120k for safety.
- responseReserve: user-configurable later; default 800.
Preflight Rule: if estimatedTokens + responseReserve > modelMaxTokensSoft → warn user (blocking dialog with options: Abort / Force Send). *No automatic trimming in M6 to avoid hidden behavior.*

## 8. UI Elements (Initial M6 Slice)
| Element | Behavior |
|---------|----------|
| Send Button → "Thinking…" badge | Indicates in-flight (button disabled); input still editable. |
| In-flight badge | Inline small muted text after user message (not a separate assistant block). |
| Context Counter | Shows `X / Y` (included / visible). Tooltip: token stats & limits. Updates live. |
| Out-of-Context (OOC) Marking | Oldest excluded pairs get `.ooc` class, reduced opacity, "OUT" badge. |
| Boundary Jump | Shift+O jumps to first included pair (boundary). If all included shows HUD notice. |
| Error Display | `[error: code] shortMessage` + buttons `[Edit & Resend] [Delete]` (keyboard: `e`, `x`). |
| Edit Mode | User text → textarea; Esc cancels; Enter/Ctrl+Enter sends. Assistant part hidden during edit. |
| Delete | Removes pair (confirm if assistant present). Available for any pair. |
| Token Estimate | Small gray `~N` near Send (debounced). |
| Over-budget Alert | Blocking confirm dialog (no auto-trim). |

## 9. Defer / Removed From M6
- Manual per-message deselect (removed; rely on filters).
- Streaming partial response (defer).
- HUD token diff (maybe dev-only later).
- System/style injection (hook only; no UI yet).

## 10. Resolved Decisions Summary
| # | Decision | Status |
|---|----------|--------|
| 1 | Abort (Esc) omitted in M6 | Accepted |
| 2 | In-flight pair may disappear under filter | Accepted |
| 3 | Error prefix `[error: code]` | Accepted |
| 4 | Delete action present Phase 1 (all pairs) | Accepted |
| 5 | No snapshot on success (errors only) | Accepted |
| 6 | Timeout → `[error: network]` (30s default) | Accepted |
| 7 | Min send validation: trimmed length ≥1 | Accepted |
| 8 | Over-budget handling: mark-oldest (dim) + X/Y counter (no blocking) | Accepted |
| 9 | Token estimate beside Send | Accepted |
| 10 | Canceled path N/A (no abort) | Accepted |
| 11 | Edit-in-place resend replaces retry | Accepted |
| 12 | Version history deferred | Accepted |
| 13 | System/style injection deferred (hook only) | Accepted |
| 14 | Auto enter view on overflow (setting ON) | Accepted |
| 15 | Delete allowed for all pairs | Accepted |

## 11. Minimal Data Additions
Add fields to MessagePair (non-breaking):
```
{
  ...,
  lifecycleState: 'sending' | 'awaiting' | 'succeeded' | 'error' | 'canceled',
  contextSnapshot?: ChatMessage[],
  errorCode?: string,
  errorType?: 'auth' | 'rate' | 'network' | 'server' | 'unknown',
  createdAt: number,
  updatedAt: number
}
```
(Only lifecycleState + contextSnapshot + error metadata strictly required for M6 base.)

## 12. Implementation Phasing (Adjusted for Decisions)
Phase 1: gatherContext(), estimator + boundary calculation, X/Y counter, .ooc marking, OpenAI adapter, send flow (thinking badge), success & error display, edit-in-place resend, delete, inline token estimate.
Phase 2: timeout handling fine‑tune, autoEnterViewOnOverflow setting toggle, optional hud metrics, system prelude hook stub, (optional block mode setting if needed).
Phase 3 (post‑M6 or late M6 if time): streaming, style injection UI, performance tuning.

## 13. Proposed Plan Adjustments
- Preview overlay removed for initial M6; rely on WYSIWYG + inline token count. Read‑only preview can be added later if needed.

## 14. Next Steps After Approval
1. Update implementation plan (M6) per decisions (especially removal of deselect, preview specifics).
2. Implement gatherContext + tests.
3. Implement OpenAI adapter + tests (mock fetch).
4. Extend send pipeline with lifecycleState + placeholder, success & error handling.
5. Add abort path (decision dependent), retry path, token budgeting.

---
All decisions captured; proceeding to implementation (Phase 1 tasks now executable).
