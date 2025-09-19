# M24: Multiple Providers (Anthropic, Google)

Status: Draft for review
Owner: Assistant (with Eugene)
Last updated: 2025-09-19

## 1. Objectives
- Add support for at least one additional provider (Anthropic) end-to-end; design in a way that adding Google (Vertex/Gemini) is straightforward.
- Keep MaiChat’s core contracts stable: request assembly, context budgeting (URA), error handling, and UI semantics.
- Maintain security: no secret leakage, client-only fetch, configurable base URLs.

## 2. Scope
- Providers: Anthropic (priority), Google Gemini (follow-up). OpenAI remains supported.
- UI: Model Editor shows provider per model; Model Selector allows choosing models across providers; API Keys overlay collects separate keys.
- Runtime: normalized provider adapter interface.
- Out of scope: streaming (can be staged), tool use/function calling, vision/image modalities.

## 3. High-level architecture
- Provider adapters under `src/infrastructure/provider/` implement a common interface:
  - `sendChat({ modelId, messages, system, temperature, maxTokens, signal }) -> Promise<ProviderResponse>`
  - `countTokens({ modelId, textParts }) -> Promise<TokenEst>` (optional; fallback to CPT)
  - `capabilities(modelId)` returns `{ maxContextTokens, supportsStreaming, supportsSystem, supportsJson }`
- Normalization layer converts provider responses to MaiChat format:
  - `{ text, finishReason, usage: { promptTokens, completionTokens, totalTokens }, providerMeta }`
- Model catalog extended: `model.provider` in `core/models/modelCatalog.js`.

## 4. Request assembly: two-phase design (architectural requirement)
We split every send into two clear phases to ensure provider-agnostic logic remains reusable and testable:

1) Universal preparation phase
   - Responsibilities: URA budgeting and trimming, gathering history pairs, injecting per-topic `system` (if any), and normalizing user options.
   - Output: a normalized envelope independent of provider quirks.
   - Envelope shape:
     - `provider: string` (e.g., `openai`, `anthropic`)
     - `modelId: string`
     - `system?: string` (omitted/empty if none)
     - `messages: Array<{ role: 'user' | 'assistant', content: string }>` (system excluded here)
     - `options?: { temperature?: number }` (no implicit output cap here)
     - `budget: { maxContext: number; inputTokens: number; remainingContext: number }` (computed from URA for current attempt)
     - `userOverrides?: { maxOutputTokens?: number }` (optional per-topic/user explicit cap)
     - `apiKey: string`
     - `signal?: AbortSignal`

2) Provider translation + send phase
   - Implemented by the provider adapter. Maps the envelope into provider-specific payload and headers, performs fetch, and normalizes the response and errors back.
   - Output-length policy (provider stage):
     - If provider requires an output cap (e.g., Anthropic `max_tokens`), adapter computes it from `budget.remainingContext`, clamped by model catalog metadata (recommended caps) and by `userOverrides.maxOutputTokens` if present.
     - If provider does not require a cap (e.g., OpenAI), adapter may omit it entirely, or include a safe cap when a user override is present.
   - Examples: Anthropic promotes `system` to top-level and uses structured content; OpenAI expects `system` as the first message.

Success criteria: With any provider, URA and trimming behavior do not change; only the translation layer differs.

## 5. Contracts

### Request assembly contract (unchanged)
- Input: active model (id, provider), topic params (system, temp, maxTokens), context window budget (URA), compiled messages.
- Output to adapter: params mapped per provider (e.g., Anthropic uses `messages: [{ role, content: [{ type: 'text', text }] }]` and `system` at top level).
- Error classes mapped to: `auth`, `rate-limit`, `quota`, `timeout`, `server`, `bad-request`, `network`.

### Adapter interface (TS-like shape)
```
interface ProviderAdapter {
  sendChat(input: {
    modelId: string
    system?: string
    messages: Array<{ role: 'user'|'assistant', content: string }>
    options?: { temperature?: number }
    budget: { maxContext: number; inputTokens: number; remainingContext: number }
    userOverrides?: { maxOutputTokens?: number }
    apiKey: string
    signal?: AbortSignal
  }): Promise<{
    text: string
    finishReason: 'stop'|'length'|'content-filter'|'tool-calls'|string
    usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }
    providerMeta?: any
  }>
  countTokens?(input: { modelId: string, textParts: string[] }): Promise<{ tokens: number }>
  capabilities(modelId: string): { maxContextTokens: number; supportsStreaming: boolean; supportsSystem: boolean; supportsJson: boolean }
}
```

