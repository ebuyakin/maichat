/**
 * OpenAI token estimation
 * 
 * Image formula: detail:high tile-based calculation
 * - Base: 85 tokens
 * - Per 512×512 tile: 170 tokens
 * 
 * Text tokenization: future - integrate tiktoken.js for accurate counts
 */

export const openaiEstimator = {
  estimateImageTokens({ w, h }, model = '') {
    // OpenAI detail:high tile formula (conservative, always assume high detail)
    const tiles = Math.ceil(w / 512) * Math.ceil(h / 512)
    return 85 + tiles * 170
  },
  
  // Future: text tokenization with tiktoken
  // estimateTextTokens(text, model = 'gpt-4') {
  //   const encoder = getEncoderForModel(model)
  //   return encoder.encode(text).length
  // }
}
