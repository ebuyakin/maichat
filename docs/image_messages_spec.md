# Image Messages (Phases 3–4)

Status
- Draft for implementation. Scope intentionally minimal, performance-first.

Goals (do a few things very well)
- Support screenshots/images in user messages for vision-capable models (and all models in the current model catalog are vision-capable, no text-only model is expected to be included).
 - PDF attachments: deferred to next version (out of scope for v1), to keep scope tight and avoid heavy viewer/tokenization work.

### Token estimation architecture (images + text)

**Current approach (Phase 1):**
- All token estimation centralized in `src/core/context/tokenEstimator.js`.
- Text: simple heuristic (chars/4).
- Images: conservative baseline using OpenAI detail:high tile formula (85 + tiles×170).
  - Tiles = ceil(w/512) × ceil(h/512).
  - Applied uniformly across all providers.
- Budget calculation in pipeline uses these estimates to prevent context overflow.

**Future architecture (deferred to Phase 2+):**
- **Pattern B: Provider adapters** (agreed architectural direction).
- Provider-specific token counters live in `src/features/providers/{providerId}/tokenCounter.js`.
- `tokenEstimator.js` delegates to provider adapters when available, else falls back to heuristics.
- Benefits:
  - Co-location: token logic lives with provider's sendChat adapter.
  - Extensibility: add new providers by adding a tokenCounter module; no core changes.
  - Lazy-loading: heavy tokenizers (tiktoken, etc.) only loaded when needed.
  - Testability: mock provider counters easily; test core logic independently.
- Migration path:
  1. Add `providers/registry.js` to map providerId → tokenCounter.
  2. Implement provider-specific counters (e.g., `openai/tokenCounter.js` with tiktoken for text, exact tile formula for images).
  3. Update `estimateTokens()` and `estimateImageTokens()` to call `getProviderTokenCounter(providerId)?.estimate*()` if available.
  4. No changes to call sites (pipeline, budgetMath continue calling generic functions).

**Image token research summary:**
- OpenAI: 85 + (tiles × 170) where tiles = ceil(w/512) × ceil(h/512); detail:high mode.
- Anthropic: ~1200–1500 tokens for typical screenshots; ~2500–3000 for 2048×1536.
- Gemini: ~260 tokens per 768×768 tile; ~400–1200 for typical images.
- Conservative estimate: OpenAI formula used as baseline (highest token cost among providers).

**Typical costs (Phase 1 baseline):**
- 512×512: ~255 tokens
- 1024×768: ~765 tokens
- 2048×1536 (our downscale cap): ~2125 tokens
- Keep history rendering fast (no image I/O while scrolling or re-rendering).
- Keyboard-first workflow, consistent with code/equations.

Terminology & naming (critical to avoid collisions)
- Legacy “parts” = message navigation units in history (e.g., activeParts). We do not revive or extend this concept.
- New feature uses minimal attachment model; avoid “parts”. Preferred terms:
  - attachments: string[] of imageIds on MessagePair (attach order preserved)
  - imageStore: IndexedDB table with image blobs and metadata
  - image overlay: fullscreen/lightbox modal to view attached images
  - Helper names: attachImagesFromClipboard(), attachImagesFromPicker(), openImageOverlay(index)

Contract (concise)
- User message remains a single text field (userText) plus zero or more image attachments.
- Attachments are referenced by imageIds in attach order: attachments: string[]
- Images live in a separate IndexedDB store (imageStore) and are not loaded during history rendering.

Token count caching (new)
- Each MessagePair stores precomputed token counts:
  - `attachmentTokens`: sum of `estimateImageTokens(w,h)` over all attachments.
  - `textTokens`: sum of text tokens for `userText` + `assistantText` (using current heuristic estimator).
- Computed once at send time and persisted with the pair (texts are immutable post-send; safe to cache).
- Boundary estimation and budget previews use `textTokens + attachmentTokens` (no per-image reads during UI preview).
- Migration: for existing pairs missing these fields, compute lazily once and persist.

