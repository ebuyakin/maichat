# MaiChat Tutorial (Draft)


Audience: new users who want to get productive fast. Keep it short, skimmable, and keyboard-first.

## What is MaiChat
MaiChat is a keyboard-centric client for working with multiple LLMs in a single, unified UI. It organizes conversations into a topic tree, supports a CLI-like filtering language, and gives you precise control over the context sent to a model.

Core ideas:
- Modes: Input, View, Command — each zone maps to a screen area and a set of keys.
- Tree-structured topics for every message, editable anytime.
- CLI filters for slicing history by topic, model, date, errors, and content.
- Context management: choose exactly what the model sees.

## Quickstart (60 seconds)
1) You start in Input Mode with the cursor in the message box (press F1 anytime for shortcuts). Type your request.
2) Ctrl+M to pick a model; Ctrl+T to pick a topic for this message.
3) Press Enter to send. The reply appears at the end of the history.
4) Press Esc to switch to View Mode and browse. Use j/k to move between message parts, g/G to jump to first/last, Shift+O to jump to the context boundary, and Shift+R to cycle reading position.
5) Press Enter to switch back to Input Mode and continue typing.

## Modes and where to look
- View Mode (middle zone): browsing history, rating/editing messages, jumping within the conversation.
- Input Mode (bottom zone): composing a new message.
- Command Mode (top zone): typing CLI filters and commands.

Switching:
- Enter/Esc cycle modes contextually; Ctrl+V/Ctrl+I/Ctrl+D jump directly to View/Input/Command.

Startup behavior:
- On open/reload, MaiChat starts in Input Mode and the history is focused on the last (newest) message part.

## Keyboard essentials
- Global: F1 (Help), Ctrl+. (Menu), Ctrl+E (Topic Editor), Ctrl+Shift+M (Model Editor), Ctrl+Shift+D (Daily Stats), Ctrl+, (Settings), Ctrl+K (API Keys).
- View Mode navigation: j/k next/prev part; g/G first/last; Shift+O jump to context boundary; Shift+R cycle reading position.
- View Mode actions: 1/2/3 set star rating; Space clear star rating; a toggle color code; e edit & resend (error row); d delete (error row); Ctrl+T change topic of active message.
- Input Mode: Enter send; Esc back to View; Ctrl+U clear to start; Ctrl+W delete word left; Ctrl+M model selector; Ctrl+T pick topic for next message.
- Command Mode: Enter apply and switch to View; Esc clear input; Ctrl+P/Ctrl+N prev/next command; Ctrl+U clear to start; Ctrl+W delete word left.

Tip: Mouse/touchpad interactions respect modes; focusing a control will switch to the correct mode to avoid conflicts.

## Topics and the topic tree
- Every message belongs to exactly one topic node in a hierarchical tree.
- You can reassign the topic of any message later (View Mode: Ctrl+T).
- Use the Topic Editor (Ctrl+E) to create and organize topics.
- Strategy: start with a few broad topics (e.g., Work/Personal/Research). Split further as conversations grow.

## Command language (CLI filters)
Use the top bar (Command Mode) to filter history. Filters are terse and quoted where needed.

Basic filters (correct syntax):
- Topic: t'work' — topic match (supports paths, wildcards, descendants via …)
- Date: d2025-09-08 — exact calendar day; or d<7d for relative ages (h/d/w/mo/y)
- Model: m'gpt-4o-mini' — filter by model; wildcards allowed; bare m uses current model
- Content: c'error budget' — substring search; '*' is a wildcard
- Errors: e — show only rows where assistant response errored

Operators and grouping:
- AND: space adjacency or & (r20 s>=2 ≡ r20 & s>=2)
- OR: | or + (m'gpt*' | m'claude*')
- NOT: ! (exclude) (!t'Archive...' or !s0)
- Parentheses: ( ... ) to control order
- Precedence: () > ! > & (and adjacency) > | and +

Topic patterns (case-insensitive):
- Exact name or path: t'AI', t'AI > Transformers > GPT'
- Descendants: t'AI...' (AI and all children)
- Wildcards: t'*Learning', t'Machine*', t'*Neural*', combinations like t"*AI*..."
- Bare t uses the currently selected topic from the input bar

Date forms:
- Absolute: d2025-09-08, d>=2025-01-01
- Relative ages: d<24h, d<=7d, d<2w, d<6mo, d<1y (unit defaults to days if omitted)

Examples you can paste:
- r30 & s>=2 — recent and at least 2 stars
- (b | s3) & t'Research...' — flagged or 3★ under Research
- (m'gpt-4*' | m'claude*') & t'Coding...' — compare models for Coding
- t'AI...' & d<7d & !e — recent AI threads excluding errors
- c'bug' & c'fix' & t'Code' — both words appear (use two c'…') in Code

Tip: Press F1 for the Help overlay. For the full language, see docs/cli_filtering_language.md.

