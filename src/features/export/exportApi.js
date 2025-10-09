import { orderPairs } from './exportOrdering.js'
import { buildJsonExport } from './exportJsonSerializer.js'
import { buildMarkdownExport } from './exportMarkdownSerializer.js'
import { buildTextExport } from './exportTextSerializer.js'
import { defaultFilenameUTC, sanitizeFilename } from './exportFormatting.js'

function inferMime(format) {
  if (format === 'md') return 'text/markdown; charset=utf-8'
  if (format === 'txt') return 'text/plain; charset=utf-8'
  return 'application/json; charset=utf-8'
}

export function runExport({
  store,
  pairIds,
  format = 'json',
  order = 'time',
  filename,
  filterInput = '',
  app,
  topicIndex,
}) {
  const ext = (format || 'json').toLowerCase()
  const fname = sanitizeFilename(filename || defaultFilenameUTC(ext))
  const mime = inferMime(ext)

  // Build raw pairs from store
  const rawPairs = (pairIds || []).map((id) => store.pairs.get(id)).filter(Boolean)

  // Map to serializer shape (attach topicPath via store when possible)
  const withPaths = rawPairs.map((p) => ({
    id: p.id,
    createdAt:
      typeof p.createdAt === 'string'
        ? p.createdAt
        : new Date(p.createdAt || Date.now()).toISOString(),
    topicId: p.topicId || store.rootTopicId,
    topicPath: store.getTopicPath
      ? store.getTopicPath(p.topicId || store.rootTopicId).join(' > ')
      : '',
    model: p.model,
    stars: typeof p.stars === 'number' ? p.stars : typeof p.star === 'number' ? p.star : 0,
    flagColor: p.flagColor ?? p.colorFlag,
    userText: p.userText || '',
    assistantText: p.assistantText || '',
    errorState: !!p.errorState,
    errorMessage: p.errorMessage,
  }))

  // Create a default topicIndex if not provided, wrapping store
  const idx =
    topicIndex ||
    (store && {
      rootId: store.rootTopicId,
      getChildren: (id) => Array.from(store.children.get(id) || []),
      getName: (id) => (store.topics.get(id) || {}).name,
      getParent: (id) => (store.topics.get(id) || {}).parentId ?? null,
    })

  const ordered = orderPairs(withPaths, { mode: order, topicIndex: idx })

  const meta = {
    app,
    generatedAt: new Date().toISOString(),
    filterInput,
    orderApplied: order,
    count: ordered.length,
  }

  let content = ''
  if (ext === 'md') content = buildMarkdownExport({ pairs: ordered, meta })
  else if (ext === 'txt') content = buildTextExport({ pairs: ordered, meta })
  else content = buildJsonExport({ pairs: ordered, meta })

  return { filename: fname, mime, content }
}