Data model
- MessagePair additions (user side):
  - attachments?: string[]  // imageIds in attach order (append-only semantics per send)
  - attachmentTokens?: number // precomputed total image tokens for this pair (sum over attachments)
  - textTokens?: number // precomputed total text tokens for this pair (userText + assistantText)
  - responseMs?: number // provider-reported request processing time in milliseconds
- Images store (IndexedDB):
  - { id: string, blob: Blob, format: 'jpeg'|'png'|'webp', w: number, h: number, bytes: number, createdAt: number, refCount: number }
  - refCount increments on attach, decrements on detach/delete; delete when 0.

Quotas & sizing
- Per-message caps: maxImagesPerMessage = 4; maxTotalBytesPerMessage ≈ 20–30 MB.
- Global cap: maxImageStoreBytes ≈ 300–500 MB (soft warn at 80%, hard block at 100%).
- Ingest policy: downscale to longest edge ≤ 2048 px; JPEG quality ≈ 0.8; convert HEIC → JPEG if possible; otherwise show friendly error.

Rendering (history)
- No image decoding or blob URL resolution in history rendering, re-rendering, or active changes.
- User messages display a compact marker at the end of the text when attachments exist:
  - Icon + N (e.g., 🖼︎ 3). If N = 1, number may be omitted.
  - Clicking the marker opens the image overlay on the first image.
- Single DOM write preserved.

Keyboard
- View mode (active message):
  - i: open image overlay (first attachment if multiple).
  - i + [1–9]: open Nth attachment directly (pending behavior identical to code/equations).
  - Overlay: j/k (prev/next), Esc close.
- Input mode (drafted message):
  - Ctrl+F: open native file picker (attach). Not a modal overlay; uses hidden input[type=file].
  - Cmd+V: paste image(s) to attach.
  - Ctrl+Shift+O: open image overlay for the drafted message (first attachment), or Ctrl+Shift+O + [1–9] for Nth.
  - In overlay (Input mode only): j/k (prev/next), Esc close, Delete/Backspace or x removes the currently viewed image from the draft (with confirm prompt if >1 image attached).
    - Rationale: cannot use plain “i” while typing; Ctrl+Shift+O is cross-mode and does not collide with browser devtools on macOS. We also support Ctrl+Shift+O in View mode as an alternative for consistency.

Provider mapping (send time)
- Build payload as [text first, then each attachment in order]:
  - OpenAI Responses: { type: 'input_text' }, then { type: 'input_image', image_url or base64 }.
  - Anthropic Messages: { type: 'text' }, then { type: 'image', source: { type: 'base64', media_type, data } }.
  - Gemini: text part followed by inline_data { mime_type, data } entries.
- Base64 encoding happens on demand from IndexedDB blobs at send time (async, non-blocking UI). We do not persist base64.
- If the selected model is not vision-capable and attachments exist, prompt to switch model or continue without images.

Input composition
- We keep the plain textarea (no WYSIWYG). No interleaving. Images are attachments only.

Options evaluated
1) Attach-only (chosen): images as attachments, appended after text for provider payloads. Simple, clear mental model.
2) Inline tokens: rejected (complexity, little user benefit; unusual UX vs standard chat UIs).
3) Multi-part composer overlay: deferred (heavy UI, not needed for primary workflows).

Chosen approach (v1)
- Attach-only with ordered list of imageIds. Behavior:
  - Paste (Cmd+V) or pick files (Ctrl+F) to attach; indicator near input shows 🖼︎ N.
  - On send: send text first, then each image in attach order for providers.
  - In View or Input, open attachments with i / Ctrl+Shift+O shortcuts (see Keyboard).
  - Rationale: minimal cognitive load, minimal changes to data model, maximal performance.

Drag-and-drop readiness
- Architecture unifies ingest via imageStore.attach(files|clipboard|dataTransfer).
- Future drag-and-drop will call the same attach pipeline; no changes required to the data model or send mapping.
-

UX summary (input)
- Cmd+V (paste image): attach image(s); show 🖼︎ N indicator near Send.
- Ctrl+F (pick files): native file picker; attach in chosen order.
- Ctrl+Shift+O / Ctrl+Shift+O + digit: open drafted attachments overlay / Nth.
- Soft validation on send: enforce per-message caps and total bytes; clear error messages on violation.

