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

// Import type definitions from authoritative source
/**
 * @typedef {import('../core/models/messagePair.js').MessagePair} MessagePair
 */

/**
 * @typedef {import('../core/models/messagePair.js').CodeBlock} CodeBlock
 */

/**
 * @typedef {import('../core/models/messagePair.js').EquationBlock} EquationBlock
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

/**
 * Application settings object.
 * User-configurable parameters for token estimation and context management.
 * 
 * @typedef {Object} AppSettings
 * @property {number} [charsPerToken] - Characters per token ratio (default 4)
 * @property {number} [userRequestAllowance] - Reserved tokens for user request
 * @property {number} [assistantResponseAllowance] - Reserved tokens for assistant response
 * @property {number} [maxTrimAttempts] - Max retry attempts for context overflow (default 10)
 * @property {number} [requestTimeoutSec] - Request timeout in seconds (default 120)
 * @property {boolean} [showTrimNotice] - Show notification when history is trimmed
 * @property {string} [topicOrderMode] - Topic tree sort mode ('manual' | 'recent')
 */

/**
 * Memory store interface for message pairs and topics.
 * Central data store for all conversation history and topic hierarchy.
 * 
 * @typedef {Object} MemoryStore
 * @property {Map} pairs - Pair map with get/set methods
 * @property {Map} topics - Topic map with get/set/has methods
 * @property {string} rootTopicId - ID of the root topic
 * @property {Function} getAllPairs - Get all message pairs sorted by creation time
 * @property {Function} addMessagePair - Add new message pair, returns pair ID
 * @property {Function} updatePair - Update a message pair by ID
 * @property {Function} removePair - Remove a message pair by ID
 * @property {Function} [getAllTopics] - Optional: get all topics as array
 */

/**
 * Lifecycle manager for send/receive workflow state.
 * Controls UI state during message exchange and coordinates updates.
 * 
 * @typedef {Object} Lifecycle
 * @property {Function} beginSend - Mark send operation as started
 * @property {Function} completeSend - Mark send operation as complete
 * @property {Function} handleNewAssistantReply - Handle successful reply with pair ID
 */

/**
 * Context boundary manager.
 * Calculates which message pairs fit in model's context window.
 * 
 * @typedef {Object} BoundaryManager
 * @property {Function} updateVisiblePairs - Update with current visible pairs
 * @property {Function} setModel - Set current model for context calculation
 * @property {Function} applySettings - Apply settings for boundary calculation
 * @property {Function} getBoundary - Get current boundary (included/excluded pairs)
 */

/**
 * History runtime manager.
 * Manages history view rendering, active message state, and debug info.
 * 
 * @typedef {Object} HistoryRuntime
 * @property {Function} renderCurrentView - Render history view with options
 * @property {Function} setSendDebug - Set debug info for current send
 * @property {Function} updateMessageCount - Update message count display
 * @property {Function} getPredictedCount - Get predicted message count
 * @property {Function} applyActiveMessage - Apply active message highlighting
 */

/**
 * Active parts manager.
 * Tracks which message part is currently active/selected.
 * 
 * @typedef {Object} ActiveParts
 * @property {Array} parts - Array of active part objects with pairId
 * @property {Function} setActiveById - Set active part by ID
 */

/**
 * Scroll controller.
 * Manages scrolling behavior for history view.
 * 
 * @typedef {Object} ScrollController
 * @property {Function} scrollToBottom - Scroll to bottom of history
 */

/**
 * Request debug overlay manager.
 * Manages debug information display for requests.
 * 
 * @typedef {Object} RequestDebug
 * @property {Function} setPayload - Set current request payload for debug display
 */

// Export empty object to make this a proper ES module
export {}