## 6. Provider-specific behavior and mapping
This section documents how each provider maps MaiChat’s universal envelope into its API, including any required/optional fields and notable differences.

### OpenAI (Chat Completions)
- Endpoint: `POST https://api.openai.com/v1/chat/completions`
- Headers: `Authorization: Bearer <key>`, `Content-Type: application/json`
- Request mapping:
  - `system` → prepend to `messages` as `{ role:'system', content:string }` if present
  - `messages` → as-is (`role` in `{'user','assistant','system'}`; we only send user/assistant here)
  - `temperature` → `temperature` (optional)
  - Output cap:
    - Not required. Omit by default; if `userOverrides.maxOutputTokens` is provided, include `max_tokens` (clamped to safe bounds if desired).
- Response mapping:
  - `text` ← `choices[0].message.content`
  - `usage` ← `{ promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens, totalTokens: usage.total_tokens }`
  - Error mapping: 401→auth, 429→rate, 5xx→server, others→network/bad-request

### Anthropic (Messages API)
- Endpoint: `POST https://api.anthropic.com/v1/messages`
- Headers: `x-api-key: <key>`, `anthropic-version: 2023-06-01`, `Content-Type: application/json`
- Request mapping:
  - `system` → top-level `system`
  - `messages` → array of `{ role, content: [{ type:'text', text }] }` blocks
  - `temperature` → `temperature` (optional)
  - Output cap (required):
    - Must include `max_tokens`.
    - Compute as: `min(modelCapMax, max(userOverride, autoRemaining))`, where:
      - `autoRemaining = max(0, budget.remainingContext - safetyMargin)`
      - `modelCapMax` and `safetyMargin` come from model catalog and/or settings
      - When `userOverrides.maxOutputTokens` is present, clamp to `autoRemaining` to avoid overflow
- Response mapping:
  - `text` ← join `content[]` `'text'` blocks
  - `usage` ← `{ promptTokens: usage.input_tokens, completionTokens: usage.output_tokens, totalTokens?: number }`
  - Error mapping: 401→auth, 429→rate, 5xx→server, 400→bad-request (include message)

Notes and differences to keep in mind
- System message placement differs (OpenAI: first message; Anthropic: top-level `system`).
- Stop sequences differ in naming (`stop` vs `stop_sequences`). We’ll map only when exposed in UI.
- Streaming protocols differ; out of scope for M24.
- Anthropic requires `max_tokens`, OpenAI does not. We avoid imposing caps in the universal phase; adapters decide based on provider rules, `budget`, and model meta.
- Rate limits (see dedicated section below) differ: OpenAI uses a combined total tokens-per-minute (TPM); Anthropic treats configured `tpm` as input TPM while we add an explicit `otpm` (output TPM) for completion ceiling. Core history packing algorithm (C = min(cw, tpm)) is identical for both.

## 7. Output-length policy (universal vs provider stage)
- Universal phase:
  - Computes `budget` only (no implicit output cap), and passes any explicit user/topic override.
- Provider stage:
  - For providers requiring a cap, adapters compute and apply it using `budget`, model metadata, and optional overrides.
  - For providers where a cap is optional, adapters omit it unless a user override is present.

## 8. Onboarding (keys)
- On first load (or when selecting a model), if the active model’s provider key is missing, open the API Keys overlay to prompt key entry. Keys persist locally (BYOK); no network relay.

## 9. UI changes
- Model Editor
  - Add a non-editable `Provider` column for existing models; for new models, provider is selected from a dropdown.
  - Add an editable OTPM field, that will contain output tokens per minute limit for those models where this limit is relevant (ie Antrhopic models) and will remain empty for others.
  - Add 'Assistant Response Allowance (ARA)' setting into the settings overlay.
  - Validation: enforce unique id within provider namespace; mark active model provider visibly.
- Model Selector
  - No changes (per EB). Models remain unique; selection UX unchanged.
- API Keys overlay
  - Add fields for Anthropic and Google API keys, stored separately; never sent to logs.

## 10. Settings / Persistence (BYOK only)
- Users obtain their own provider keys and enter them locally.
- Keys are stored locally and used only on the client for direct calls.
- Namespaced keys (example): `maichat.key.openai`, `maichat.key.anthropic`, `maichat.key.google`.
- Models are stored in the existing catalog with a new `provider` attribute; defaults include a few Anthropic/Gemini entries (disabled by default until a key is present).

