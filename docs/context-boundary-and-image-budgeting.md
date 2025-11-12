
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
For assistant part tokens: assistantProviderTokens > (assistantChars / cpt).
For user part tokens: userChars / cpt.
For image tokens: image.tokenCost[providerKey] > compute & cache via provider formula.
Pair total = sum(user + assistant + images).

### ACTION PLAN

P1. Text token estimation foundation. Establish ground-truth character counts for accurate token estimation without relying on legacy textTokens field. [x]
P1.1 Add userChars and assistantChars fields to MessagePair schema. Files: core/models/messagePair.js [x]
P1.2 Populate userChars when user sends message. Files: core/store/memoryStore.js [x]
P1.3 Populate assistantChars when assistant response arrives. Files: features/compose/sendWorkflow.js [x]
P1.4 Update estimatePairTokens() to prefer char-based calculation over legacy textTokens. Files: core/context/tokenEstimator.js [x]
P1.5 Stop writing textTokens for new pairs, keep reading for backward compatibility. Files: features/compose/sendWorkflow.js [x]
P1.6 Create migration script to hydrate existing pairs with char counts. Files: study/hydrate-chars-migration.js [x]

P2. Boundary visualization with inline styling. Eliminate post-render DOM mutation pass for off-context styling by applying classes and attributes during HTML construction. [x]
P2.1 Add includedPairIds parameter to renderMessages(). Files: features/history/historyView.js, features/history/historyRuntime.js [x]
P2.2 Stamp data-included attribute on message elements during HTML construction. Files: features/history/historyView.js [x]
P2.3 Apply ooc class inline when data-included is 0. Files: features/history/historyView.js [x]
P2.4 Set off badge text inline for excluded messages. Files: features/history/historyView.js [x]
P2.5 Remove applyOutOfContextStyling() post-pass call. Files: features/history/historyRuntime.js [x]

P3. Image infrastructure preparation. Add fields to image records for efficient token estimation and payload assembly without repeated encoding. [x]
P3.1 Add optional base64 field to image record schema. Files: features/images/imageStore.js [x]
P3.2 Modify encodeToBase64() to cache base64 in image record on first encode. Files: features/images/imageStore.js [x]
P3.3 Add tokenCost map field to image record schema. Files: features/images/imageStore.js [x]
P3.4 Create provider-specific image token estimators. Files: core/context/imageEstimators.js [x]
P3.5 Eagerly compute tokenCost for all providers when image attached. Files: features/images/imageStore.js [x]
P3.6 Create migration script to hydrate existing images with tokenCost. Files: study/hydrate-image-tokencosts-migration.js [x]

P4. Token estimation architecture finalization. Rewrite estimator with correct precedence hierarchy and provider-aware image cost calculation. [x]
P4.1 Rename assistantTokens to assistantProviderTokens field. Files: core/models/messagePair.js, study/migrate-rename-assistant-tokens.js [x]
P4.2 Add imageBudgets field to MessagePair for denormalized image metadata. Files: core/models/messagePair.js [x]
P4.3 Populate imageBudgets when attaching images to new message. Files: features/interaction/inputKeys.js [x]
P4.4 Rewrite estimatePairTokens() with correct text and image token precedence. Files: core/context/tokenEstimator.js [x]
P4.5 Make estimator provider-aware for reading image costs. Files: core/context/tokenEstimator.js [x]
P4.6 Update computeContextBoundary() to pass provider ID to estimator. Files: core/context/tokenEstimator.js [x]

P5. Code organization improvements. Extract complex send logic from keyboard handler and remove dead code. [x]
P5.1 Extract send workflow from inputKeys.js to sendWorkflow.js. Files: features/interaction/inputKeys.js, features/compose/sendWorkflow.js [x]
P5.2 Review and remove dead code including unused boundarySnapshot parameter. Files: features/compose/sendWorkflow.js, features/compose/pipeline.js [ ]
P5.3 Fix WYSIWYG bug by updating boundary when pending model changes. Files: features/interaction/interaction.js [ ]

P6. Historical images in payload. Enable AI to reference images from conversation history by including them in API requests. [ ]
P6.1 Collect image IDs from includedPairs in send workflow. Files: features/compose/sendWorkflow.js or features/compose/pipeline.js [ ]
P6.2 Deduplicate image IDs across history and new message. Files: features/compose/sendWorkflow.js or features/compose/pipeline.js [ ]
P6.3 Apply quota caps for MAX_IMAGES_PER_REQUEST and MAX_TOTAL_IMAGE_TOKENS. Files: features/compose/sendWorkflow.js or features/compose/pipeline.js [ ]
P6.4 Use cached base64 from imageStore without re-encoding. Files: features/compose/sendWorkflow.js or features/compose/pipeline.js [ ]
P6.5 Build payload with both historical and new images. Files: features/compose/pipeline.js [ ]
P6.6 Add telemetry to log image counts and token usage to localStorage. Files: features/compose/sendWorkflow.js or features/compose/pipeline.js [ ]

P7. Provider token assimilation. Use provider-reported token counts when available for improved accuracy. [ ]
P7.1 Extract usage.completion_tokens from provider responses. Files: infrastructure/provider/openaiAdapter.js, anthropicAdapter.js, geminiAdapter.js, grokAdapter.js [ ]
P7.2 Store provider tokens in pair.assistantProviderTokens after each reply. Files: features/compose/sendWorkflow.js [ ]
P7.3 Update all provider adapters to extract and return usage data. Files: infrastructure/provider/*.js [ ]
P7.4 Verify estimator uses provider tokens as highest precedence. Files: core/context/tokenEstimator.js [ ]

P8. Performance optimization and cleanup. Eliminate redundant operations and finalize implementation. [ ]
P8.1 Implement sorted pair caching in MemoryStore to eliminate redundant sorts. Files: core/store/memoryStore.js [ ]
P8.2 Remove duplicate sort in renderHistory(). Files: features/history/historyRuntime.js [ ]
P8.3 Add optional performance logging for render times. Files: features/history/historyRuntime.js [ ]
P8.4 Clean up commented-out code and legacy field references. Files: multiple [ ]
P8.5 Update documentation with final architecture. Files: docs/context-boundary-and-image-budgeting.md [ ]
P8.6 Verify all migration scripts tested and documented. Files: study/*.js [ ]

