
### Context Boundary & Token/Image Architecture (Decisions & Plan)

Status: Agreed principles before implementation. Keep changes minimal, isolate per phase, one file per edit when possible.

#### Goals
1. Eliminate per-node DOM mutation pass for off-context styling (single HTML write per render).
2. Make image + text token budgeting predictable and cheap; allow divergence between visual prediction and actual send ONLY due to unknown draft length (URA reserve).
3. Prepare for including histcnorical images in payload assembly without repeated base64 encoding.

#### Token budgeting business logic
1. pair budget = user request budget + assistant response budget + images budget
2. the pair budget is used for 2 purposes: visualization of the context boundary (UI) and payload assembly for the new request (API).
3. the pair components budgets preferably shall be calculated and stored upon events with the pair, not when the boundary is visualized. We need to avoid mass computation on boundary visualization or payload assembly (only incremental calculation are acceptable).
4. User request budget = userCharBudget = userChars / cpt (no fallback for textToken - fill userChars). userChars value is calculated when the message is sent, it's calculated once, stored in object store and used to calculate user budget on the fly given cpt stored in settings (cpt = chars per token parameter configured by users)
2. Assistant response budget. There are several sources of assistant budget with different priority:
- assistantProviderTokens - the value included in the API call response directly representing the number of tokens calculated by the provider (according to the provider tokenizer algorithm). assistantProviderTokens shall be stored in indexedDB together with the response text and used for both boundary and payload calculations.
- assistantCharBudget = assistantChars / cpt  (no fallback - fill assistantChars). assistantChars value is calculated once upon receiving response (when the response is processed) and stored in the object store in indexedDB together with assistant text. It's calculated once, not edited, and used when assistantProviderTokens is unavailable (fallback)
- image bugget. image budget is calculated when the image is attached to the new request. It's calculated based on the image parameters (w, h, resolution, chars etc) according to provider-specific rules (encoded in provider estimators) and stored in the object store (with specified provider). The values are calculated for all four providers (sic!) regardless of the pending model. I.e. we calculated budget for all providers in advance and don't need to recalculate them later if user changes the pending model. Make sure it's clear and there is no misunderstanding? When the payload is assembled or when the boundary is calculated the pre-calculated (and stored) value of the image budget is obtained from the object store (not calculated again).


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
- assistantProviderTokens?: { [providerModelKey]: number }

ImageRecord:
- base64?: { mime: string, data: string }
- tokenCost?: { [providerModelKey]: number }

Helper: providerModelKey(provider, model) => string; for now provider only, forward-compatible with model suffix if ever needed.

#### Estimation Order
For assistant part tokens: assistantProviderTokens[providerModelKey] > (assistantChars / cpt).
For user part tokens: userChars / cpt.
For image tokens: image.tokenCost[providerKey] > compute & cache via provider formula.
Pair total = sum(user + assistant + images).

<!-- Phase Plan section removed; linear sequence below is authoritative. -->

### Linear Implementation Sequence (Authoritative)

This sequence supersedes any grouped/parallel views. Each step targets ≤2–3 files and can be reviewed/committed independently.

S1. MessagePair schema extension (DM1)
- Files: core/models/messagePair.js
- Add optional: userChars, assistantChars, assistantProviderTokens + the same for previous assistant (map). No migrations.

S2. Populate userChars on pair create (DM2)
- Files: features/interaction/inputKeys.js (and/or core/store/memoryStore.js if constructor logic lives there)
- Set userChars = (userText||'').length when adding a pair.

S3. Populate assistantChars on reply (DM3)
- Files: features/interaction/inputKeys.js
- After reply arrives, set assistantChars = (assistantText||'').length.

S4. Estimator: char fallback (DM4)
- Files: core/context/tokenEstimator.js
- In estimatePairTokens, when textTokens missing, prefer (userChars+assistantChars)/cpt with _tokenCache guard.

S5. Render plumbing for included IDs (A2)
- Files: features/history/historyView.js, features/history/historyRuntime.js
- Add optional renderMessages(messages, { includedPairIds }); pipe value without changing HTML yet.

S6. Stamp data-included attribute (A3)
- Files: features/history/historyView.js
- For each top-level .message (or part in message view), set data-included="1|0" when includedPairIds present.

S7. Inline ooc class (A4)
- Files: features/history/historyView.js
- Add class ooc when data-included="0". Keep legacy post-pass intact for now.

S8. Inline off badge text (A5)
- Files: features/history/historyView.js
- When excluded, set assistant meta badge to "off" and data-offctx="1"; else clear.

S9. Remove post-pass styling invocation (A6)
- Files: features/history/historyRuntime.js
- Stop calling applyOutOfContextStyling(); leave deprecated no-op for back-compat.

S10. Boundary approximation flag to localStorage (A9)
- Files: core/context/boundaryManager.js
- After recompute, write maichat_dbg_boundary_approx = 'heuristic'|'mixed'|'provider'.

S11. Stop writing new textTokens (DM5)
- Files: features/interaction/inputKeys.js
- Do not assign textTokens for new pairs; reading legacy values remains allowed.

S12. Optional perf log for render (A11)
- Files: features/history/historyRuntime.js
- When ?perf=1, measure single innerHTML write and store ms in localStorage.maichat_dbg_render_ms.

S13. Background hydration for chars (optional) (DM6)
- Files: runtime/preloadState.js, runtime/runtimeSetup.js
- After preload, batch-fill missing userChars/assistantChars from stored text; mark boundary dirty once.

S14. Image record base64 field (DM7)
- Files: features/images/imageStore.js
- Add optional base64 { mime, data } to record shape; no migration yet.

