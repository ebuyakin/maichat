// Read-only topic tree view for Activity Stats "By Topic" tab
// Displays filtered message counts per topic in a collapsible tree structure

import { computeTopicFilteredCounts } from './activityStatsData.js'

/**
 * Create a read-only topic stats tree DOM element
 * Shows direct and total (including descendants) message counts for each topic
 * Only includes topics that have messages in the filtered view
 * 
 * @param {Object} params
 * @param {Object} params.store - Topic store (topics, children, rootTopicId, getTopicPath)
 * @param {Array} params.visiblePairs - Filtered message pairs
 * @returns {HTMLElement} Tree container element
 */
export function createTopicStatsTree({ store, visiblePairs }) {
  const { direct, total } = computeTopicFilteredCounts(store, visiblePairs)
  
  // Expanded state for tree nodes (initially expand root's children)
  const expanded = new Set()
  const rootId = store.rootTopicId
  if (rootId) {
    for (const cid of store.children.get(rootId) || []) {
      expanded.add(cid)
    }
  }
  
  // Create container element
  const container = document.createElement('div')
  container.className = 'topic-stats-tree'
  container.setAttribute('role', 'tree')
  container.setAttribute('tabindex', '0')
  container.style.cssText = 'width:100%;height:100%;overflow:auto;'
  
  let activeIndex = 0
  
  // Render function
  function render() {
    const rows = []
    
    /**
     * Depth-first traversal to build flat row list
     */
    function dfs(topicId, depth) {
      const t = store.topics.get(topicId)
      if (!t) return
      
      const d = direct.get(topicId) || 0
      const tot = total.get(topicId) || 0
      
      // Skip topics with no messages in the filtered view
      if (d === 0 && tot === 0) return
      
      rows.push({ topic: t, depth, direct: d, total: tot })
      
      // Process children if expanded
      const kids = Array.from(store.children.get(topicId) || new Set())
      if (kids.length && expanded.has(topicId)) {
        // Sort children by name for consistent display
        kids.sort((a, b) => {
          const ta = store.topics.get(a)
          const tb = store.topics.get(b)
          return (ta?.name || '').localeCompare(tb?.name || '')
        })
        for (const cid of kids) {
          dfs(cid, depth + 1)
        }
      }
    }
    
    // Build tree starting from root's children
    const roots = store.children.get(null) || new Set()
    for (const rid of roots) {
      if (rid === rootId) {
        // Expand root's children directly at depth 0
        const kids = Array.from(store.children.get(rootId) || new Set())
        kids.sort((a, b) => {
          const ta = store.topics.get(a)
          const tb = store.topics.get(b)
          return (ta?.name || '').localeCompare(tb?.name || '')
        })
        for (const cid of kids) {
          dfs(cid, 0)
        }
      } else {
        dfs(rid, 0)
      }
    }
    
    // Clear and render
    container.innerHTML = ''
    
    if (!rows.length) {
      container.innerHTML = '<div style="opacity:.7;font-size:12px;padding:20px;text-align:center;">No topics in the current view.</div>'
      return
    }
    
    // Clamp active index
    if (activeIndex >= rows.length) activeIndex = rows.length - 1
    if (activeIndex < 0) activeIndex = 0
    
    // Render rows
    rows.forEach((row, idx) => {
      const rowEl = document.createElement('div')
      rowEl.className = 'ts-row' + (idx === activeIndex ? ' active' : '')
      rowEl.setAttribute('data-id', row.topic.id)
      rowEl.setAttribute('data-index', idx)
      rowEl.style.cssText = `padding:2px 8px;padding-left:${row.depth * 16 + 8}px;font-size:12px;cursor:pointer;${idx === activeIndex ? 'background:#1e3a5a;' : ''}`
      
      // Determine marker (▾ expanded / ▸ collapsed / · leaf)
      const hasChildren = (store.children.get(row.topic.id) || new Set()).size > 0
      const marker = hasChildren ? (expanded.has(row.topic.id) ? '▾' : '▸') : '·'
      
      // Build topic label (use path or name)
      const path = store.getTopicPath(row.topic.id) || []
      if (path[0] === 'Root') path.shift()
      const label = path.join(' > ') || row.topic.name || '(no topic)'
      
      rowEl.innerHTML = `<span class="ts-marker" style="display:inline-block;width:12px;text-align:center;margin-right:4px;">${marker}</span>${escapeHtml(label)} <span class="ts-counts">(${row.direct}/${row.total})</span>`
      
      // Add click handler for expand/collapse
      rowEl.addEventListener('click', (e) => {
        e.stopPropagation()
        activeIndex = idx
        if (hasChildren) {
          if (expanded.has(row.topic.id)) {
            expanded.delete(row.topic.id)
          } else {
            expanded.add(row.topic.id)
          }
        }
        render()
      })
      
      container.appendChild(rowEl)
    })
    
    // Scroll active row into view
    const activeRow = container.querySelector('.ts-row.active')
    if (activeRow) {
      activeRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }
  
  // Keyboard navigation
  container.addEventListener('keydown', (e) => {
    const rows = Array.from(container.querySelectorAll('.ts-row'))
    if (!rows.length) return
    
    // j/k or arrow keys for navigation
    if (e.key === 'j' || e.key === 'ArrowDown') {
      e.preventDefault()
      e.stopPropagation()
      activeIndex = Math.min(activeIndex + 1, rows.length - 1)
      render()
      return
    }
    
    if (e.key === 'k' || e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      activeIndex = Math.max(activeIndex - 1, 0)
      render()
      return
    }
    
    // h/l for collapse/expand
    const activeRow = rows[activeIndex]
    if (!activeRow) return
    const topicId = activeRow.getAttribute('data-id')
    const hasChildren = (store.children.get(topicId) || new Set()).size > 0
    
    if (e.key === 'h' || e.key === 'ArrowLeft') {
      e.preventDefault()
      e.stopPropagation()
      if (hasChildren && expanded.has(topicId)) {
        // Collapse if expanded
        expanded.delete(topicId)
        render()
      }
      return
    }
    
    if (e.key === 'l' || e.key === 'ArrowRight') {
      e.preventDefault()
      e.stopPropagation()
      if (hasChildren && !expanded.has(topicId)) {
        // Expand if collapsed
        expanded.add(topicId)
        render()
      }
      return
    }
  })
  
  // Initial render
  render()
  
  return container
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}
