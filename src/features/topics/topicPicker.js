// topicPicker.js moved from ui/topicPicker.js (Phase 6.4 Topics)
import { openModal } from '../../shared/openModal.js'
import { getSettings, saveSettings } from '../../core/settings/index.js'

export function createTopicPicker({ store, modeManager, onSelect, onCancel }) {
  let filter = ''
  let flat = []
  let activeIndex = 0
  const expanded = new Set()
  const previousActive = document.activeElement
  let inTreeFocus = false
  const rootId = store.rootTopicId
  for (const id of store.children.get(rootId) || []) expanded.add(id)
  const rootEl = document.createElement('div')
  rootEl.className = 'topic-picker-backdrop'
  rootEl.innerHTML = `<div class="topic-picker"><input type="text" class="tp-search" placeholder="Search (Ctrl+J to tree)"/><div class="tp-tree" role="tree" tabindex="0"></div></div>`
  const searchInput = rootEl.querySelector('.tp-search')
  const treeEl = rootEl.querySelector('.tp-tree')
  function escapeHtml(s) {
    return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
  }
  function topicPathNames(id) {
    const parts = []
    let cur = store.topics.get(id)
    while (cur) {
      parts.push(cur.name)
      cur = cur.parentId ? store.topics.get(cur.parentId) : null
    }
    const full = parts.reverse()
    if (full[0] === 'Root') full.shift()
    return full.join(' > ')
  }
  let orderMode = getSettings().topicOrderMode || 'manual' // 'manual' | 'recent'

  function compareTopics(aId, bId) {
    const ta = store.topics.get(aId),
      tb = store.topics.get(bId)
    if (orderMode === 'recent') {
      const d = (tb?.lastActiveAt || 0) - (ta?.lastActiveAt || 0)
      if (d) return d
    } else {
      const d = (ta?.sortIndex || 0) - (tb?.sortIndex || 0)
      if (d) return d
    }
    return (
      (ta?.createdAt || 0) - (tb?.createdAt || 0) || (ta?.name || '').localeCompare(tb?.name || '')
    )
  }

  function buildFlat() {
    flat = []
    const lower = filter.toLowerCase()
    const match = (t) =>
      !lower ||
      t.name.toLowerCase().includes(lower) ||
      topicPathNames(t.id).toLowerCase().includes(lower)
    const forceExpand = new Set()
    if (lower) {
      for (const t of store.topics.values()) {
        if (match(t)) {
          let cur = t.parentId ? store.topics.get(t.parentId) : null
          while (cur) {
            forceExpand.add(cur.id)
            cur = cur.parentId ? store.topics.get(cur.parentId) : null
          }
        }
      }
    }
    function dfs(id, depth) {
      const t = store.topics.get(id)
      if (!t) return
      const m = match(t)
      let include = m
      if (!m) {
        for (const cid of store.children.get(id) || []) {
          if (descendantHasMatch(cid)) {
            include = true
            break
          }
        }
      }
      if (!include) return
      flat.push({ topic: t, depth })
      const isExp = expanded.has(id) || forceExpand.has(id)
      if (isExp) {
        const kids = Array.from(store.children.get(id) || []).sort(compareTopics)
        for (const cid of kids) dfs(cid, depth + 1)
      }
    }
    const descCache = new Map()
    function descendantHasMatch(id) {
      if (descCache.has(id)) return descCache.get(id)
      const t = store.topics.get(id)
      if (!t) {
        descCache.set(id, false)
        return false
      }
      if (match(t)) {
        descCache.set(id, true)
        return true
      }
      for (const cid of store.children.get(id) || [])
        if (descendantHasMatch(cid)) {
          descCache.set(id, true)
          return true
        }
      descCache.set(id, false)
      return false
    }
    const kids = Array.from(store.children.get(rootId) || []).sort(compareTopics)
    for (const rid of kids) dfs(rid, 0)
  }
  function render() {
    buildFlat()
    if (activeIndex >= flat.length) activeIndex = flat.length ? flat.length - 1 : 0
    treeEl.innerHTML = flat.map((row, i) => renderRow(row, i === activeIndex)).join('')
    
    // Scroll active row into view
    const activeRow = treeEl.querySelector('.tp-row.active')
    if (activeRow) {
      activeRow.scrollIntoView({ block: 'nearest', behavior: 'auto' })
    }
  }
  function renderRow({ topic, depth }, active) {
    const hasChildren = (store.children.get(topic.id) || []).size > 0
    const isExpanded = expanded.has(topic.id)
    const marker = hasChildren ? (isExpanded ? '▾' : '▸') : '·'
    const cls = `tp-row${active ? ' active' : ''}`
    return `<div class="${cls}" data-id="${topic.id}" style="padding-left:${depth * 16}px">${marker} ${escapeHtml(topic.name)} <span class="tp-counts">(${topic.directCount || 0}/${topic.totalCount || 0})</span></div>`
  }
  function toggleExpandOrDescend() {
    const row = flat[activeIndex]
    if (!row) return
    const id = row.topic.id
    const kids = store.children.get(id)
    if (!kids || kids.size === 0) return
    if (!expanded.has(id)) {
      expanded.add(id)
      render()
      return
    }
    buildFlat()
    const firstChildId = [...kids][0]
    const idx = flat.findIndex((r) => r.topic.id === firstChildId)
    if (idx >= 0) {
      activeIndex = idx
      render()
    }
  }
  function collapseOrParent() {
    const row = flat[activeIndex]
    if (!row) return
    const id = row.topic.id
    if (expanded.has(id)) {
      expanded.delete(id)
      render()
      return
    }
    const parentId = row.topic.parentId
    if (!parentId) return
    buildFlat()
    const pIdx = flat.findIndex((r) => r.topic.id === parentId)
    if (pIdx >= 0) {
      activeIndex = pIdx
      render()
    }
  }
  function swallow(e) {
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
  }
  function onKey(e) {
    // Toggle order: accept plain 'o' (lower/upper) and Ctrl+O when tree-focused
    if (inTreeFocus && !e.metaKey && !e.altKey) {
      if (
        (!e.ctrlKey && (e.key === 'o' || e.key === 'O')) ||
        (e.ctrlKey && (e.key === 'o' || e.key === 'O'))
      ) {
        swallow(e)
        orderMode = orderMode === 'manual' ? 'recent' : 'manual'
        saveSettings({ topicOrderMode: orderMode })
        render()
        return
      }
    }
    if (!inTreeFocus) {
      if (e.key === 'Escape') {
        swallow(e)
        teardown()
        onCancel && onCancel()
        return
      }
      if (e.ctrlKey && (e.key === 'j' || e.key === 'J')) {
        swallow(e)
        inTreeFocus = true
        treeEl.focus()
        return
      }
      return
    }
    switch (e.key) {
      case 'Escape':
        swallow(e)
        inTreeFocus = false
        searchInput.focus()
        return
      case 'Enter':
        swallow(e)
        const row = flat[activeIndex]
        if (row) {
          teardown()
          onSelect && onSelect(row.topic.id)
        }
        return
      case 'j':
      case 'ArrowDown':
        swallow(e)
        activeIndex = Math.min(flat.length - 1, activeIndex + 1)
        render()
        return
      case 'k':
      case 'ArrowUp':
        swallow(e)
        activeIndex = Math.max(0, activeIndex - 1)
        render()
        return
      case 'l':
      case 'ArrowRight':
        swallow(e)
        toggleExpandOrDescend()
        return
      case 'h':
      case 'ArrowLeft':
        swallow(e)
        collapseOrParent()
        return
    }
  }
  searchInput.addEventListener('input', () => {
    filter = searchInput.value.trim()
    activeIndex = 0
    render()
  })
  rootEl.addEventListener('keydown', onKey)
  
  // Mouse click: marker → expand/collapse, name → select
  treeEl.addEventListener('click', (e) => {
    const row = e.target.closest('.tp-row')
    if (!row) return
    
    const topicId = row.getAttribute('data-id')
    const idx = flat.findIndex(r => r.topic.id === topicId)
    if (idx < 0) return
    
    // Determine if this topic has children
    const topic = flat[idx].topic
    const hasChildren = (store.children.get(topic.id) || []).size > 0
    
    if (!hasChildren) {
      // No children → always select
      teardown()
      onSelect && onSelect(topicId)
      return
    }
    
    // Has children → check if clicked on marker area (left 24px)
    const clickX = e.clientX
    const rowRect = row.getBoundingClientRect()
    const markerZone = 24 // marker + small padding
    
    if (clickX - rowRect.left < markerZone) {
      // Clicked marker → toggle expand/collapse
      activeIndex = idx
      if (expanded.has(topicId)) {
        expanded.delete(topicId)
      } else {
        expanded.add(topicId)
      }
      render()
    } else {
      // Clicked name → select
      teardown()
      onSelect && onSelect(topicId)
    }
  })
  
  // Mouse hover: update active index for visual feedback
  treeEl.addEventListener('mouseover', (e) => {
    const row = e.target.closest('.tp-row')
    if (row) {
      const rows = treeEl.querySelectorAll('.tp-row')
      const index = Array.from(rows).indexOf(row)
      if (index >= 0 && index !== activeIndex) {
        activeIndex = index
        render()
      }
    }
  })
  
  const modal = openModal({ modeManager, root: rootEl, closeKeys: [], restoreMode: true })
  function teardown() {
    modal.close('manual')
    if (previousActive && previousActive.focus) {
      try {
        previousActive.focus()
      } catch (_) {}
    }
  }
  document.body.appendChild(rootEl)
  searchInput.focus()
  render()
  return { destroy: teardown }
}
