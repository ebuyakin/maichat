// Provider adapter interface V2 (for new sendNewMessage architecture)
// Clean, simple adapter registry without legacy baggage

// V2 adapters
import { createGeminiAdapterV2 } from './geminiAdapterV2.js'

/**
 * Direct provider mapping for new architecture
 * Each adapter has simple interface: { sendChat(params) => Promise<response> }
 */
export const PROVIDERS = {
  gemini: createGeminiAdapterV2(),
  // openai: createOpenAIAdapterV2(),  // TODO
  // anthropic: createAnthropicAdapterV2(),  // TODO
  // grok: createGrokAdapterV2(),  // TODO
}
