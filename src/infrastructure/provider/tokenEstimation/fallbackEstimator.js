/**
 * DEPRECATED. NOT USER IN NEW MESSAGE ROUTINE
 * Fallback token estimator for unknown/unsupported providers
 * 
 * Uses conservative OpenAI formula as baseline
 */

export const fallbackEstimator = {
  estimateImageTokens({ w, h }, model = '') {
    // Conservative fallback: use OpenAI detail:high formula
    const tiles = Math.ceil(w / 512) * Math.ceil(h / 512)
    return 85 + tiles * 170
  },
  
  estimateTextTokens(text, model = '') {
    // Simple char-based fallback
    if (!text) return 0
    return Math.max(1, Math.ceil(text.length / 4))
  },
}
