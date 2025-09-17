## current problem notes and comments.

### Noticed bugs / improvements:

Topic selector - incorrect re-rendering... again...


I’ll inspect the model editor overlay and related model state/update flow to see how closing it triggers re-rendering and whether any bottom-align hook is invoked, then check the settings subscription path for anchor logic. 

Read [](file:///Users/eugenebuyakin/Dev/maichat/src/features/config/modelEditor.js)

Ran terminal command: git --no-pager log -S "openModelEditor({ store, onClose" -n 1 --pretty=fuller -- src/features/interaction/interaction.js

Ran terminal command: git --no-pager show 2b82708c0905aeb1711ed6bcfa2b2cc2b156081a -- src/features/interaction/interaction.js

Got it—I’ll investigate why closing the Model Editor doesn’t bottom re‑anchor and when this deviation was introduced, then share clear recommendations without changing code.

Plan
- Reconfirm the spec for expected behavior.
- Trace the close flow for the Model Editor to see what actually runs (rebuild vs. not, align vs. not).
- Check where bottom-aligning is implemented in code, and whether the Model Editor path goes through it.
- Pinpoint when the regression was introduced (commit-level).
- Provide targeted recommendations.

Spec recap (what should happen)
- File: scroll_positioning_spec.md, section “10. Settings/Model-driven rebuild”
  - Trigger: Only when a settings or model overlay change is classified as requiring a history rebuild.
  - Focus: Preserve previously focused part if it still exists; else focus last part.
  - Position: After rebuild and remeasurement, perform a one-shot bottom anchor on the focused part: `alignTo(focused, 'bottom')`.
  - Mode: Unchanged.
- File: ui_view_reading_behaviour.md (anchoring primitives)
  - AlignTo is a one‑shot action with clamping and tolerance.
  - Navigation/rebuild sections reiterate preserving focus and bottom-align in defined flows.

What actually happens now (observed path)
- Close flow wiring:
  - File: modelEditor.js
    - The overlay is opened with `openModal(...)` passing `beforeClose: () => { onClose && onClose() }` — so your onClose callback runs on any close.
  - File: interaction.js
    - Two places call `openModelEditor({ store, onClose: ... })`:
      - Menu action `runMenuAction('model-editor')`
      - Keyboard `Ctrl+Shift+M` handler
    - Both use the same onClose body:
      - `pendingMessageMeta.model = getActiveModel();`
      - `renderPendingMeta();`
      - `historyRuntime.renderCurrentView({ preserveActive:true });`
      - `modeManager.set(prevMode);`
- Bottom-align logic exists, but not in this path:
  - File: main.js, inside `subscribeSettings(...)`:
    - When the diff result is `action === 'rebuild'`, it calls `renderCurrentView({ preserveActive:true })`, then after a double `requestAnimationFrame` it invokes `scrollController.alignTo(id, 'bottom', false)` for the current focused part.
  - The Model Editor close path bypasses this settings subscription route and never calls `alignTo(...)`.

Root causes of the deviation
1) Unconditional re-render on close:
   - Current onClose unconditionally calls `historyRuntime.renderCurrentView({ preserveActive:true })` even when the user didn’t change anything.
   - Per spec, there should be no rebuild unless changes require one. If nothing changed, we shouldn’t re-render at all.
2) Missing bottom-align for model-driven rebuild:
   - When changes are made (and a rebuild is justified), the onClose path still only re-renders and never bottom-aligns. The only place with explicit bottom-align is the settings subscription’s ‘rebuild’ branch, which this path doesn’t trigger.

When it happened
- Commit: `2b82708c0905aeb1711ed6bcfa2b2cc2b156081a` (Sun Sep 7, 2025)
  - Message: “fix:model editor UI - alignment”
  - Diff shows adding the current onClose handler that:
    - Sets the active model label
    - Calls `historyRuntime.renderCurrentView({ preserveActive:true })`
    - Restores mode
  - There is no bottom-align added there, and a re-render happens unconditionally.
  - Based on history, the deviation likely began with this change: bottom-align wasn’t wired, and rebuild/no-rebuild classification wasn’t respected.

Why you’re seeing it even with no changes
- Because we re-render unconditionally on close, even if you didn’t change anything, and we don’t re-anchor after that render. This both violates the “trigger only on rebuild” rule and the “bottom-align after rebuild” rule.

Recommendations (without fixes yet)
- Avoid unconditional re-render on close:
  - The Model Editor should track a “dirty” state and communicate it to the onClose callback (e.g., `onClose({ dirty: true|false })`).
  - Only rebuild when dirty.
- Route model-driven rebuilds through the same anchoring policy:
  - Two options:
    - Centralize: dispatch a “history rebuild requested” event that the same subscriber in main.js (or a new centralized handler) listens to, applying the same “render + rAF + alignTo('bottom')” sequence.
    - Localize with parity: if you keep the rebuild call in interaction.js, mirror the settings logic: after `renderCurrentView({ preserveActive:true })`, schedule a one-shot `alignTo(focusedId, 'bottom')` after remeasure (e.g., with `requestAnimationFrame`).
- Consistency across related flows:
  - `openModelSelector` onClose uses the same “renderCurrentView” only pattern; ensure it follows the same rebuild+anchor rules.
- Tests to prevent regressions:
  - Add a jsdom test that:
    - Opens Model Editor and closes without changes → assert no `renderCurrentView` call (or at least no scroll change).
    - Saves a model change (e.g. toggling enabled) then closes → assert a single bottom-align is applied post-rebuild.
    - Preserve the focused part across the rebuild and verify bottom-anchor placement is within dead-band tolerance.

If you’d like, I can follow up by drafting the minimal change plan (either centralize the rebuild/anchor trigger, or keep the local path but add the anchor) and add the tests to lock in the behavior per spec.