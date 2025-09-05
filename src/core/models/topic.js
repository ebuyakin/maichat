// Moved from src/models/topic.js (Phase 5 core move)
export function createTopic({ id, name, parentId = null, createdAt = Date.now() }) { return { id, name, parentId, createdAt } }
