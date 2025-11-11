/**
 * xAI Grok token estimation
 * 
 * Image formula: assumed similar to OpenAI (both use similar vision models)
 * - Base: 85 tokens
 * - Per 512×512 tile: 170 tokens
 * 
 * Text tokenization: future - verify if Grok uses similar tokenizer to GPT
 */

export const grokEstimator = {
  estimateImageTokens({ w, h }, model = '') {
    // Grok likely uses similar formula to OpenAI (unverified, conservative assumption)
    const tiles = Math.ceil(w / 512) * Math.ceil(h / 512)
    return 85 + tiles * 170
  },
}
