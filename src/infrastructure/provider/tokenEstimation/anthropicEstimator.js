/**
 * Anthropic (Claude) token estimation
 * 
 * Image formula: tile-based with different constants than OpenAI
 * - Approximately 1600 tokens per 512×512 tile
 * - No base cost like OpenAI
 * 
 * Text tokenization: future - integrate Claude tokenizer if available
 */

// New function export (for new code)
export function estimateImageTokens({ w, h }) {
  // Anthropic tile-based formula (approximate based on docs)
  const tiles = Math.ceil(w / 512) * Math.ceil(h / 512)
  return tiles * 1600
}

// Legacy object export (for old code)
export const anthropicEstimator = {
  estimateImageTokens
}
