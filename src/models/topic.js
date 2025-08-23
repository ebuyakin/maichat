// Topic model definition

/**
 * @typedef {Object} Topic
 * @property {string} id
 * @property {string} name
 * @property {string|null} parentId
 * @property {number} createdAt
 */

/**
 * Create a Topic.
 * @param {Object} params
 * @param {string} params.id
 * @param {string} params.name
 * @param {string|null} [params.parentId=null]
 * @param {number} [params.createdAt=Date.now()]
 * @returns {Topic}
 */
export function createTopic({ id, name, parentId = null, createdAt = Date.now() }) {
  return { id, name, parentId, createdAt }
}
