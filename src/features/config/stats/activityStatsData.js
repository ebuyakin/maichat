// Activity stats data computation utilities
// Pure functions for computing stats over message pairs

/**
 * Calculate median of an array of numbers
 */
export function median(arr) {
  if (!arr || !arr.length) return null
  const sorted = arr.slice().sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Format response time in milliseconds to human-readable string
 */
export function formatResponseTime(ms) {
  if (ms == null) return '—'
  return `${(ms / 1000).toFixed(1)}s`
}

/**
 * Compute daily message counts from pairs
 * Groups by local calendar day (YYYY-MM-DD)
 */
export function computeDailyCounts(pairs) {
  const byDay = new Map()
  for (const p of pairs) {
    const d = new Date(p.createdAt || Date.now())
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const existing = byDay.get(key)
    const responseTimes = existing?.responseTimes || []
    if (typeof p.responseMs === 'number') {
      responseTimes.push(p.responseMs)
    }
    byDay.set(key, {
      count: (existing?.count || 0) + 1,
      responseTimes
    })
  }
  const rows = Array.from(byDay.entries()).map(([day, data]) => ({
    day,
    count: data.count,
    medianResponseTime: median(data.responseTimes)
  }))
  // Descending order (newest at top)
  rows.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0))
  return rows
}

/**
 * Compute per-model message counts from pairs
 * Groups by model ID
 */
export function computeModelCounts(pairs) {
  const byModel = new Map()
  for (const p of pairs) {
    const model = p.model || 'unknown'
    const existing = byModel.get(model)
    const responseTimes = existing?.responseTimes || []
    if (typeof p.responseMs === 'number') {
      responseTimes.push(p.responseMs)
    }
    byModel.set(model, {
      count: (existing?.count || 0) + 1,
      responseTimes
    })
  }
  const rows = Array.from(byModel.entries()).map(([model, data]) => ({
    model,
    count: data.count,
    medianResponseTime: median(data.responseTimes)
  }))
  // Sort by count descending (most used models first)
  rows.sort((a, b) => b.count - a.count)
  return rows
}

/**
 * Compute per-topic message counts from filtered pairs
 * Returns direct counts and total counts (including descendants) for each topic
 * 
 * @param {Object} store - Topic store with topics, children, rootTopicId
 * @param {Array} visiblePairs - Filtered message pairs
 * @returns {{ direct: Map<string, number>, total: Map<string, number> }}
 */
export function computeTopicFilteredCounts(store, visiblePairs) {
  // 1. Build direct counts from visible pairs
  const direct = new Map()
  for (const p of visiblePairs) {
    const tid = p.topicId
    if (!tid) continue
    direct.set(tid, (direct.get(tid) || 0) + 1)
  }

  // 2. Compute totals by walking the topic tree (includes descendants)
  const total = new Map()

  function dfs(topicId) {
    const t = store.topics.get(topicId)
    if (!t) return 0
    
    let sum = direct.get(topicId) || 0
    const kids = store.children.get(topicId) || new Set()
    for (const cid of kids) {
      sum += dfs(cid)
    }
    total.set(topicId, sum)
    return sum
  }

  // Start from all root topics
  const roots = store.children.get(null) || new Set()
  for (const rid of roots) {
    dfs(rid)
  }

  return { direct, total }
}