## 11. Networking (BYOK)
- Client `fetch` with configurable base URLs:
  - OpenAI: `https://api.openai.com/v1/chat/completions`
  - Anthropic: `https://api.anthropic.com/v1/messages` (requires headers: `x-api-key`, `anthropic-version`)
  - Google: `https://generativelanguage.googleapis.com/v1beta/models/:model:generateContent?key=...`
- CORS considerations: depending on provider/browser, direct calls may be blocked; users can configure their own proxy if needed, but MaiChat ships as a pure client and does not include a relay.

## 12. Error handling
- Normalize provider-specific errors to common error types + user-friendly messages:
  - 401→`auth`, 429→`rate-limit`, 403/insufficient_quota→`quota`.
  - Network fetch failures → `network`.
  - Adapter-level parse errors → `server` or `bad-response` with raw snippet.

## 13. Token accounting
- Phase 1: use existing CPT fallback (charsPerToken) for non-OpenAI models.
- Phase 2: adapter `countTokens` for Anthropic/Google if viable without heavy dependencies.

## 14. Security notes (BYOK)
- Keys live only on the user’s machine. Never log keys; mask in UI.
- Optional "Encrypt locally" (WebCrypto + passphrase) can protect at-rest storage (e.g., in localStorage/IndexedDB); this improves local security but cannot fully protect against a compromised browser/runtime or malicious extensions.

## 15. Incremental delivery plan (single path, sequential)
Principles:
1. One clear code path at every step (no dual/legacy branches kept).
2. Small, testable increments so the UI can be exercised after each step.
3. Remove transitional code immediately once replaced.

Step 1: Metadata & UI Scaffolding
- Add `otpm` (optional) to model catalog entries; default undefined. Ensure all existing models have an explicit `provider` (fallback `openai`).
- Add `assistantResponseAllowance` (ARA) to settings (default value; configurable in Settings overlay).
- Extend Model Editor: new editable `OTPM` column (K tokens), keep Provider column (already present).
- Extend Settings overlay: input for ARA (labelled “Assistant Response Allowance (ARA)”).
- No change yet to request assembly or adapters.

Step 2: Budget Math Integration (Full Replacement)
- Create `budgetMath.js` implementing Section 21: compute C, HLP, predicted inclusion, H₀, then after user message length compute HLA, final trim, H, inputTokens, R.
- Refactor `pipeline.js` to use the new math exclusively (delete old prediction & iterative overflow trimming loop logic at this point).
- Emit budget object `{ maxContext: C, inputTokens, remainingContext: R }` and pass through to adapters.
- Update request debug overlay to display the new symbols (C, URA, ARA, PARA, HLP, HLA, H₀, H, R, UTMO, otpm).

Step 3: Anthropic Output Cap Logic
- Enhance Anthropic adapter: always set `max_tokens = min(R, otpm?, UTMO?)` (ignoring undefined). Overflow error if < 1.
- OpenAI adapter: continue to set `max_tokens` only when UTMO override present.
- Add or adjust tests for budget math + Anthropic cap calculation.

Step 4: Capabilities & Error Mapping Polishing
- Add `capabilities()` method stubs returning static data per provider (supportsSystem, supportsStreaming=false for now, supportsJson=false).
- Tighten Anthropic error parsing (context length, auth, quota distinctions) and normalize codes.

Step 5: Documentation & Cleanup
- Add `docs/TECH_REF_BUDGET.md` summarizing formulas with a worked example.
- Remove any stray comments referencing legacy prediction logic.
- Update this spec’s status to reflect completion of Steps 1–4.

Step 6 (Optional / Later): Google (Gemini) Stub
- Add `googleAdapter.js` skeleton using the same budget object; not enabled until a key is provided.

Out of Scope (for current cycle): streaming, function/tool calling, local encryption.

Testing After Each Step
- Manual: send OpenAI request, verify unchanged behavior; when Step 3 is done test Anthropic model (happy path + wrong key + large prompt near window).
- Automated: unit tests for `budgetMath`, Anthropic cap computation.

## 16. Acceptance criteria
- Enter Anthropic API key locally, select an Anthropic model, send a message, and receive a response. Auth and rate-limit errors are normalized.
- Model Editor lists provider and allows adding/enabling an Anthropic model.
- No regressions for OpenAI models.

## 17. Risks and mitigations
- CORS blocks in browsers → provide proxy URL setting and doc a simple local proxy.
- API request differences → adapter isolates mapping; add unit tests with recorded examples.
- Token budget mismatch → start with CPT fallback; visually indicate when a model uses approximated budget.

## 18. Open questions
- Streaming: add `stream=true` later; align scroll and part-splitting.
- Safety filters: map content-filter stop reasons consistently.
- Per-provider system message rules: ensure system is at top level for Anthropic.

