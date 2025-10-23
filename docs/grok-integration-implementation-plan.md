# Grok Integration - Implementation Plan

## Grok documentation:
https://docs.x.ai/docs/guides/responses-api
https://docs.x.ai/docs/guides/tools/search-tools
https://docs.x.ai/docs/guides/live-search

## Architecture

```
src/infrastructure/provider/  - Provider adapters
src/core/models/             - Model catalog (storage)
src/runtime/bootstrap.js     - Provider registration
src/features/config/         - API keys + Model editor
```

---

## Implementation Steps

### Step 1: API Key Interface

**File:** `src/features/config/apiKeysOverlay.js`

**Add:**
- xAI key input field (after Gemini section)
- Link: `https://console.x.ai/api-keys`
- Save/load: `grok` key

**Test:** Save xAI key, reload, verify persistence.

---

### Step 2: Model Catalog - Add Web Search Field

**File:** `src/core/models/modelCatalog.js`
**Storage:** Existing save/load handles new field automatically (additive change).
**Test:** Load app, check localStorage, verify models present with `webSearch` property.

---

### Step 3: Model Editor - Web Search UI

**File:** `src/features/config/modelEditor.js`

**Add:**
- Checkbox: "Web Search"
- Bind to `model.webSearch` field
- Save/update logic includes boolean

**Location:** After rate limit fields, before Save button.

**UI:**
```html
<label>
  <input type="checkbox" id="webSearch" />
  Web Search
</label>
```

**Test:** 
- Create model with webSearch=true
- Edit existing model, toggle webSearch
- Verify saves correctly

---

### Step 4: Grok Provider Adapter

**File:** `src/infrastructure/provider/grokAdapter.js` (NEW)
**Pattern:** Mirror `openaiAdapter.js` structure exactly.
**Test:** Send text message to Grok, verify response.

---

### Step 5: Register Provider

**File:** `src/runtime/bootstrap.js`

**Add:**
```javascript
import { createGrokAdapter } from '../infrastructure/provider/grokAdapter.js'

// In bootstrap():
registerProvider('grok', createGrokAdapter())
```
**Location:** After gemini registration (line 43).
**Test:** App boots, no console errors, Grok provider available.

---

## Testing Sequence

1. **Step 1:** API key saves/loads
2. **Step 2:** Models in catalog with `webSearch` field
3. **Step 3:** Model Editor shows/saves webSearch checkbox
4. **Step 4:** Grok adapter returns responses
5. **Step 5:** Can send message to Grok from UI

**No regressions:** OpenAI/Anthropic/Gemini still work.

---

## Modified Files

| File | Change |
|------|--------|
| `apiKeysOverlay.js` | Add xAI key input |
| `modelCatalog.js` | Add `webSearch` field + Grok models |
| `modelEditor.js` | Add webSearch checkbox |
| `grokAdapter.js` | NEW - Provider implementation |
| `bootstrap.js` | Register Grok provider |

**Total: 4 modified, 1 new**

---

## Open Questions

1. **Web search in Phase 2:** How to pass `webSearch` flag to adapter?
   - Option A: Read from model catalog in compose logic
   - Option B: Add to ChatRequest interface
   
2. **Model Editor provider dropdown:** Dynamic or hardcoded?
   - Need to audit if 'grok' appears automatically

---

## Notes

- No public docs until v1.1 release
- All changes additive (easy rollback)
- `webSearch` field prepares for Phase 2
- Vision structure added in Phase 3 (separate payload change)


Short, practical answer: yes—both Grok Chat Completions and Grok Responses support built-in search tools (Web, X, and News), but the Responses API exposes them with richer control and better event/citation plumbing.

Here’s what matters in practice:

- Chat Completions
  - How to enable search: add search_parameters
    {
      "model": "...",
      "messages": [...],
      "search_parameters": {
        "mode": "auto"   // "auto" lets the model decide; use "none"/"off" to disable
        // Optional:
        // "sources": [{"type":"web"}, {"type":"news"}, {"type":"x"}],
        // "return_citations": true,
        // "max_search_results": 10
      }
    }
  - What you get back: a normal choices/message response; if citations are enabled, you’ll receive supporting metadata in the response (schema varies—surface it if present).
  - When to use: drop-in with your current OpenAI-style adapter; simple “on/off/auto” search with optional source selection.

- Responses API
  - How to enable search: via tools/tool_choice or a search/search_parameters equivalent (naming is slightly different and more flexible)
    {
      "model": "...",
      "input": [ ...content blocks... ],
      "tools": [{"type": "web_search"}],
      "tool_choice": "auto",
      // or a search/search_parameters block, depending on the latest spec
      // (same concepts: mode, sources, return_citations, max_search_results)
    }
  - What you get back: a response with output parts, and (if streaming) typed events (e.g., response.output_text.delta, tool.*). This gives you better visibility into search steps and makes citations/grounding easier to consume.
  - When to use: you want richer multimodal flows, structured outputs (JSON schema), or detailed tool step telemetry.

Search options both generally support
- Mode: auto (model decides), off/none (disabled). Some implementations also support “required/always” modes.
- Sources: choose from web, news, x (Twitter/X).
- Results detail: return_citations (to get sources back); optionally tune max_search_results.
- Notes: exact field names can evolve—these are the stable concepts. If you toggle search via your settings, you already have the right abstraction in your code.

