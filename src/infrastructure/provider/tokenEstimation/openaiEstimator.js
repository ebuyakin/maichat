/**
 * OpenAI token estimation
 * 
 * Image formula: detail:high tile-based calculation
 * - Base: 85 tokens
 * - Per 512×512 tile: 170 tokens
 * 
 * Text tokenization: future - integrate tiktoken.js for accurate counts
 */

// New function export (for new code)
export function estimateImageTokens({ w, h }) {
  // OpenAI detail:high tile formula (conservative, always assume high detail)
  const tiles = Math.ceil(w / 512) * Math.ceil(h / 512)
  return 85 + tiles * 170
}

// Legacy object export (for old code)
export const openaiEstimator = {
  estimateImageTokens,
  
  // Future: text tokenization with tiktoken
  // estimateTextTokens(text, model = 'gpt-4') {
  //   const encoder = getEncoderForModel(model)
  //   return encoder.encode(text).length
  // }
}
