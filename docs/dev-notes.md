## current tasks, notes and comments. scope for the next release.

Next release focus - accurate context assembly, performance optimization, debugging/tracking tools/infrastructure via localStorage.

### Work approach, constraints:
1. Adhere to the architectural principles of the app. Prior to any update make special in-depth analysis whether the suggested changes match / align with the existing architecture and do not violate separation of concerns, layered organization, code isolation, no-duplication, simplicity and transparency criteria.
2. Minimize code changes. The app has complex dependencies so any change can have potential side effects. Prior to making changes assess possible risks and impact on other components of the app.
3. Performance is the core benefit of the app. Avoid any recommendations that may impact routine operation of the app. Specifically DOM mutations, heavy computations, indexedDB transactions, Network operations. Pay special attention to message history rendering and dynamic updates of the history view - they should be designed to minimize latency, ensure smooth and visually pleasing user experience with minimum distractions. No interface flickeging, flashing or vibrating is acceptable.
4. Implement changes in small steps preferably with one file per edit changes. Coordinate steps with User and let User test intermediate step where appropriate and manage repository commits.

### Raw problems:
1. UI: context boundary rendering - via DOM mutation (performace impact). Marking of off-context messages (color dimming - to settings, badge)  
2. Attachments - only included from the current request. Not all history
3. Messages with variants marking
5. dbg_pipeline_presend - include: token coun (system, user, history), message_count, attachments count.


### Assistant initiation message:
Project Next Phase. Can you use #codebase and #file:docs to review the project and give me a brief summary of its purpose, approah, and current state. Use #file:_docs-inventory.csv as your guide for the documentation. pay attention to documents marked Core. ignore legacy_docs completely.

### Context Boundary & Token/Image Architecture (Decisions & Plan)

Status: Agreed principles before implementation. Keep changes minimal, isolate per phase, one file per edit when possible.

#### Goals
1. Eliminate per-node DOM mutation pass for off-context styling (single HTML write per render).
2. Make image + text token budgeting predictable and cheap; allow divergence between visual prediction and actual send ONLY due to unknown draft length (URA reserve).
3. Prepare for including historical images in payload assembly without repeated base64 encoding.

#### Key Architectural Decisions
1. Separation of concerns maintained: visual boundary and send pipeline remain distinct functions (no forced code reuse); both rely on shared primitive estimators but can evolve independently.
2. Text measurement persistence: store raw character counts (userChars, assistantChars) per pair. Provider-returned token usage (if present later) is optional advisory; we do not block on it. Existing `textTokens` is legacy and not backfilled.
3. Image storage: retain original blob (required for viewing). Add persisted base64 only once per image (lazy on first encode or first send); images are immutable so base64 is stable.
4. Image token cost: authoritative source is a per-provider (future: per provider+model) cached numeric value `image.tokenCost[providerKey]`. No generic fallback beyond computing with that provider’s formula. Boundary always uses current pending model’s provider to sum image token costs.
5. Pair-level attachmentTokens deprecated in favor of summing image tokenCost at estimation time; if present, can be used until removed (transition period).
6. Divergence rules: visualization omits actual draft user prompt length; reserves URA (settings). Otherwise uses same data (chars, image tokenCost, system tokens). Send pipeline refines with real user prompt + iterative trimming.
7. Boundary recompute triggers unchanged (filter/model/settings/pair edits/arrival); adding hydration tasks marks boundary dirty once after batch.

#### Data Model Additions (Non-breaking)
MessagePair:
- userChars: number
- assistantChars: number
- assistantTokens?: { [providerModelKey]: number }

ImageRecord:
- base64?: { mime: string, data: string }
- tokenCost?: { [providerModelKey]: number }

Helper: providerModelKey(provider, model) => string; for now provider only, forward-compatible with model suffix if ever needed.

#### Estimation Order
For assistant part tokens: assistantTokens[providerModelKey] > (assistantChars / cpt).
For user part tokens: userChars / cpt.
For image tokens: image.tokenCost[providerKey] > compute & cache via provider formula.
Pair total = sum(user + assistant + images).

#### Phase Plan
Phase A (Boundary HTML optimization)
- Extend history rendering to accept includedIds; embed `ooc` class and off badge in HTML string.
- Remove `applyOutOfContextStyling()` post-pass (keep stub for back-compat).
- Begin capturing userChars/assistantChars on send/reply (no reader changes yet).
- Boundary estimator still uses existing heuristic; no image changes yet.

Phase B (Image token/data enhancements)
- Introduce base64 persistence (lazy encode first time image is sent or viewed in overlay if send pending inclusion of history).
- Add image tokenCost caching per provider; estimator prefers cached.
- Replace usage of pair.attachmentTokens with dynamic sum of image tokenCost.

Phase C (Historical images in payload)
- Modify send pipeline to gather image IDs from included history pairs + new draft; de-duplicate, cap by provider/app quotas.
- Use cached base64; encode only missing ones.
- Telemetry: add `historyImageCount` and `historyImageTokenSum`.

Phase D (Provider usage assimilation - optional)
- Capture provider reported token usage (if adapter supplies) into assistantTokens map.
- Estimator uses these selectively; add `boundary.stats.approximationLevel` (heuristic|mixed|provider) for HUD/debug.

#### Acceptance Criteria (Phase A)
- Single DOM write for boundary changes; no second mutation loop.
- Off-context badges correct immediately after render.
- No performance regression (measure render time unchanged or improved).

#### Risks & Mitigations
- Risk: HTML building complexity increases → keep logic confined to historyView only.
- Risk: Large image base64 growth → lazy creation + optional cleanup policy later.
- Risk: Provider formulas change → version key on tokenCost so old entries recompute.

#### Tests / Smoke
- Rendering: count `.message.ooc` vs includedIds length.
- Send: ensure no extra DOM mutations (MutationObserver in perf harness optional).
- Image attach: base64 stored once; subsequent sends reuse.

End of boundary & token/image architecture plan.