// Provider adapter interface V2 (for new sendNewMessage architecture)
// Clean, simple adapter registry without legacy baggage

// V2 adapters
import { createGeminiAdapterV2 } from './geminiAdapterV2.js'
import { createOpenAIAdapterV2 } from './openaiAdapterV2.js'
import { createAnthropicAdapterV2 } from './anthropicAdapterV2.js'
import { createGrokAdapterV2 } from './grokAdapterV2.js'

/**
 * Direct provider mapping for new architecture
 * Each adapter has simple interface: { sendChat(params) => Promise<response> }
 * 
 * NOTE: Keys must match SUPPORTED_PROVIDERS in core/models/modelCatalog.js
 * Current mismatch (historical naming):
 * - 'google' provider ID → uses createGeminiAdapterV2() factory
 * - 'xai' provider ID → uses createGrokAdapterV2() factory
 * TODO: Rename adapter files/functions to match provider IDs for consistency
 */
export const ADAPTERS = {
  google: createGeminiAdapterV2(),
  openai: createOpenAIAdapterV2(),
  anthropic: createAnthropicAdapterV2(),
  xai: createGrokAdapterV2(),
}

// Temporary backwards-compatible export; TODO: remove once all call sites use ADAPTERS
export const PROVIDERS = ADAPTERS

/**
 * Adapter error - thrown during HTTP requests to LLM providers
 * Wraps underlying errors (network, parse, HTTP) with error code for routing
 */
export class AdapterError extends Error {
  constructor(code, messageOrOptions) {
    // Detect if second param is options object or string message
    let msg
    let opts
    
    if (messageOrOptions && typeof messageOrOptions === 'object') {
      // Called as: new AdapterError('code', { cause: err })
      msg = messageOrOptions.cause?.message || code
      opts = messageOrOptions
    } else {
      // Called as: new AdapterError('code', 'message') or new AdapterError('code')
      msg = messageOrOptions || code
      opts = undefined
    }
    
    super(msg, opts)
    this.name = 'AdapterError'
    this.code = code
  }
}
