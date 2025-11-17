/**
 * Google Gemini token estimation
 * 
 * Image formula: fixed cost per image regardless of resolution
 * - Approximately 258 tokens per image
 * 
 * Text tokenization: future - integrate Gemini tokenizer if available
 */

// New function export (for new code)
export function estimateImageTokens({ w, h }) {
  // Gemini uses fixed token cost per image
  return 258
}

// Legacy object export (for old code)
export const geminiEstimator = {
  estimateImageTokens
}
