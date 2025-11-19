// Provider adapter interface V2 (for new sendNewMessage architecture)
// Clean, simple adapter registry without legacy baggage

// V2 adapters
import { createGeminiAdapterV2 } from './geminiAdapterV2.js'
import { createOpenAIAdapterV2 } from './openaiAdapterV2.js'
//import { createAnthropicAdapterV2 } from './anthropicAdapterV2.js'
//import { createGrokAdapterV2 } from './grokAdapterV2.js'

/**
 * Direct provider mapping for new architecture
 * Each adapter has simple interface: { sendChat(params) => Promise<response> }
 */
export const ADAPTERS = {
  gemini: createGeminiAdapterV2(),
  openai: createOpenAIAdapterV2(),
  //anthropic: createAnthropicAdapterV2(),  // 
  //grok: createGrokAdapterV2(),  // 
}

// Temporary backwards-compatible export; TODO: remove once all call sites use ADAPTERS
export const PROVIDERS = ADAPTERS

/**
 * Adapter error - thrown during HTTP requests to LLM providers
 * Wraps underlying errors (network, parse, HTTP) with error code for routing
 */
export class AdapterError extends Error {
  constructor(code, message, options) {
    // Do NOT use custom message when cause.messge is available
    const msg = message || options?.cause?.message || code
    super(msg, options)
    this.name = 'AdapterError'
    this.code = code
  }
}
