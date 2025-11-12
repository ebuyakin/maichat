/**
 * Shared Type Definitions for MaiChat
 * 
 * Centralized JSDoc typedef declarations for core data structures used across modules.
 * These types serve as single source of truth for object shapes and provide IDE support.
 * 
 * Usage in other files:
 * 
 * Method 1 (import at top):
 *   // @typedef {import('./shared/types.js').MessagePair} MessagePair
 *   // @param {MessagePair} pair
 * 
 * Method 2 (inline):
 *   // @param {import('./shared/types.js').MessagePair} pair
 */

/**
 * Message pair - fundamental unit of conversation history.
 * Stores user request + assistant response with metadata and token budgets.
 * 
 * @typedef {Object} MessagePair
 * @property {string} id - Unique pair identifier (UUID)
 * @property {string} topicId - Associated topic ID
 * @property {string} model - Model identifier used for response (e.g., 'gpt-4', 'gemini-2.0-flash-exp')
 * @property {number} createdAt - Unix timestamp (milliseconds)
 * 
 * @property {string} userText - User message text (raw)
 * @property {string} assistantText - Assistant response text (raw)
 * @property {number} userChars - Character count of user text (ground truth)
 * @property {number} assistantChars - Character count of assistant text (ground truth)
 * 
 * @property {number} [assistantProviderTokens] - Provider-reported token count (highest precedence)
 * @property {number} [textTokens] - Legacy heuristic token estimate (deprecated, read-only)
 * @property {number} [attachmentTokens] - Legacy total image token estimate (deprecated)
 * 
 * @property {Array<string>} [attachments] - Legacy: image IDs attached to user message
 * @property {Array<ImageBudget>} [imageBudgets] - Denormalized image metadata (preferred)
 * 
 * @property {string} [lifecycleState] - State: 'pending' | 'done' | 'error'
 * @property {string} [errorMessage] - Error details if lifecycleState is 'error'
 * @property {number} [star] - User rating (0-3)
 * @property {string} [colorFlag] - Color flag: 'b' (blue) | 'g' (green) | null
 */

/**
 * Denormalized image metadata stored with pair for fast token estimation.
 * Computed when image attached, eliminates need to query imageStore during estimation.
 * 
 * @typedef {Object} ImageBudget
 * @property {string} id - Image ID
 * @property {number} w - Width in pixels
 * @property {number} h - Height in pixels
 * @property {Object<string, number>} tokenCost - Provider-specific token costs (e.g., {openai: 850, anthropic: 1600})
 */

/**
 * Universal message format for provider adapters.
 * Used to build API payloads from MessagePair data.
 * 
 * @typedef {Object} Message
 * @property {'user'|'assistant'|'system'} role - Message role
 * @property {string} content - Message text content
 * @property {Array<string>} [attachments] - Image IDs for this message (user messages only)
 */

/**
 * Topic in hierarchical topic tree.
 * Topics organize messages and can have custom system messages.
 * 
 * @typedef {Object} Topic
 * @property {string} id - Unique topic identifier (UUID)
 * @property {string} name - Topic display name
 * @property {string|null} parentId - Parent topic ID (null for root topic)
 * @property {number} createdAt - Unix timestamp (milliseconds)
 * @property {number} [lastActiveAt] - Most recent message timestamp in this topic or descendants
 * @property {string} [systemMessage] - Custom system message for this topic
 * @property {number} directCount - Number of pairs directly in this topic
 * @property {number} totalCount - Total pairs including all descendants
 */

/**
 * Image record stored in IndexedDB.
 * Contains blob, metadata, and cached base64 + token costs.
 * 
 * @typedef {Object} ImageRecord
 * @property {string} id - Unique image identifier (UUID)
 * @property {Blob} blob - Original image blob
 * @property {string} mime - MIME type (e.g., 'image/jpeg')
 * @property {number} w - Width in pixels
 * @property {number} h - Height in pixels
 * @property {number} bytes - File size in bytes
 * @property {number} createdAt - Unix timestamp (milliseconds)
 * @property {Object} [base64] - Cached base64 encoding {mime: string, data: string}
 * @property {Object<string, number>} [tokenCost] - Cached token costs per provider
 */

/**
 * Context boundary calculation result.
 * Determines which pairs fit in model's context window.
 * 
 * @typedef {Object} ContextBoundary
 * @property {Array<MessagePair>} included - Pairs that fit in context (chronological)
 * @property {Array<MessagePair>} excluded - Pairs that don't fit (oldest first)
 * @property {Object} stats - Boundary statistics
 * @property {number} stats.totalTokens - Total tokens of included pairs
 * @property {number} stats.maxContext - Model's context window size
 * @property {number} stats.availableTokens - Remaining tokens for user request
 */

// Export empty object to make this a proper ES module
export {}
