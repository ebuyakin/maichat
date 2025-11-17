/**
 * xAI Grok token estimation
 * 
 * Image formula: assumed similar to OpenAI (both use similar vision models)
 * - Base: 85 tokens
 * - Per 512×512 tile: 170 tokens
 * 
 * Text tokenization: future - verify if Grok uses similar tokenizer to GPT
 */

// New function export (for new code)
export function estimateImageTokens({ w, h }) {
  // Grok likely uses similar formula to OpenAI (unverified, conservative assumption)
  const tiles = Math.ceil(w / 512) * Math.ceil(h / 512)
  return 85 + tiles * 170
}

// Legacy object export (for old code)
export const grokEstimator = {
  estimateImageTokens
}
