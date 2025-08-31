# Main Window Layout Specification

Status: Updated for M5 (anchoring & partitioning incorporated)

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
| History Workspace | `#historyPane` | Scrollable chronological list of message pairs (decomposed into parts). Only this middle zone scrolls; top and bottom bars remain fixed. | Message parts (navigable) + non-focusable meta rows. |
| Input Bar | `#inputBar` | User prompt entry (INPUT mode). Two-row structure: row 1 full-width prompt input; row 2 left cluster (mode label, model, topic) + right-aligned Send button. | Prompt input, mode label, model, topic, send button. |

Decision: The command input lives in the Top Bar; the bottom Input Bar is exclusively for composing user messages. Mode label lives ONLY in the Input Bar (second row, left cluster) and never appears in the Top Bar.

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

## 6. Visual Design & Tokens (Implemented)
Authoritative token set (`:root` in `style.css`):
```
--bg: #0c0c0c;          /* primary middle zone */
--bg-alt: #242424;      /* top/bottom bars & overlays */
--border: #232323;
--border-active: #454545;
--accent: #5fa8ff;      /* accent (reserved) */
--focus-ring: #2b4f80;  /* active part border */
--text: #e6e6e6;
--text-dim: #7a7a7a;
--danger: #f66;
--size-base: 13px;      /* base font size */
--gutter: 16px;         /* unified left alignment */
```

Typography:
* Global UI font stack (VS Code / Copilot Chat style): `-apple-system, BlinkMacSystemFont, "Segoe WPC", "Segoe UI", system-ui, Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif`.
* Monospace stack retained separately for future code blocks; current messages use the UI stack.
* Uniform base size across command input, prompt input, message parts, overlay text (no bold except where semantically required—currently none).

Layout & Spacing:
* Unified gutter ensures left edges of command placeholder, message text, mode label, etc. align vertically.
* History pane vertical bounds computed dynamically (JS `layoutHistoryPane`) from actual bar heights to avoid clipping first/last messages.
* Send button moved to second row right; first row remains pure input field.
* No horizontal separators between message pairs; visual separation via spacing only.

Active Part Styling:
* Single `.part.active` at a time.
* 1px border using `--focus-ring`, subtle tinted background `rgba(40,80,120,0.12)`.
* Internal horizontal padding (default 8px) adjustable (Settings overlay; apply to commit, no live preview).
* Gap between parts (default 6px) adjustable.
* Uniform part padding (all sides) adjustable (Settings overlay; implemented via inner wrapper `.part-inner` so left text gutter remains fixed).
* Granular vertical gaps adjustable (Settings overlay):
  - Outer Gap (top/bottom of scroll content) – `gapOuterPx`
  - Meta Gap (user→meta & meta→assistant) – `gapMetaPx`
  - Intra-role Gap (user→user, assistant→assistant) – `gapIntraPx`
  - Between Messages Gap (pair→pair) – `gapBetweenPx`
* Settings overlay (Ctrl+,) manages rare adjustments (fraction, reading position, padding, gap, zone heights) applied only after selecting "Apply" (no live preview).
* Settings overlay (Ctrl+,) manages rare adjustments (fraction, reading position, uniform part padding, four gap families, zone heights) applied only after selecting "Apply" (no live preview). Spacing updates inject a runtime `<style>` block; anchor for active part is re-applied post-update to maintain reading position.
* Meta row visible but NEVER focusable (excluded from navigation sequence).

Rules (normative):
1. Zones have no decorative borders; only subtle color shift (`--bg` vs `--bg-alt`).
2. Mode switches do not recolor zones.
3. Exactly one active part visualized via focus ring (no thick outlines). 
4. Metadata line background stays transparent; never inherits user part blue.
5. Scrolling is instantaneous (no smooth animation) for positional predictability.
6. Only middle zone scrolls; document overflow hidden.
7. Overlays share `--bg-alt` background and regular-weight text.
8. Inputs: prompt input is borderless (background `--bg-alt`); command input uses minimal 1px neutral border.

Open Styling TBD:
* Refine user part background blue for contrast.
* Adjust active part tint opacity pending accessibility review.
* Timestamp format & dimness finalization.

## 7. Navigation (Implemented / Planned)
Implemented / Planned (M5 focus):
* `j` / `k` (primary) and `ArrowDown` / `ArrowUp` (secondary) move active part.
* `g` / `G`: First / last part (anchored to user-selected reading position via spacer logic).
* `n`: First part of last message (clears new-message badge; re-anchors even if already there).
* `Enter` / `Esc`: Mode cycle as defined above.
* `Ctrl+i` / `Ctrl+d` / `Ctrl+v`: Direct mode activation.
* `*`: Cycle star rating (0→1→2→3→0) for active pair.
* `1` `2` `3`: Directly set star to 1/2/3; `Space` sets 0.
* `a`: Toggle color flag (blue ↔ grey).
## 16. Keyboard Reference (Planned Separate Doc)
See `docs/keyboard_reference.md` for the authoritative, continually updated key mapping. This UI layout spec retains only high‑level rationale.

Planned (not yet implemented):
* `Ctrl+u` / `Ctrl+d`: Half-page up / down.
* Restore last active part when re-entering VIEW from other modes.

