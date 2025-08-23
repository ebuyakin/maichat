# Main Window Layout Specification

Status: Draft (iterative; authoritative for current UI decisions)

## 1. Core Principles (Normative)
1. Visual Continuity: The three vertical zones (Top Bar, History Workspace, Input Bar) are always present; modes never reflow or hide them.
2. Minimalism: No persistent side panels. The message history is the singular central surface.
3. Keyboard First: Entire UI usable without mouse. Mouse affordances are optional, never required.
4. Low Distraction: No flashing, no layout jumps, no gratuitous borders. Motion is purposeful (e.g. focus scroll).
5. Progressive Disclosure: Secondary surfaces (topics palette, context preview, help) are transient overlays; they never permanently occupy layout space.
6. Consistency > Ornament: Mode changes alter behavior & status label only; they do not recolor or restyle zones.

## 2. Zone Overview
| Zone | ID | Purpose | Persistent Elements |
|------|----|---------|---------------------|
| Top Bar | `#topBar` | Command entry (COMMAND mode), status / mode label, lightweight inline error text. | Mode label, command input field, error span. |
| History Workspace | `#historyPane` | Scrollable chronological list of message pairs (decomposed into parts). Only this middle zone scrolls; top and bottom bars remain fixed. | Message parts only. No side gutters. |
| Input Bar | `#inputBar` | User prompt entry (INPUT mode). Also carries the mode/status label (bottom-left variant if we move label). | User input field (re-used), mode/status label. |

Decision: The command input lives in the Top Bar; the bottom Input Bar is exclusively for composing user messages. Mode label lives ONLY in the Input Bar (bottom-left below the input field) and never appears in the Top Bar.

## 3. Modes & Behavioral Matrix
Modes: VIEW, INPUT, COMMAND.

| Mode | Primary Focus Target | Navigation / Actions | Text Entry | Esc Behavior | Enter Behavior | Direct Shortcuts |
|------|----------------------|----------------------|------------|--------------|----------------|------------------|
| VIEW | Active part in history | j/k, Arrows, g/G, *, a | None | To COMMAND | To INPUT | Ctrl+v (stay) |
| INPUT | Bottom input field | (nav limited) *, a allowed? TBD | User prompt | To VIEW | Send message (stay INPUT) | Ctrl+i |
| COMMAND | Top command field | (edit + history unaffected) | Command filter | Clear filter (stay COMMAND) | Apply filter -> VIEW | Ctrl+d |

Mode Transition Model (cyclical via Enter/Escape):
VIEW --Enter--> INPUT --Esc--> VIEW --Esc--> COMMAND --Enter--> VIEW

Notes:
* In COMMAND, Esc clears filter & keeps mode; Enter applies filter then returns to VIEW.
* In INPUT, Enter sends message and remains; Esc returns to VIEW.
* In VIEW, Enter enters INPUT; Esc enters COMMAND.
* Direct overrides: Ctrl+i / Ctrl+d / Ctrl+v jump modes irrespective of cycle.

Visual Mode Indicator: A textual label (e.g. `[VIEW]`, `[INPUT]`, `[COMMAND]`) is rendered in the Input Bar, bottom-left, just beneath/flush with the input field baseline. It NEVER migrates to the Top Bar (fixed decision). No zone border change.

## 4. Message Data Model (UI Perspective)
A Message Pair renders as an ordered sequence of Message Parts:
1. User Request Parts (1..N)
2. Metadata Line (always exactly one line; badges + inline controls)
3. Assistant Response Parts (1..M)

"Message Part": A logically navigable fragment (splitting occurs only when needed for readability / navigation of long texts). Splitting policy (future): chunk by semantic or size threshold without altering original text content.

No folding/collapsing: The history behaves like an immutable paper roll—parts are linear; we only scroll, never fold or toggle visibility.

## 5. Message Markup (Initial Placeholder)
```
<div class="pair" data-id="PAIR_ID">
  <div class="part user" data-part-index="0">…user text (or first chunk)…</div>
  <!-- additional user parts (optional) -->
  <div class="meta" role="group">
    <span class="model">gpt-4</span>
    <span class="stars">★★</span>
    <span class="topic" data-topic-id="TID">topic-name</span>
    <span class="flags">[in]</span>
    <span class="timestamp" data-ts="…">2025‑08‑23 12:34</span>
  </div>
  <div class="part assistant" data-part-index="U+1">…assistant text…</div>
  <!-- additional assistant parts (optional) -->
</div>
```

## 6. Visual Design & Tokens
Tokens (can map to CSS variables):
```
--bg-app: #000;            /* base canvas if needed */
--bg-zone: #000;           /* history background (very dark) */
--bg-zone-alt: #111;       /* top & bottom bars */
--bg-user: #0d2233;        /* subtle dark blue for user parts */
--bg-assistant: transparent; /* assistant & metadata share zone background */
--bg-meta: transparent;    /* meta line blends with history */
--text-normal: #ddd;
--text-dim: #666;
--accent: #5fa8ff;         /* also used for active part border */
--danger: #f66;
--focus-border: var(--accent);
```