S15. Lazy base64 persistence (DM8)
- Files: features/images/imageStore.js
- encodeToBase64(id): if cached base64 present, return; else compute, store, and return.

S16. Image tokenCost map (DM9)
- Files: features/images/imageStore.js
- Add optional tokenCost { [providerKey]: number } to record.

S17. Compute/cache tokenCost on demand (DM10)
- Files: features/compose/pipeline.js (send-time) and/or core/context/tokenEstimator.js (estimator path)
- When tokenCost[providerKey] missing, compute via provider formula, persist, and use.

S18. Estimator sums image costs for pairs (Phase B align)
- Files: core/context/tokenEstimator.js
- For pair attachments, sum image tokenCost for current pending model’s provider (compute+cache if missing).

S19. Payload: include historical images (Phase C)
- Files: features/compose/pipeline.js
- Build attachments = images from included history pairs + new message; de-duplicate and cap per quotas; use cached base64.

S20. Telemetry to localStorage for image send (Phase C)
- Files: features/compose/pipeline.js
- Persist compact debug: historyImageCount, historyImageTokenSum to maichat_dbg_pipeline_presend.

S21. Provider usage assimilation (optional) (Phase D)
- Files: infrastructure/provider/*Adapters.js, features/compose/pipeline.js, core/context/tokenEstimator.js
- If provider returns usage tokens for assistant, store in assistantProviderTokens[providerModelKey]; estimator prefers it for that part.

S22. Documentation and cleanup
- Files: this document; remove reliance on textTokens in code paths where char/tokenCost are authoritative; note deprecation.

- swapping messages - swapping budget counts.

### Linear Progress Log (to update incrementally)
- [ ] S1 schema extension
- [ ] S2 userChars on create
- [ ] S3 assistantChars on reply
- [ ] S4 estimator char fallback
- [ ] S5 render plumbing
- [ ] S6 data-included attributes
- [ ] S7 inline ooc class
- [ ] S8 inline off badge
- [ ] S9 remove post-pass
- [ ] S10 boundary approx localStorage
- [ ] S11 stop new textTokens writes
- [ ] S12 perf log localStorage
- [ ] S13 hydration for chars
- [ ] S14 image base64 field
- [ ] S15 lazy base64
- [ ] S16 image tokenCost map
- [ ] S17 compute/cache tokenCost
- [ ] S18 estimator sums image costs
- [ ] S19 payload historical images
- [ ] S20 image telemetry localStorage
- [ ] S21 provider usage assimilation
- [ ] S22 docs & cleanup

#### Data Model Update & Population (Explicit Steps)

These steps ensure new fields exist and are populated safely, each scoped to ≤2–3 files.

DM1. MessagePair schema extension
- Files: `src/core/models/messagePair.js`
- Add optional fields: `userChars`, `assistantChars`, `assistantProviderTokens` (map). Defaults undefined.
- Note: No breaking reads; store is schemaless but we document defaults.

DM2. Populate `userChars` on pair create
- Files: `src/features/interaction/inputKeys.js`, `src/core/store/memoryStore.js` (only if constructor lives there)
- When adding a pair, set `userChars = (userText||'').length`.

DM3. Populate `assistantChars` on reply
- Files: `src/features/interaction/inputKeys.js`
- After provider reply, set `assistantChars = (assistantText||'').length`.

DM4. Estimator char fallback
- Files: `src/core/context/tokenEstimator.js`
- In `estimatePairTokens`, if `textTokens` missing, prefer `(userChars+assistantChars)/cpt` with `_tokenCache` guard.

DM5. Stop writing `textTokens` for new pairs
- Files: `src/features/interaction/inputKeys.js`
- Remove new writes to `textTokens`. Continue reading legacy values if present.

DM6. Background hydration (optional, batch)
- Files: `src/runtime/preloadState.js`, `src/runtime/runtimeSetup.js`
- One-shot pass after preload: for pairs missing `userChars/assistantChars`, compute from current texts and `store.updatePair` in small chunks; mark boundaryMgr dirty once after batch.

DM7. Image record base64 field
- Files: `src/features/images/imageStore.js`
- Extend stored record with optional `base64: { mime, data }`. Do not migrate existing; fill lazily.

DM8. Persist base64 lazily
- Files: `src/features/images/imageStore.js`
- On encode helper `encodeToBase64(id)`: if already present in record, return cached; else compute, store, and return.

DM9. Image tokenCost map
- Files: `src/features/images/imageStore.js`
- Add optional `tokenCost: { [providerKey]: number }`. No migration; compute lazily and persist.

DM10. Compute & cache tokenCost
- Files: `src/features/compose/pipeline.js` (send-time), later `src/core/context/tokenEstimator.js` (estimator path)
- When image cost needed and missing: compute via provider formula, persist in record, use value.

DM11. Boundary approximation visibility (localStorage)
- Files: `src/core/context/boundaryManager.js`
- After recompute, write `localStorage.maichat_dbg_boundary_approx = 'heuristic'|'mixed'|'provider'`.

DM12. Progress logging
- Files: this document
- Maintain a checklist reflecting DM1–DM11 landing order.

#### Data Model Progress Log (to update incrementally)
- [ ] DM1 schema extension
- [ ] DM2 userChars on create
- [ ] DM3 assistantChars on reply
- [ ] DM4 estimator char fallback
- [ ] DM5 stop new textTokens writes
- [ ] DM6 background hydration
- [ ] DM7 image base64 field
- [ ] DM8 lazy base64 persist
- [ ] DM9 image tokenCost map
- [ ] DM10 compute/cache tokenCost
- [ ] DM11 boundary approx in localStorage
- [ ] DM12 doc updated