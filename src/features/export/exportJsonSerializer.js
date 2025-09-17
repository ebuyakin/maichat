export function buildJsonExport({ pairs, meta }){
  const obj = {
    schemaVersion: '1',
    app: meta?.app,
    generatedAt: meta?.generatedAt || new Date().toISOString(),
    filterInput: meta?.filterInput || '',
    orderApplied: meta?.orderApplied || 'time',
    count: Array.isArray(pairs) ? pairs.length : 0,
    pairs: (pairs||[]).map(p => ({
      id: p.id,
      createdAt: p.createdAt,
      topicPath: p.topicPath,
      topicId: p.topicId,
      model: p.model,
      stars: p.stars ?? p.star ?? 0,
      flagColor: p.flagColor ?? p.colorFlag,
      userText: p.userText || '',
      assistantText: p.assistantText || '',
      errorState: !!p.errorState,
      ...(p.errorState && p.errorMessage ? { errorMessage: p.errorMessage } : {})
    }))
  }
  return JSON.stringify(obj, null, 2)
}
