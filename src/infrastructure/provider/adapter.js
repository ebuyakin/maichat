// Moved from src/provider/adapter.js (Phase 3 infrastructure move)
// Generic ProviderAdapter interface and registry

/** @typedef {{ sendChat: (req: ChatRequest) => Promise<ChatResponse> }} ProviderAdapter */

/**
 * @typedef {Object} ChatMessage
 * @property {'user'|'assistant'|'system'} role
 * @property {string} content
 */

/**
 * @typedef {Object} ChatRequest
 * @property {string} model
 * @property {ChatMessage[]} messages
 * @property {AbortSignal} [signal]
 * @property {string} apiKey
 */

/**
 * @typedef {Object} ChatResponse
 * @property {string} content
 * @property {{ promptTokens?: number, completionTokens?: number, totalTokens?: number }} [usage]
 */

const registry = new Map()

export function registerProvider(id, adapter){ registry.set(id, adapter) }
export function getProvider(id){ return registry.get(id) }

export class ProviderError extends Error {
  constructor(message, kind, status){ super(message); this.kind=kind; this.status=status }
}

export function classifyError(status){
  if(status === 401 || status === 403) return 'auth'
  if(status === 429) return 'rate'
  if(status >= 500) return 'server'
  return 'network'
}