## Context management: boundaries and reading
MaiChat splits long exchanges into parts for precise navigation and context selection.
- Shift+O (View Mode): jump to the current context boundary.
- Shift+R (View Mode): cycle reading position modes.

This helps you see which parts of the conversation will be sent to the model and quickly adjust your focus.

Message counter (top-right):
- Format X/Y — Predicted included / Visible pairs. X is what would go into the next request; Y is what’s currently visible after filtering.
- Prefix “(-) ” — The newest message is hidden by your current filter.
- Trim indicator: [S-T]/Y — S pairs sent after trimming, T pairs trimmed out (when the initial prediction didn’t fit the model limit). Can combine with the “(-) ” prefix.
- Tooltip shows extra details: predicted tokens, whether URA-model is active, and how many pairs were trimmed on the last send.

Off‑context visualization (model‑dependent):
- Parts beyond the current context boundary are dimmed and show an “off” badge in the meta line.
- The boundary is computed from model limits (max context) and settings (e.g., chars‑per‑token, user request allowance). Switching models can change how many pairs are “in” vs “off”.
- Use Shift+O to jump to the first in‑context pair.

## New message workflow
1) Pick/create a topic if needed (Ctrl+T in Input Mode).
2) Choose a model (Ctrl+M) and check settings if relevant (Ctrl+,).
3) Compose and send (Enter). Edit-and-resend is available for error rows (e in View Mode).
4) When a new reply arrives, you’ll be at the end of history; use j/k to move across parts, g/G to jump to start/end; star rate if helpful (1/2/3, Space clears the rating).

## Settings and tools
- Settings (Ctrl+,): general app preferences.
- Topic Editor (Ctrl+E): manage the topic hierarchy.
- Model Editor (Ctrl+Shift+M): curate models, TPM/RPM, etc.
- API Keys (Ctrl+K): manage keys.
- Daily Stats (Ctrl+Shift+D): daily breakdown of message stats.

## Model Editor and usage limits
Open the Model Editor (Ctrl+Shift+M) to manage your model catalog and limits.

What you can edit per model:
- Enabled: include/exclude a model from the selector (Ctrl+M). Disabling the active model auto-switches to the next enabled one.
- Context Window (tokens): max context size for that model (from provider docs). This drives the context boundary and trimming.
- TPM / RPM / TPD: tokens per minute, requests per minute, tokens per day. Set these to match your subscription/plan. They’re recorded for budgeting/diagnostics and future rate limiting.

Add custom models: use the Add row to define an ID and numeric limits. Base models can be disabled but not deleted; custom models can be removed.

How limits affect context:
- The boundary is computed per active model: predicted history tokens + reserved new‑request tokens (URA) must fit the model’s context window. If not, MaiChat trims oldest included pairs iteratively.
- Switching models can expand or shrink what’s “in‑context” (dim/off markers update accordingly).

Related Settings (Ctrl+,):
- userRequestAllowance (URA): total new‑message allowance (user prompt + expected assistant response). Default 600. Increase for longer prompts/replies; decrease to include more history.
- charsPerToken (CPT): estimation factor (default 4). Higher CPT estimates fewer tokens per char → includes more history.
- maxTrimAttempts (NTA): number of iterative trims before giving up.

Tips:
- Use the message counter to spot trimming: [S-T]/Y means S pairs sent after trimming T pairs; “(-) ” prefix means the newest pair is hidden by your filter.
- For deep context, pick a model with a larger context window or lower URA. For fewer trims, refine your filter (Command Mode) to include only relevant pairs.
- Optional: append ?reqdbg=1 to the URL to open the Request Debug overlay and inspect predicted tokens, attempts, and included pairs.

## Troubleshooting
- “Keys don’t respond”: ensure you’re in the right mode. Enter/Esc to cycle, or Ctrl+V/I/D to jump.
- “Mouse focus feels off”: the app switches modes when needed; try keyboard-first if unsure.
- “Can’t find a message”: use Command Mode to filter by topic (t'…'), model (m'…'), date (d…), or content (c'…').

## Shipping and where to surface this
Recommended approach:
- Keep this document in docs/tutorial.md for maintenance.
- Add a standalone static page public/tutorial.html for end users (simple HTML, links to the same content).
- Add a Menu item “Tutorial” that opens tutorial.html in a new tab (no app state changes).
- Optionally, add a compact in-app “Quickstart” overlay with just the Quickstart + Keyboard sections.

Rationale:
- Static page is easy to open and read on any device; no coupling to app runtime.
- Keeping content in Markdown makes updates easy and reviewable.
- The in-app quickstart remains small and unobtrusive; full tutorial lives outside the app shell.

## Next steps
1) Approve this outline and copy.
2) I’ll generate public/tutorial.html with terminal-like aesthetics and wire a Menu → Tutorial action.
3) (Optional) Add a “Quickstart” overlay for first-run hinting.
