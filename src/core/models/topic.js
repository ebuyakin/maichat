// Moved from src/models/topic.js (Phase 5 core move)
const DEFAULT_SYSTEM_MESSAGE = 'You are MaiChat Assistant for this topic. Be concise and ask clarifying questions when needed.'

export function createTopic({ id, name, parentId = null, createdAt = Date.now(), systemMessage = DEFAULT_SYSTEM_MESSAGE, requestParams } = {}) {
	return {
		id,
		name,
		parentId,
		createdAt,
		systemMessage,
		requestParams: normalizeRequestParams(requestParams)
	}
}

function normalizeRequestParams(rp){
	const obj = rp && typeof rp === 'object' ? rp : {}
	const out = {}
	if (typeof obj.temperature === 'number') out.temperature = clamp(obj.temperature, 0, 2)
	if (typeof obj.maxOutputTokens === 'number' && Number.isFinite(obj.maxOutputTokens) && obj.maxOutputTokens > 0) out.maxOutputTokens = Math.floor(obj.maxOutputTokens)
	return out
}

function clamp(v,min,max){ return Math.min(max, Math.max(min, v)) }
