// chronoTopicPicker.js
// Flat list picker showing recently used topics in chronological order
// Opened via Ctrl+P in INPUT mode for quick topic switching

import { openModal } from '../../shared/openModal.js'

export function createChronoTopicPicker({
  store,
  modeManager,
  topicHistory, // Array of topic IDs in chrono order (most recent first)
  currentTopicId, // Current/pending topic ID
  onSelect, // Callback when topic selected
  onCancel,
}) {
  const previousActive = document.activeElement
  let focusedIndex = 1 // Default focus on previous topic (second item)

  const rootEl = document.createElement('div')
  rootEl.className = 'chrono-topic-picker-backdrop'
  rootEl.style.cssText =
    'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:500;display:flex;align-items:center;justify-content:center;'

  const panel = document.createElement('div')
  panel.className = 'chrono-topic-picker'
  panel.style.cssText =
    'background:var(--bg-alt);border:1px solid #333;border-radius:8px;padding:20px;min-width:400px;max-width:600px;max-height:60vh;display:flex;flex-direction:column;'

  const title = document.createElement('div')
  title.textContent = 'Recent Topics'
  title.style.cssText = 'font-size:13px;font-weight:400;margin-bottom:12px;color:#888;'

  const listContainer = document.createElement('div')
  listContainer.className = 'chrono-topic-list-container'
  listContainer.style.cssText = 'flex:1;overflow-y:auto;max-height:200px;' // ~6 items (1 current + 5 previous)
  listContainer.setAttribute('role', 'listbox')
  listContainer.setAttribute('tabindex', '0')

  const list = document.createElement('div')
  list.className = 'chrono-topic-list'
  list.style.cssText = 'display:flex;flex-direction:column;gap:2px;'

  // Build topic list: [current] + history (excluding current if in history)
  const topicIds = [currentTopicId, ...topicHistory.filter((id) => id !== currentTopicId)]
  const items = []

  topicIds.forEach((topicId, index) => {
    const topic = store.topics.get(topicId)
    if (!topic) return

    const item = document.createElement('div')
    item.className = 'chrono-topic-item'
    item.setAttribute('data-topic-id', topicId)
    item.setAttribute('data-index', index)
    item.style.cssText =
      'padding:6px 12px;border-radius:4px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;'

    const path = store.getTopicPath(topicId)
    if (path[0] === 'Root') path.shift()
    const pathStr = path.join(' > ')

    const nameSpan = document.createElement('span')
    nameSpan.textContent = pathStr
    nameSpan.style.cssText = 'color:var(--text);font-size:13px;'

    const labelSpan = document.createElement('span')
    labelSpan.style.cssText = 'color:#888;font-size:11px;'

    if (index === 0) {
      labelSpan.textContent = '[current]'
      item.style.opacity = '0.6'
    } else {
      labelSpan.textContent = ''
    }

    item.appendChild(nameSpan)
    item.appendChild(labelSpan)

    list.appendChild(item)
    items.push(item)
  })

  // Focus management
  function setFocus(index) {
    if (index < 0 || index >= items.length) return
    focusedIndex = index
    items.forEach((item, i) => {
      if (i === index) {
        item.style.background = '#1e3a5a'
        item.style.outline = 'none' // Removed outline/border
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      } else {
        item.style.background = 'transparent'
        item.style.outline = 'none'
      }
    })
  }

  function swallow(e) {
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
  }

  // Keyboard handler
  function onKey(e) {
    if (e.key === 'j' || e.key === 'ArrowDown') {
      swallow(e)
      setFocus((focusedIndex + 1) % items.length)
    } else if (e.key === 'k' || e.key === 'ArrowUp') {
      swallow(e)
      setFocus((focusedIndex - 1 + items.length) % items.length)
    } else if (e.key === 'Enter') {
      swallow(e)
      const selectedTopicId = topicIds[focusedIndex]
      if (selectedTopicId) {
        teardown()
        onSelect && onSelect(selectedTopicId)
      }
    } else if (e.key === 'Escape') {
      swallow(e)
      teardown()
      onCancel && onCancel()
    }
  }

  // Mouse click
  list.addEventListener('click', (e) => {
    const item = e.target.closest('.chrono-topic-item')
    if (item) {
      const topicId = item.getAttribute('data-topic-id')
      if (topicId) {
        teardown()
        onSelect && onSelect(topicId)
      }
    }
  })

  // Mouse hover
  list.addEventListener('mouseover', (e) => {
    const item = e.target.closest('.chrono-topic-item')
    if (item) {
      const index = parseInt(item.getAttribute('data-index'))
      if (!isNaN(index)) {
        setFocus(index)
      }
    }
  })

  listContainer.appendChild(list)
  panel.appendChild(title)
  panel.appendChild(listContainer)
  rootEl.appendChild(panel)

  // Add keyboard listener to root element (like topicPicker)
  rootEl.addEventListener('keydown', onKey)

  const modal = openModal({
    modeManager,
    root: rootEl,
    closeKeys: [], // Handle close internally like topicPicker
    restoreMode: true,
  })

  function teardown() {
    modal.close('manual')
    if (previousActive && previousActive.focus) {
      try {
        previousActive.focus()
      } catch (_) {}
    }
  }

  document.body.appendChild(rootEl)

  // Set initial focus on previous topic (index 1)
  if (items.length > 1) {
    setFocus(1)
  } else if (items.length === 1) {
    setFocus(0)
  }

  // Focus list container to enable keyboard handling (no search input, so focus list directly)
  listContainer.focus()

  return { destroy: teardown }
}
