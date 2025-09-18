# M24: Multiple Providers (Anthropic, Google)

Status: Draft for review
Owner: Assistant (with Eugene)
Last updated: 2025-09-17

## Objectives
- Add support for at least one additional provider (Anthropic) end-to-end; design in a way that adding Google (Vertex/Gemini) is straightforward.
- Keep MaiChat’s core contracts stable: request assembly, context budgeting (URA), error handling, and UI semantics.
- Maintain security: no secret leakage, client-only fetch, configurable base URLs.

## Scope
- Providers: Anthropic (priority), Google Gemini (follow-up). OpenAI remains supported.
- UI: Model Editor shows provider per model; Model Selector allows choosing models across providers; API Keys overlay collects separate keys.
- Runtime: normalized provider adapter interface.
- Out of scope: streaming (can be staged), tool use/function calling, vision/image modalities.

## High-level architecture
- Provider adapters under `src/infrastructure/provider/` implement a common interface:
  - `sendChat({ modelId, messages, system, temperature, maxTokens, signal }) -> Promise<ProviderResponse>`
  - `countTokens({ modelId, textParts }) -> Promise<TokenEst>` (optional; fallback to CPT)
  - `capabilities(modelId)` returns `{ maxContextTokens, supportsStreaming, supportsSystem, supportsJson }`
- Normalization layer converts provider responses to MaiChat format:
  - `{ text, finishReason, usage: { promptTokens, completionTokens, totalTokens }, providerMeta }`
- Model catalog extended: `model.provider` in `core/models/modelCatalog.js`.

## Contracts
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
    messages: Array<{ role: 'user'|'assistant'|'system', content: string }>
    temperature?: number
    maxTokens?: number
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

## UI changes
- Model Editor
  - Add a non-editable `Provider` column for existing models; for new models, provider is selected from a dropdown.
  - Validation: enforce unique id within provider namespace; mark active model provider visibly.
- Model Selector
  - No changes (per EB). Models remain unique; selection UX unchanged.
- API Keys overlay
  - Add fields for Anthropic and Google API keys, stored separately; never sent to logs.

## Settings / Persistence (BYOK only)
- Users obtain their own provider keys and enter them locally.
- Keys are stored locally and used only on the client for direct calls.
- Namespaced keys (example): `maichat.key.openai`, `maichat.key.anthropic`, `maichat.key.google`.
- Models are stored in the existing catalog with a new `provider` attribute; defaults include a few Anthropic/Gemini entries (disabled by default until a key is present).

## Networking (BYOK)
- Client `fetch` with configurable base URLs:
  - OpenAI: `https://api.openai.com/v1/chat/completions`
  - Anthropic: `https://api.anthropic.com/v1/messages` (requires headers: `x-api-key`, `anthropic-version`)
  - Google: `https://generativelanguage.googleapis.com/v1beta/models/:model:generateContent?key=...`
- CORS considerations: depending on provider/browser, direct calls may be blocked; users can configure their own proxy if needed, but MaiChat ships as a pure client and does not include a relay.

## Error handling
- Normalize provider-specific errors to common error types + user-friendly messages:
  - 401→`auth`, 429→`rate-limit`, 403/insufficient_quota→`quota`.
  - Network fetch failures → `network`.
  - Adapter-level parse errors → `server` or `bad-response` with raw snippet.

## Token accounting
- Phase 1: use existing CPT fallback (charsPerToken) for non-OpenAI models.
- Phase 2: adapter `countTokens` for Anthropic/Google if viable without heavy dependencies.

## Security notes (BYOK)
- Keys live only on the user’s machine. Never log keys; mask in UI.
- Optional "Encrypt locally" (WebCrypto + passphrase) can protect at-rest storage (e.g., in localStorage/IndexedDB); this improves local security but cannot fully protect against a compromised browser/runtime or malicious extensions.

## Incremental delivery plan
1) Data model wiring
   - Add `provider` field to model catalog; update Model Editor display; migration: assume `openai` for existing.
2) Anthropic adapter
   - Implement `sendChat`; map roles to Anthropic’s format; map headers and version; normalize response.
3) API Keys overlay
  - Add Anthropic key field; read/write in local storage; hide value with input[type=password].
4) Selector/UI state
  - No Model Selector changes. Enable Anthropic models in the catalog; selection will work as usual.
5) Smoke test path
   - Manual run: switch to an Anthropic model, send a short prompt, verify response, and errors (bad key).
6) Optional: Google adapter stubs
   - Implement structure, keep disabled until key present.

## Acceptance criteria
- Enter Anthropic API key locally, select an Anthropic model, send a message, and receive a response. Auth and rate-limit errors are normalized.
- Model Editor lists provider and allows adding/enabling an Anthropic model.
- No regressions for OpenAI models.

## Risks and mitigations
- CORS blocks in browsers → provide proxy URL setting and doc a simple local proxy.
- API request differences → adapter isolates mapping; add unit tests with recorded examples.
- Token budget mismatch → start with CPT fallback; visually indicate when a model uses approximated budget.

## Open questions
- Streaming: add `stream=true` later; align scroll and part-splitting.
- Safety filters: map content-filter stop reasons consistently.
- Per-provider system message rules: ensure system is at top level for Anthropic.

## File changes
- `src/infrastructure/provider/anthropicAdapter.js` (new)
- `src/infrastructure/provider/googleAdapter.js` (stub)
- `src/infrastructure/provider/providerRegistry.js` (registry/factory)
- `src/core/models/modelCatalog.js` (extend schema with provider)
- `src/features/config/modelEditor.js` (show provider; select on new row)
- `src/features/config/modelSelector.js` (no changes)
- `src/features/config/apiKeysOverlay.js` (add key fields)
- `src/features/compose/pipeline.js` (resolve adapter by model.provider)
- `tests/unit/` (adapters, error mapping)

## How to test (manual)
1) Enter Anthropic API key in API Keys overlay.
2) In Model Editor, enable an Anthropic model (e.g., `claude-3-5-sonnet-20240620`).
3) In the main UI, select that model and send “Hello”.
4) Expect a response; try again with a wrong key to see normalized auth error.
