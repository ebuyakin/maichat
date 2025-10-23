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

**Schema Change:**
Add `webSearch` boolean to model objects:
```javascript
{
  id: 'grok-beta',
  provider: 'grok',
  contextWindow: 131072,
  tpm: 60000,
  rpm: 60,
  webSearch: true,  // NEW FIELD
}
```

**Models to Add (per xAI specs):**
```javascript
{
  id: 'grok-4-fast-non-reasoning',
  provider: 'grok',
  contextWindow: 131072,
  tpm: 400000,
  rpm: 500,
  tpd: 5000000,
  webSearch: true,
},
{
  id: 'grok-4-fast-reasoning',
  provider: 'grok',
  contextWindow: 131072,
  tpm: 400000,
  rpm: 500,
  tpd: 5000000,
  webSearch: true,
},
{
  id: 'grok-code-fast-1',
  provider: 'grok',
  contextWindow: 131072,
  tpm: 400000,
  rpm: 500,
  tpd: 5000000,
  webSearch: false,  // Code model - no search
},
```

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

**Implementation:**
```javascript
export function createGrokAdapter() {
  return {
    async sendChat(req) {
      const { model, messages, system, apiKey, signal, options } = req
      
      // Endpoint
      const url = 'https://api.x.ai/v1/chat/completions'
      
      // Payload (OpenAI-compatible)
      const msgArr = system ? [{ role: 'system', content: system }, ...messages] : messages
      const body = { 
        model, 
        messages: msgArr.map(m => ({ role: m.role, content: m.content }))
      }
      
      // Options
      if (options?.temperature) body.temperature = options.temperature
      if (options?.maxOutputTokens) body.max_tokens = options.maxOutputTokens
      
      // Request
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      })
      
      // Error handling (mirror OpenAI adapter)
      // Response parsing
      // Return { content, usage, __timing }
    }
  }
}
```

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