Performance
- History: unchanged; single write; no image I/O on scroll, re-render, active change, or metadata edits.
- Send: base64 encoding performed asynchronously on demand (per image) and overlapped with network send; visible state shows “sending…”.
- Overlay: on demand read blob by id from IndexedDB and create/reuse an object URL.

Non-goals (for now)
- Drag-and-drop, annotations, cropping, image editing.
- Assistant-generated images.
- Global gallery or cross-message navigation.
 - PDF attachments support (deferred; see Goals).

Edge cases
- Very large images: downscale or reject with guidance.
- HEIC unsupported: show error; suggest PNG/JPEG screenshot.
- Exceeding quotas: provide clear error; suggest removing some attachments.

Rollout
- Step 1 (infra): imageStore + paste/attach + provider mapping; input indicator 🖼︎ N; message badge at end of text.
- Step 2 (view): image overlay with j/k; view/input shortcuts.
- Step 3 (polish): drag-and-drop; storage management; quota UI.

Notes
- We keep the philosophy: single-write rendering; overlays are true modals; keyboard-first; privacy-first.

## Current status (2025-10-25)

Implemented
- Data model: MessagePair.attachments: string[] (default []); legacy backfill.
- Image store: IndexedDB (maichat-image-store-v1) with blob records, totals, refCount.
- Ingest: file picker (Ctrl+F) and paste (Cmd+V) in Input mode.
- Caps: per-message count (≤4) and total bytes (≤30MB) enforced; overflow immediately detached.
- Input indicator: small icon + count near Send; informational only (no delete action).

Not yet implemented
- Provider payload mapping (text then images), send pipeline wiring.
- History message badge (icon + N) and click-to-open (View mode).
- Image overlay viewer for View mode (read-only) with j/k and Esc.
- Explicit UI errors/notices for caps/HEIC (currently console warnings only).
- Tests and keyboard reference updates.

Open question (tracked)
- Finalize deletion semantics and visibility: indicator click currently removes from draft and calls detach on images; object-store removal happens when refCount reaches 0 (see RefCount semantics below).

## Implementation Plan (trackable)

1) Data model & quotas (done) [x]
- MessagePair: attachments?: string[] (imageIds in attach order).
- Image store schema: { id, blob, format, w, h, bytes, createdAt, refCount }.
- Quotas: ≤4 images/message; ≤20–30MB/message; ~300–500MB global (warn 80%, block 100%).
- Migration: existing messages default to attachments = [].

2) Storage module (done) [x]
- features/images/imageStore.js: init, stats, get/getMany, attachFromFiles, attachFromClipboard, detach/purge, encodeToBase64.
- Downscale/convert on ingest; EXIF orientation normalization; enforce caps; compute metadata; manage refCount.
- ID: UUID v4 strings; collisions practically impossible.

3) Input mode — attach & manage (done) [x]
- Ctrl+F picker and Cmd+V paste attach paths wired to imageStore.
- Per-message caps enforced (count and total bytes) with immediate detach of overflow.
- Minimal indicator in input row (🖼︎ N). Click: clear all. Shift+click: remove last.
- Paste reliability across browsers (detect items and files).

4) Input mode — view attached images (next) [x]
- Overlay viewer for the draft: Ctrl+Shift+O (or Ctrl+Shift+O + digit).
- In overlay: j/k prev/next, Esc close, Delete/Backspace or x removes the current image from the draft.
- Lazy blob load; object URL lifecycle (create on show, revoke on close); focus trap & aria labels.

5) Token estimator for images. 
- generic image token estimator for now (with potential extenstion to more accurate provider specific token estimator deferred to the next version). Integration of the images into pipeline (provider-agnostic part). [x]

7) Cache attachmentTokens and textTokens for pairs (performance) (swapped order with 6)
- On send, compute and persist on the new MessagePair:
  - `attachmentTokens = sum(estimateImageTokens(w,h))` over all attachments
  - `textTokens = estimateText(userText) + estimateText(assistantText)`