## 19. File changes (sequential plan)
Core & Math
- `src/core/context/budgetMath.js` (new) — Section 21 formulas & trimming.

Model Catalog & Settings
- `src/core/models/modelCatalog.js` — add `otpm` field (optional) and ensure every model has `provider`.
- `src/core/settings/index.js` — add `assistantResponseAllowance` (ARA) default.

Pipeline
- `src/features/compose/pipeline.js` — replace old prediction & trimming with `budgetMath` usage; emit spec budget object.

Adapters
- `src/infrastructure/provider/anthropicAdapter.js` — add output cap computation using R, otpm, UTMO.
- `src/infrastructure/provider/openaiAdapter.js` — (minor) ensure `max_tokens` only when UTMO provided.
- `src/infrastructure/provider/adapter.js` — optional `capabilities()` exposure (static for now).
- `src/infrastructure/provider/googleAdapter.js` (optional later stub).

UI
- `src/features/config/modelEditor.js` — add/edit `OTPM` column.
- `src/features/config/settingsOverlay.js` — add ARA input.

Instrumentation
- `src/instrumentation/requestDebugOverlay.js` — show new symbols & budget fields.

Documentation
- `docs/TECH_REF_BUDGET.md` (new) — formulas & example.

Tests
- `tests/unit/budgetMath.test.js` — C, HLP/HLA, trimming, R cases.
- `tests/unit/anthropicCap.test.js` — cap permutations & overflow guard.

Optional Later
- `tests/unit/googleAdapter.test.js` — once Google stub added.

## 20. How to test (manual)
1) Enter Anthropic API key in API Keys overlay.
2) In Model Editor, enable an Anthropic model (e.g., `claude-3-5-sonnet-20240620`).
3) In the main UI, select that model and send “Hello”.
4) Expect a response; try again with a wrong key to see normalized auth error.

---

## 21. Technical Reference: Definitions & Derivations (single authoritative list)
Linear numbered items below replace prior Annex/duplicated math/rate sections.

1. Symbols
   - cw: raw context window tokens;
   - tpm: tokens per minute, model-specific usage limit.
   - C = min(cw, tpm). Effective request max size.

   - URA: pre-set new message allowance (prediction) - settings;
   - ARA: pre-set assistant response allowance (prediction, not the limit) - settings;
   - PARA = (ARA if provider==OpenAI, else 0): provider-specific assistant response reserve;

   - s: number of tokens in topic-specific system message; 
   - u: nuber of tokens in the actual new user message; 
   - HLP = C - URA - s - PARA; predicted history limit;
   - HLA = C - u - s - PARA; actual new message based history limit;

   - hᵢ = T(Uᵢ)+T(Aᵢ): filtered chronological history pairs p₁..pₙ (oldest→newest);
   - T(x): token estimator (native or ceil(len/cpt), cpt≈3.5–4).
   - I₀: predicted included suffix;
   - H₀ = Σhᵢ over I₀; History initially included in the attempted assembled request.
   - H: the final accepted history if trimming was initiatied. In most cases H=H₀  

   - otpm: model-specific parameter. Anthropic output TPM;
   - UTMO: topic specific max output limit ser by the user in topic tree;

2. Filtering
   - Start from full store; apply CLI/user filters → ordered oldest→newest -> B = [h_1, h_2, ...h_n]

3. Prediction (primary snapshot path)
   - Walk B newest→oldest accumulating total while Σhᵢ ≤ HLP.
   - Included set reversed to chronological → I₀; H₀ = Σhᵢ.

4. Send-time guard & trimming
   - Compute u; if s + u > C → error (prompt too large).
   - If H₀ ≤ HLA accept; else iteratively drop oldest pair until H ≤ HLA or none (overflow error if none fits).

6. Budget values
   - inputTokens = s + u + H.
   - R = max(0, C − inputTokens).
   - Publish `budget: { maxContext: C, inputTokens, remainingContext: R }`.

7. Output caps
   - OpenAI: only when override UTMO present → max_tokens = UTMO;
   - Anthropic: required → max_tokens = min(R, otpm?, UTMO?) (ignore undefined). If result <1 → overflow error.

8. Rate limit fields
   - tpm: combined (OpenAI) / input (Anthropic); influences C.
   - otpm: optional Anthropic output ceiling; does not change C.
   - No rolling minute accounting yet.

9. Rationale note
    - Using C = min(cw, tpm) preserves legacy behavior; separation of rate vs memory may change later but not in this iteration.