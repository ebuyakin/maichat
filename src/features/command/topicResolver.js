// Topic filter resolver for CLI language (t)
// Supports:
// - Bare t (no value): use current topic id (no descendants)
// - Name or wildcard: e.g., "AI", "*Learn*" (case-insensitive)
// - Path with '>' or '/' separators: e.g., "AI > Transformers", "/AI/Transformers"
// - Descendants flag via trailing '...': includes matched topics and all descendants

function globToRegExp(pattern) {
  // Escape regex special chars, then replace \* with .*
  const esc = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const re = '^' + esc.replace(/\*/g, '.*') + '$'
  return new RegExp(re, 'i')
}

function normalizePath(path) {
  // Drop optional surrounding quotes already handled by lexer; trim spaces
  return path.trim()
}

function splitPath(expr) {
  const s = normalizePath(expr)
  if (!s) return []
  if (s.startsWith('/')) {
    return s
      .split('/')
      .filter(Boolean)
      .map((x) => x.trim())
  }
  return s
    .split('>')
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
}

function buildChildrenMap(store) {
  const children = new Map()
  const topics = store.getAllTopics ? store.getAllTopics() : Array.from(store.topics.values())
  for (const t of topics) {
    const pid = t.parentId || null
    if (!children.has(pid)) children.set(pid, new Set())
    children.get(pid).add(t.id)
  }
  return children
}

function collectDescendants(rootIds, childrenMap) {
  const out = new Set()
  const stack = [...rootIds]
  while (stack.length) {
    const id = stack.pop()
    if (out.has(id)) continue
    out.add(id)
    const kids = childrenMap.get(id)
    if (kids) kids.forEach((k) => stack.push(k))
  }
  return out
}

function topicPathNames(store, topicId) {
  // store.getTopicPath returns names from root to node; may include 'Root'
  let names = store.getTopicPath ? store.getTopicPath(topicId).slice() : []
  if (names[0] === 'Root') names.shift()
  return names
}

export function resolveTopicFilter(value, { store, currentTopicId }) {
  const topics = store.getAllTopics ? store.getAllTopics() : Array.from(store.topics.values())
  const byId = new Map(topics.map((t) => [t.id, t]))
  const children = buildChildrenMap(store)

  // Bare t
  if (value == null) {
    return currentTopicId ? new Set([currentTopicId]) : new Set()
  }

  let expr = String(value)
  let includeDesc = false
  if (expr.endsWith('...')) {
    includeDesc = true
    expr = expr.slice(0, -3)
  }
  expr = expr.trim()

  const segments = splitPath(expr)

  // Name-only (no path) match against topic names
  if (segments.length <= 1) {
    const namePattern = segments.length === 1 ? segments[0] : expr
    const re = globToRegExp(namePattern || '*')
    const matched = topics.filter((t) => re.test(t.name || ''))
    if (!includeDesc) {
      return new Set(matched.map((t) => t.id))
    }
    const ids = matched.map((t) => t.id)
    return collectDescendants(ids, children)
  }

  // Path-based matching: segments are names with possible wildcards
  const reSegs = segments.map(globToRegExp)
  const matchingRoots = topics.filter((t) => {
    const names = topicPathNames(store, t.id)
    if (names.length !== reSegs.length) return false
    for (let i = 0; i < reSegs.length; i++) {
      if (!reSegs[i].test(names[i] || '')) return false
    }
    return true
  })
  if (!includeDesc) {
    return new Set(matchingRoots.map((t) => t.id))
  }
  const rootIds = matchingRoots.map((t) => t.id)
  return collectDescendants(rootIds, children)
}