- Budget math (boundary estimation) uses `textTokens + attachmentTokens` (no image I/O during preview).
- Lazy migration: for existing pairs missing these fields, compute once and persist. [x]

6) Send pipeline integration (per provider)
- Compose payload by appending image parts after text; base64 on demand via imageStore.encodeToBase64(id).
- Abort/cancel: if send is aborted, release any transient buffers promptly.
 - Record `responseMs` from provider response metadata and persist on the MessagePair (used by daily stats).


8) History rendering (badge only)
- historyView.js: append an end-of-line badge (icon + N) for user messages with attachments; clicking opens overlay. No <img> tags.

9) View mode overlay (after badge)
- features/history/imageOverlay.js using openModal: j/k navigate, Esc close, optional digit jump.
- Lazy load blobs via imageStore.get(id); create object URLs; reuse during session; revoke on close.
- Accessibility: focus trap, aria-labels, keyboard-only operable.

10) Boundary estimation with images
- computeContextBoundary uses cached `textTokens + attachmentTokens` (fast path).
- If missing for a given pair, lazily compute and persist (one-time cost).

11) Errors & caps UX
- Clear messages for per-message/global caps; HEIC guidance; near-quota warnings; unsupported mime fallback.

12) Keys & reference docs
- Keys: View → i / iN; Input → Ctrl+F (picker), Cmd+V (paste), Ctrl+Shift+O (+digit) open drafted attachments overlay / Nth.
- Update keyboard_reference.md accordingly.

13) Tests (minimal set)
- imageStore ingest, downscale, caps, metadata, refCount lifecycle.
- Paste & Ctrl+F attach flows; pending meta updates; indicator count.
- Provider payload order and base64 shape; non-vision prompt.
- Overlay: open/close, j/k navigation, Nth open; object URL lifecycle and revocation

Additional considerations (quick checklist)
- Memory: base64 encoding is bounded by caps; no streaming needed; avoid keeping large buffers after send.
- Object URLs: never log; revoke on overlay close; cache during overlay session only.
- Privacy: no external fetches; blobs never leave client except via provider API on send.
- Cross-platform keys: Ctrl+F is safe on macOS (Cmd+F is browser find). On Windows/Linux provide a visible Attach button as fallback if needed.
- Drag-and-drop: future DnD calls imageStore.attachFromDataTransfer(); pipeline remains unchanged.
 - Daily stats: compute averages using `responseMs` captured on MessagePairs.

### RefCount semantics (draft and messages)
- On attach to draft: imageStore saves record with refCount=1.
- Clearing/removing from draft: we call detach(id). If refCount becomes 0 → the record is deleted from the image store and totals updated.
- On send: the same reference persists for the saved MessagePair (no extra increment needed if the image was attached only to this draft). If in the future we allow attaching the same image to multiple drafts/messages, we incrementRef() for each additional reference and detach on removal/delete.
- On message delete (future): decrement refs for all attachments; delete records where refCount reaches 0.

### Iconography spec (indicator and message badge)
- Style: 2D contour/outline, monochrome, no shadows/gradients; consistent with link icon in assistant meta line.
- Size: ~12–14px height in input/meta rows; align optically with baseline and text metrics.
- Color: use a muted foreground var (e.g., var(--text-dim) or equivalent), with hover state slightly brighter; no fill.
- Form: simple photo frame glyph or landscape outline; single-weight stroke (~1px). Avoid visual noise.
- Accessibility: aria-label on the indicator/badge; count shown as adjacent text (e.g., “🖼︎ 3” or icon + 3).


# BE AWARE OF THE FILES IN ACTIVE DEVELOPMENT (RECENTLY CHANGED):

docs/image_messages_spec.md
src/core/context/tokenEstimator.js
src/core/models/messagePair.js
src/core/store/memoryStore.js
src/features/compose/pipeline.js
src/features/images/draftImageOverlay.js
src/features/images/imageStore.js
src/features/images/quotas.js
src/features/interaction/inputKeys.js
src/main.js
src/runtime/runtimeSetup.js
src/styles/components/input.css
