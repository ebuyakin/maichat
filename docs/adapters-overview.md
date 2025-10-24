# Provider adapters: quick reference

Purpose: concise implementation sketch for each provider, to refresh context fast without reading code. Keep styles consistent across providers.

Applies to: `src/infrastructure/provider/*.js`

---

## OpenAI — Responses API
- Endpoint: `POST https://api.openai.com/v1/responses`
- Auth headers: `Authorization: Bearer <key>`, `Content-Type: application/json`
- Request shape:
  - `model`: one of gpt-5, gpt-5-mini, gpt-5-nano, o4 (per catalogue)
  - `instructions`: system text (if any)
  - `input`: array of turns `[ { role, content: [ { type, text } ] } ]`
    - user → `type: "input_text"`
    - assistant history → `type: "output_text"`
  - `tools` when web search is enabled: `[{ type: "web_search" }]`, `tool_choice: "auto"`
  - `max_output_tokens`: optional cap (derived from budget)
  - Note: temperature omitted (some models reject it)
- Response parsing:
  - Content: concat `data.output[*].content[*].text` (fallback: `output_text`, or legacy `choices[0].message.content`)
  - Citations: gather from `content[*].citations`, `content[*].annotations` (url/href + title/source), and top-level `references`
  - Usage: `input_tokens`, `output_tokens`, `total_tokens`
- Errors: map HTTP to `ProviderError(kind)`, preserve provider code if present
- Notes: No streaming in this adapter; native web search is server-side tool

## Anthropic (Claude) — Messages API
- Endpoint: `POST https://api.anthropic.com/v1/messages` (via our proxy)
- Headers: `x-api-key`, `anthropic-version: 2023-06-01`, `Content-Type`
- Request shape:
  - `model`, `messages`: normalized alternation of `{role, content:[{type:"text",text}]}`
    - We insert minimal placeholders if needed to preserve role alternation
  - `system`: system prompt text (top-level)
  - `max_tokens`: computed from remaining context/budget (must be > 0)
  - `temperature`: optional
  - Web search (native): `tools: [{ type: "web_search_20250305", name: "web_search" }]` when enabled
- Response parsing:
  - Content: join text blocks from `data.content[*]`
  - Citations: from text block `citations` (`web_search_result_location`), and from `web_search_tool_result` (items `web_search_result`), dedup and build `citationsMeta`
  - Usage: `usage.input_tokens`, `usage.output_tokens`, optional `total_tokens`
- Notes: Org must enable web search; we do not yet send web_fetch (beta)

## Google Gemini — Generative Language API
- Endpoint: `POST https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
- Auth header: `x-goog-api-key`
- Request shape:
  - `contents`: mapped turns `{ role: 'user'|'model', parts:[{text}] }`
  - `systemInstruction`: `{ parts:[{text: system}] }` if system present
  - `generationConfig`: temperature, maxOutputTokens (optional)
  - Web search: `tools: [{ googleSearch: {} }]` when enabled
- Response parsing:
  - Content: first candidate `content.parts[*].text`
  - Citations: from `groundingMetadata.groundingChunks[*].web|webChunk|web_chunk (uri,title)`; fallback to `citationMetadata.citationSources[*].uri`
  - Build `citations` (urls[]) and `citationsMeta` (url→title)
  - Usage: `usageMetadata.promptTokenCount`, `candidatesTokenCount`, `totalTokenCount`
- Notes: Variants of grounding fields exist; parser tolerates camelCase/snake_case

## xAI Grok — Chat Completions API
- Endpoint: `POST https://api.x.ai/v1/chat/completions`
- Auth header: `Authorization: Bearer <key>`
- Request shape:
  - `model`, `messages`: `{role, content}`
  - `temperature`, `max_tokens` optional
  - Web search: `search_parameters` instead of `tools`
    - `{ mode: 'auto', return_citations: true }` when enabled; `{ mode: 'off' }` to disable
- Response parsing:
  - Content: `choices[0].message.content`
  - Citations: various locations — top-level `citations`, `choices[0].message.citations`, or `message.metadata.citations`
  - Usage: `usage` passthrough if provided
- Notes: Server-side search; citations returned as URLs (titles usually absent)

---

## Shared adapter contract
All adapters return (non-streaming):
```
{
  content: string,
  usage?: {
    promptTokens?: number,
    completionTokens?: number,
    totalTokens?: number,
  },
  citations?: string[],            // URLs for Sources overlay
  citationsMeta?: { [url]: string } // Optional display titles
}
```
Errors are thrown as `ProviderError(message, kind, status?)` with `providerCode` when the upstream reports a specific error code.

## Budget/Options mapping (summary)
- max_output_tokens/max_tokens derived from our budget (`remainingContext` and model caps)
- temperature: used when allowed (Anthropic/Gemini/Grok), omitted in OpenAI Responses path (model-dependent)
- web search toggle: provider-specific flag mapped to native mechanism:
  - OpenAI: `tools: [{ type: 'web_search' }], tool_choice: 'auto'`
  - Anthropic: `tools: [{ type: 'web_search_20250305', name: 'web_search' }]`
  - Gemini: `tools: [{ googleSearch: {} }]`
  - Grok: `search_parameters: { mode: 'auto', return_citations: true }`

## UI integration notes
- Sources overlay consumes `citations` and `citationsMeta`; long labels are middle‑truncated and full URLs available via title tooltip.
- We do not render arbitrary HTML from model text; inline linkification (if enabled later) must be safe and skip code blocks.