Rules (normative):
1. Zones do NOT have visible borders in steady state; separation is by background color only (`--bg-zone` vs `--bg-zone-alt`).
2. No border / glow change on mode switches (visual continuity).
3. Exactly one message part may be "active" (navigated) — it alone gets a 1px accent border.
4. Non-active parts: no border; rely on padding & spacing.
5. Metadata line background matches assistant (transparent over history) and never adopts user blue.
6. Scrolling never animates; always immediate (paper roll metaphor).
7. Mode label uses dim text color; never changes background; only its string changes.
 8. Only the History Workspace scrolls; Top Bar and Input Bar are anchored (no body/page scroll or rubber-band dragging above/below the middle zone).

Open Styling TBD:
* Final dark blue tone for `--bg-user` to ensure WCAG contrast with text and accent border.
* Timestamp format & dimness threshold.

## 7. Navigation (Implemented / Planned)
Implemented subset:
* `j` / `k` (primary) and `ArrowDown` / `ArrowUp` (secondary) move active part.
* `g` / `G`: First / last part.
* `Enter` / `Esc`: Mode cycle as defined above.
* `Ctrl+i` / `Ctrl+d` / `Ctrl+v`: Direct mode activation.
* `*`: Cycle star rating (0→1→2→3→0) for active pair.
* `1` `2` `3`: Directly set star to 1/2/3; `Space` sets 0.
* `a`: Toggle includeInContext.
## 16. Keyboard Reference (Planned Separate Doc)
See `docs/keyboard_reference.md` for the authoritative, continually updated key mapping. This UI layout spec retains only high‑level rationale.

Planned (not yet implemented):
* `Ctrl+u` / `Ctrl+d`: Half-page up / down.
* Restore last active part when re-entering VIEW from other modes.

Extension Interference:
Browser extensions (e.g. Vimium) may capture plain `j`/`k`. Users should exclude the app origin; we deliberately avoid consuming `Ctrl+j` / `Ctrl+k` so they remain available for future bindings. Arrow keys are a fallback, not a first-class replacement.

Scrolling: Active part is scrolled into a comfortable viewport margin (target middle third or top with small offset — final rule TBD).

## 8. Commands vs Prompts
* Command field (Top Bar) only interprets command/filter language.
* Input field (Bottom) only composes user prompts; a leading `:` there does not switch semantics (avoiding dual meaning). This removes ambiguity.

## 9. Errors & Feedback
* Command parse errors: inline in Top Bar error span (red, truncated if overly long).
* Prompt send errors (future): transient inline badge in metadata line of the pending / failed pair, plus optional short status text in Top Bar.
* No modal dialogs for routine errors.

## 10. Overlays (Deferred)
Invoked by shortcut keys; they do not shift base layout.
| Overlay | Purpose | Trigger (proposed) | Dismiss |
|---------|---------|--------------------|---------|
| Topic Palette | Create / select / rename topics | `t` (VIEW) | Esc / Enter |
| Context Preview | Show assembled context before send | `p` (VIEW/INPUT) | Esc |
| Help Cheatsheet | Key + command language summary | `?` | Esc |

Overlays always center or slight top-center; they dim (but do not blur) the background with a low-opacity scrim.

## 11. Core Interaction Features (Required for MVP)
These are NOT optional; they are central to evaluating usability.
1. Message Splitting: Long user or assistant texts are split into navigable parts (initial algorithm may be size-based; can evolve semantically). Original raw text preserved.
2. Keyboard Metadata Control: Star rating, include/exclude toggle, and (later) topic reassignment invokable via keyboard shortcuts while a part (or its pair) is active.
3. Active Part Navigation: j/k, g/G, (optionally) half-page moves, always maintaining single active part focus.
4. Metadata Line Position & Invariance: Always between last user part and first assistant part.
5. Immediate Visual Feedback: Star/include changes update metadata badges instantly without layout shift.

## 12. Deferred / Future Enhancements
1. Advanced splitting heuristics (semantic boundaries, token estimator integration).
2. Virtualization for very large histories (>5k pairs or >15k parts).
3. Streaming assistant responses (anchoring rules: follow bottom unless user navigated earlier part).
4. Context preview overlay.
5. Help cheatsheet overlay.
6. Advanced topic/model management UI (beyond basic selectors).
5. Help cheatsheet overlay.

## 13. Open Questions (Current)
1. Navigation half-page jumps (`Ctrl+u/d`) — MVP or post-MVP?
2. Metadata badges: clickable with mouse or strictly command/shortcut only in MVP?
3. Exact accent color & border style for active part (contrast tuning pending dark blue finalization).
4. Topic assignment UX: further enhancements (bulk retag, palette) beyond current selector overlays.

## 14. Implementation Notes (Dev Guidance)
* Keep rendering primitive: rebuild region on change (optimize later only if perf issues observed).
* Active part state lives outside DOM (store or UI state module) to allow deterministic re-render.
* Splitting: store original full text; derived parts array computed on demand (stateless) to avoid migration complexity.
* Testing: navigation logic unit-tested with synthetic arrays (no DOM) before integrating into DOM renderer.

## 15. Rationale
This curated spec consolidates decisions and removes earlier contradictions (e.g. zone border highlighting). It formalizes a paper‑like, distraction‑free history while preserving extensibility through overlays and parts-based navigation.

---
Edits welcome; unresolved items are explicitly listed under Open Questions to prevent silent drift.
