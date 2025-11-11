/**
 * Anthropic (Claude) token estimation
 * 
 * Image formula: tile-based with different constants than OpenAI
 * - Approximately 1600 tokens per 512×512 tile
 * - No base cost like OpenAI
 * 
 * Text tokenization: future - integrate Claude tokenizer if available
 */

export const anthropicEstimator = {
  estimateImageTokens({ w, h }, model = '') {
    // Anthropic tile-based formula (approximate based on docs)
    const tiles = Math.ceil(w / 512) * Math.ceil(h / 512)
    return tiles * 1600
  },
}
