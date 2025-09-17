// Ordering for export: time or topic

// pairs: [{ id, createdAt, topicId, ... }]
// topicIndex: { rootId, getChildren(id)->Iterable<string>, getName(id)->string, getParent(id)->string|null }

export function orderPairs(pairs, { mode = 'time', topicIndex } = {}) {
  if (!Array.isArray(pairs)) return []
  if (mode === 'time') {
    return [...pairs].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt) || (a.id > b.id ? 1 : -1))
  }
  if (mode === 'topic') {
    if (!topicIndex || !topicIndex.rootId || !topicIndex.getChildren) {
      // fallback to time if no index provided
      return orderPairs(pairs, { mode: 'time' })
    }
    // Build mapping: topicId -> array of pairs sorted by createdAt
    const byTopic = new Map()
    for (const p of pairs) {
      const tid = p.topicId || topicIndex.rootId
      const arr = byTopic.get(tid) || []
      arr.push(p)
      byTopic.set(tid, arr)
    }
    for (const arr of byTopic.values()) arr.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt) || (a.id > b.id ? 1 : -1))

    // DFS pre-order traversal from root: include root pairs first, then children recursively
    const out = []
    const visit = (id) => {
      const arr = byTopic.get(id)
      if (arr) out.push(...arr)
      const kids = topicIndex.getChildren(id)
      if (kids) {
        for (const cid of kids) visit(cid)
      }
    }
    visit(topicIndex.rootId)

    // There may be pairs whose topicId nodes are not reachable (moved/deleted); append them at the end by time
    if (out.length !== pairs.length) {
      const included = new Set(out.map(p => p.id))
      const remaining = pairs.filter(p => !included.has(p.id))
      out.push(...remaining.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt) || (a.id > b.id ? 1 : -1)))
    }
    return out
  }
  // default fallback
  return orderPairs(pairs, { mode: 'time' })
}