Extension Interference:
Browser extensions (e.g. Vimium) may capture plain `j`/`k`. Users should exclude the app origin; we deliberately avoid consuming `Ctrl+j` / `Ctrl+k` so they remain available for future bindings. Arrow keys are a fallback, not a first-class replacement.

Anchoring & Scrolling: Active part positioned at user-selected reading position (Bottom default; also Center / Top). Spacer elements above/below maintain alignment at edges; no smooth scroll animation.
New Message Badge: Top bar right corner; appears when reply arrives and user navigated away or reply filtered out; cleared by `n`, `G`, or badge activation.
Edge Anchoring Mode:
* Adaptive (default): If anchor would create large blank region (content shorter than viewport or out-of-bounds anchor), clamp scroll and suppress spacer so content starts at top (or ends naturally) for better space use.
* Strict: Always enforce anchor via spacer even if large void results.

Decision Clarifications (M5):
* Active restore A1: After partition changes (resize or fraction change) we attempt to keep user near same textual spot approximately (same pair, nearest line) rather than precise hash mapping.
* Filtered reply B2: Using `n` when new reply hidden permanently adjusts filter (simple clear) so reply remains visible; no temporary flash.
* Anchor restoration C1: Restoration order: same part ID → same pair closest region → apply anchor position.
* Pending send D: No extra spinner; cues are cleared input, placeholder assistant entry, and Send button label change; Enter does nothing until reply.

## 8. Commands vs Prompts
* Command field (Top Bar) only interprets command/filter language.
* Input field (Bottom) only composes user prompts; a leading `:` there does not switch semantics (avoiding dual meaning). This removes ambiguity.

## 9. Errors & Feedback
* Command parse errors: inline in Top Bar error span (red, truncated if overly long).
* Prompt send errors (future): transient inline badge in metadata line of the pending / failed pair, plus optional short status text in Top Bar.
* No modal dialogs for routine errors.

## 10. Overlays
Invoked by shortcuts; they never reflow base layout.

Implemented:
| Overlay | Purpose | Trigger | Dismiss |
|---------|---------|---------|---------|
| Topic Quick Picker | Reassign active pair (VIEW) / set pending topic (INPUT) | Ctrl+T | Esc / Enter |
| Topic Editor | Full topic CRUD, mark/paste, search | Ctrl+E | Esc |
| Model Selector | Choose model for pending message | Ctrl+M (INPUT) | Esc / Enter |
| Settings / Preferences | Adjust part size fraction, reading position, padding, gap, top/bottom zone heights (Apply/Cancel) | Ctrl+, | Esc / Apply |

Deferred / Planned:
| Overlay | Purpose | Planned Trigger | Notes |
|---------|---------|-----------------|-------|
| Context Preview | Inspect assembled context before send | p (TBD) | After partition + metadata stabilization |
| Help / Cheat Sheet | Key & command summary | ? | UX polish milestone |

Placement & Styling:
* Center or slight top-center; low-opacity scrim (no blur).
* Focus trap isolation; Esc unwinds current overlay.

## 11. Core Interaction Features (M5 Focus)
1. Deterministic partitioning (viewport fraction → whole-line parts) with persistent active part across re-renders.
2. Anchored navigation (Bottom default; Top/Center optional) with spacer-based stabilization and calm edges.
3. Meta row non-focusable; all metadata actions target pair from any part.
4. Keyboard metadata control (star cycle, numeric stars, include toggle) immediate visual feedback.
5. Topic reassignment via picker from any active part.
6. New message lifecycle: single pending send, auto-focus first assistant part if stationary, badge + n/G when user navigated away or reply filtered.

## 12. Deferred / Future Enhancements
1. Semantic splitting heuristics (headings, code blocks, sentence boundaries, token estimator integration).
2. Virtualization for large histories (>5k pairs / >15k parts) preserving anchor semantics.
3. Streaming assistant responses (progressive part growth, end-follow rules).
4. Context preview overlay (assembled context inspection before send).
5. Help / cheat sheet overlay.
6. Advanced topic/model bulk management UI.
7. Half-page navigation (`Ctrl+u` / `Ctrl+d`) & additional scrolling primitives.

## 13. Open Questions (Revised)
1. Half-page jumps (`Ctrl+u/d`) timing (post-M5?).
2. Mouse affordances for badges (defer?).
3. Semantic splitting (headings/code) scheduling.
4. Indicator styling variants (badge vs bar) future refinement.

## 14. Implementation Notes (Dev Guidance)
* Full region rebuild until perf dictates virtualization.
* Active part state external to DOM for deterministic re-render.
* Partition engine: off-screen measurement + caching; stable IDs when text/settings unchanged; major resize (≥10% height) triggers recompute & active remap.
* Meta rows excluded from parts array.
* Anchoring: compute desired alignment + spacer heights; calm edges (no jitter on boundary navigation).
* Settings overlay (Ctrl+,) manages rare adjustments (fraction, reading position, padding, gap, zone heights) applied only on Apply (no live preview).
* Edge anchoring mode persisted (adaptive|strict); re-anchoring logic re-runs on change without forcing repartition.
* Tests: partition determinism, resize threshold behavior, new message indicator accumulation, active mapping after repartition.

## 15. Rationale
Spec now embeds anchoring & partitioning model for M5, balancing stable reading alignment with future extensibility (semantic splits, virtualization) without structural upheaval.

---
Edits welcome; unresolved items are explicitly listed under Open Questions to prevent silent drift.
