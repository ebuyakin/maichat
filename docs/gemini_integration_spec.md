# Gemini API Integration Spec

**Date**: October 10, 2025  
**Status**: ANALYSIS & PLANNING  
**Context**: Adding Google Gemini as third major provider (OpenAI + Anthropic + Gemini)

---

## Problem Statement

**Current State:** MaiChat supports OpenAI and Anthropic models, but lacks Google's Gemini models despite their growing popularity and unique capabilities.

**Business Value:**
- Completes the "Big 3" AI providers (OpenAI, Anthropic, Google)
- Access to Google's latest models (Gemini 2.5 Pro/Flash)
- Native multimodal capabilities (images, audio, video)
- Google Search grounding integration
- Competitive advantage over other chat interfaces

**Technical Gap:**
- No Gemini adapter in `src/infrastructure/provider/`
- No Gemini models in model catalog
- No Gemini provider registration in bootstrap

---

## Current Architecture Analysis

### Provider Integration Pattern

**Existing Providers:**
- **OpenAI**: `openaiAdapter.js` - Direct REST API calls
- **Anthropic**: `anthropicAdapter.js` - Proxy server required (Vercel)

**Adapter Interface:**
```javascript
// Universal provider interface
{
  sendChat(req) {
    // req: { model, messages, system, apiKey, signal, options, budget }
    // return: { content, usage, __timing }
  }
}
```

**Registration:**
```javascript
// src/runtime/bootstrap.js
registerProvider('openai', createOpenAIAdapter())
registerProvider('anthropic', createAnthropicAdapter())
```

### Model Catalog Integration

**Current Structure:**
```javascript
// src/core/models/modelCatalog.js
const BASE_MODELS = [
  // OpenAI models...
  { id: 'gpt-4o', provider: 'openai', ... },
  // Anthropic models...
  { id: 'claude-3-5-sonnet-20240620', provider: 'anthropic', ... },
]
```

---

## Gemini API Analysis

### Access Policies ✅ **VERY OPEN**

**Authentication:**
- Simple API key (like OpenAI)
- No OAuth complexity
- Browser-compatible (no CORS issues)
- No usage restrictions

**Rate Limits:**
- Free tier: 500 RPD, reasonable TPM/RPM
- Paid tier: Scales with usage
- Much more generous than Anthropic (60 RPM)

### API Structure

**Endpoint:** `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`

**Request Format Differences:**
```javascript
// OpenAI format
{
  model: "gpt-4o",
  messages: [
    { role: "user", content: "Hello" },
    { role: "assistant", content: "Hi there!" }
  ]
}

// Gemini format  
{
  model: "gemini-2.5-flash",
  contents: [
    { parts: [{ text: "Hello" }] },
    { parts: [{ text: "Hi there!" }] }
  ],
  systemInstruction: { parts: [{ text: "You are helpful" }] }
}
```

**Response Format:**
```javascript
{
  candidates: [{
    content: { parts: [{ text: "Response..." }] }
  }],
  usageMetadata: {
    promptTokenCount: 10,
    candidatesTokenCount: 20
  }
}
```

### Integration Complexity: **MEDIUM**

**Easy Parts (like OpenAI):**
- Authentication pattern
- Error handling
- Basic request/response flow
- Streaming support

**Medium Parts (format conversion):**
- Message structure transformation
- System instruction handling
- Response parsing
- Safety settings mapping

**Advanced Parts (unique features):**
- Multimodal content (images/audio/video)
- Function calling (different protocol)
- Google Search grounding
- Context caching

---

## Proposed Solution

### Architecture Decisions

**ADR-005: Gemini Provider Integration**

1. **Follow existing adapter pattern** - Create `geminiAdapter.js` matching OpenAI adapter interface
2. **Direct browser calls** - Unlike Anthropic, no proxy server needed
3. **Minimal feature set initially** - Text-only, add multimodal later
4. **Conservative model selection** - Start with proven models (Gemini 1.5 Flash/Pro)

### Implementation Plan

#### Phase 1: Core Adapter (2 days)
- Create `src/infrastructure/provider/geminiAdapter.js`
- Implement basic text chat functionality
- Handle request/response format conversion
- Add error handling and rate limit detection
- Basic streaming support

#### Phase 2: Model Catalog Integration (0.5 days)
- Add Gemini models to `BASE_MODELS` in `modelCatalog.js`
- Set appropriate pricing and limits
- Update provider metadata

#### Phase 3: Bootstrap Integration (0.5 days)
- Register Gemini provider in `bootstrap.js`
- Update provider selection UI
- Add Gemini API key handling in `apiKeysOverlay.js`
- Update help documentation

#### Phase 4: Testing & Polish (1 day)
- End-to-end testing with real API
- Error scenario testing
- Streaming verification
- Documentation updates

### Success Criteria

**Functional:**
- ✅ Can send/receive text messages with Gemini models
- ✅ Proper error handling and user feedback
- ✅ Streaming responses work
- ✅ Rate limits handled gracefully
- ✅ API keys stored securely

**Integration:**
- ✅ Models appear in model selector
- ✅ Provider selection works
- ✅ Settings overlay includes Gemini
- ✅ Help documentation updated

**Quality:**
- ✅ No regressions in existing providers
- ✅ Clean error messages
- ✅ Reasonable performance
- ✅ Documentation complete

---

## Implementation Timeline

**Total Effort:** 4 days
- **Day 1:** Gemini adapter implementation
- **Day 2:** Adapter testing and refinement  
- **Day 3:** Model catalog and bootstrap integration
- **Day 4:** Testing, documentation, final polish

**Risks & Mitigations:**
- **API changes:** Low risk - Google maintains stable APIs
- **Rate limits:** Start conservative, monitor usage
- **Browser compatibility:** Test across browsers
- **Cost monitoring:** Implement usage tracking

**Dependencies:**
- Google AI Studio API key for testing
- Access to Gemini models in target region

---

## Next Steps

1. **Create Gemini adapter** following OpenAI pattern
2. **Test with real API** to validate assumptions
3. **Iterate on error handling** and edge cases
4. **Add to model catalog** and bootstrap
5. **Update documentation** and help overlay

**Ready to proceed with implementation?** 🚀</content>
<parameter name="filePath">/Users/eugenebuyakin/Dev/maichat/docs/gemini_integration_spec.md