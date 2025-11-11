/**
 * Google Gemini token estimation
 * 
 * Image formula: fixed cost per image regardless of resolution
 * - Approximately 258 tokens per image
 * 
 * Text tokenization: future - integrate Gemini tokenizer if available
 */

export const geminiEstimator = {
  estimateImageTokens({ w, h }, model = '') {
    // Gemini uses fixed token cost per image
    return 258
  },
}
