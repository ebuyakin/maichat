// inputKeys.js
// Factory that creates the INPUT mode key handler. Mirrors previous inline behavior.
import { getSettings } from '../../core/settings/index.js'
import { getActiveModel } from '../../core/models/modelCatalog.js'
import { executeSend } from '../compose/pipeline.js'
import { executeSendWorkflow } from '../compose/sendWorkflow.js'
import { sendNewMessage } from '../newMessage/sendNewMessage.js' // new architecture
import { sanitizeAssistantText } from './sanitizeAssistant.js'
import { extractCodeBlocks } from '../codeDisplay/codeExtractor.js'
import { extractEquations } from '../codeDisplay/equationExtractor.js'
import { attachFromFiles, attachFromDataTransfer, getMany as getImagesByIds, detach as detachImage } from '../images/imageStore.js'
import { estimateTokens, estimateImageTokens } from '../../core/context/tokenEstimator.js'
import { openImageOverlay } from '../images/imageOverlay.js'
import { IMAGE_QUOTAS } from '../images/quotas.js'

// Topic history management (MRU list)
const TOPIC_HISTORY_KEY = 'maichat_topic_history'
const MAX_TOPIC_HISTORY = 20
let topicHistory = []
let topicHistoryIndex = -1

function loadTopicHistory() {
  try {
    const stored = localStorage.getItem(TOPIC_HISTORY_KEY)
    if (stored) {
      topicHistory = JSON.parse(stored)
    }
  } catch {
    topicHistory = []
  }
}

function saveTopicHistory() {
  try {
    localStorage.setItem(TOPIC_HISTORY_KEY, JSON.stringify(topicHistory))
  } catch {}
}

function addToTopicHistory(topicId) {
  if (!topicId) return
  // Remove if already in history
  topicHistory = topicHistory.filter((id) => id !== topicId)
  // Add to front
  topicHistory.unshift(topicId)
  // Trim to max size
  if (topicHistory.length > MAX_TOPIC_HISTORY) {
    topicHistory = topicHistory.slice(0, MAX_TOPIC_HISTORY)
  }
  saveTopicHistory()
}

function removeFromTopicHistory(topicId) {
  topicHistory = topicHistory.filter((id) => id !== topicId)
  saveTopicHistory()
}

export { addToTopicHistory, removeFromTopicHistory }

// Export getter for topic history
export function getTopicHistory() {
  return topicHistory.slice() // return copy
}

// Load history on module init
loadTopicHistory()

export function createInputKeyHandler({
  modeManager,
  inputField,
  lifecycle,
  store,
  boundaryMgr,
  pendingMessageMeta,
  historyRuntime,
  activeParts,
  scrollController,
  requestDebug,
  updateSendDisabled,
  getCurrentTopicId,
  getReadingMode,
  setReadingMode,
  sanitizeDisplayPreservingTokens,
  escapeHtmlAttr,
  escapeHtml,
  renderPendingMeta,
  openChronoTopicPicker,
}) {
  // Clean up deleted topics from history
  store.on('topic:delete', (topicId) => {
    removeFromTopicHistory(topicId)
  })

  // Helper: update small attachments indicator (icon + count)
  function updateAttachIndicator() {
    try {
      const ind = document.getElementById('attachIndicator')
      const cnt = document.getElementById('attachCount')
      const n = Array.isArray(pendingMessageMeta.attachments)
        ? pendingMessageMeta.attachments.length
        : 0
      if (!ind || !cnt) return
      // Visibility: 0 -> hidden; 1 -> icon only; 2+ -> icon + number
      if (n === 0) {
        cnt.textContent = ''
        ind.setAttribute('aria-label', 'No images attached')
        ind.style.display = 'none'
        ind.hidden = false // ensure CSS 'hidden' attr is not conflicting; display controls visibility
      } else {
        cnt.textContent = n > 1 ? String(n) : ''
        ind.setAttribute('aria-label', n === 1 ? '1 image attached' : `${n} images attached`)
        ind.style.display = 'inline-flex'
        ind.hidden = false
      }
    } catch {}
  }

  // Persist draft attachments (and, by policy, current draft text) to localStorage.
  // Called only on explicit user actions (attach/paste/overlay remove), never on typing.
  function persistDraftAttachments() {
    try {
      const ids = Array.isArray(pendingMessageMeta.attachments)
        ? pendingMessageMeta.attachments
        : []
      localStorage.setItem('maichat_draft_attachments', JSON.stringify(ids))
      // Policy: when attachments exist, also persist current draft text for reload restore.
      // When attachments are cleared, remove the draft text key to avoid restoring stale text alone.
      if (ids.length > 0) {
        try { localStorage.setItem('maichat_draft_text', inputField.value || '') } catch {}
      } else {
        try { localStorage.removeItem('maichat_draft_text') } catch {}
      }
    } catch {}
  }

  // Helper: validate and clean up stale attachment references
  async function cleanStaleAttachments() {
    if (!Array.isArray(pendingMessageMeta.attachments)) return
    const validIds = []
    for (const id of pendingMessageMeta.attachments) {
      try {
        const rec = await getImagesByIds([id])
        if (rec && rec[0]) {
          validIds.push(id)
        } else {
          console.warn('[attach] removed stale reference:', id)
        }
      } catch {
        console.warn('[attach] removed stale reference:', id)
      }
    }
    if (validIds.length !== pendingMessageMeta.attachments.length) {
      pendingMessageMeta.attachments = validIds
      updateAttachIndicator()
    }
  }

  // Note: attach indicator is informational only; removal is handled in the overlay UI.

  // Bind hidden file input change → attach images to pending draft (no caps yet)
  try {
    const fileInput = document.getElementById('attachFileInput')
    if (fileInput && !fileInput.__mcBound) {
      fileInput.addEventListener('change', async () => {
        try {
          const files = fileInput.files
          if (!files || !files.length) return
          const res = await attachFromFiles(files)
          const newIds = (res && Array.isArray(res.ids)) ? [...res.ids] : []
          if (newIds.length) {
            if (!Array.isArray(pendingMessageMeta.attachments)) pendingMessageMeta.attachments = []
            const current = pendingMessageMeta.attachments
            // Enforce per-message image count cap
            const remainingSlots = Math.max(0, IMAGE_QUOTAS.MAX_IMAGES_PER_MESSAGE - current.length)
            let allowedIds = newIds.slice(0, remainingSlots)
            const overflowIds = newIds.slice(remainingSlots)
            if (overflowIds.length) {
              console.warn(`[attach] exceeded image count cap; dropping ${overflowIds.length}`)
              // Detach overflow immediately to avoid orphaning in store
              for (const id of overflowIds) {
                try { await detachImage(id) } catch {}
              }
            }
            // Enforce per-message total bytes cap
            if (allowedIds.length) {
              try {
                const recs = await getImagesByIds([...current, ...allowedIds])
                const sumBytes = (ids) => ids.reduce((acc, id) => {
                  const idx = [...current, ...allowedIds].indexOf(id)
                  const rec = recs[idx]
                  return acc + (rec && rec.bytes ? rec.bytes : 0)
                }, 0)
                // Start with all allowedIds, remove from end until within limit
                let total = sumBytes([...current, ...allowedIds])
                const removed = []
                while (total > IMAGE_QUOTAS.MAX_TOTAL_BYTES_PER_MESSAGE && allowedIds.length) {
                  const drop = allowedIds.pop()
                  removed.push(drop)
                  total = sumBytes([...current, ...allowedIds])
                }
                if (removed.length) {
                  console.warn(`[attach] exceeded total bytes cap; dropping ${removed.length}`)
                  for (const id of removed) {
                    try { await detachImage(id) } catch {}
                  }
                }
              } catch (err) {
                console.error('[attach] size check failed', err)
                // On error, be safe: do not append new ids to avoid exceeding caps unknowingly
                for (const id of allowedIds) { try { await detachImage(id) } catch {} }
                allowedIds = []
              }
            }
            if (allowedIds.length) {
              current.push(...allowedIds)
            }
          }
          // Reset input so selecting the same file again is detected by browsers
          fileInput.value = ''
          updateAttachIndicator()
          persistDraftAttachments()
        } catch (err) {
          console.error('[attach] failed to attach files', err)
        }
      })
      fileInput.__mcBound = true
    }
  } catch {}

  // Paste handling (images only) in input field – Input mode only logic
  try {
    if (inputField && !inputField.__mcPasteBound) {
      inputField.addEventListener('paste', async (e) => {
        try {
          const dt = e.clipboardData
          const items = dt && dt.items ? Array.from(dt.items) : []
          const files = dt && dt.files ? Array.from(dt.files) : []
          const hasImageFromItems = items.some((it) => it.kind === 'file' && it.type && it.type.startsWith('image/'))
          const hasImageFromFiles = files.some((f) => f && typeof f.type === 'string' && f.type.startsWith('image/'))
          const hasImage = hasImageFromItems || hasImageFromFiles
          if (!hasImage) return // let normal text paste proceed

          e.preventDefault()
          const res = await attachFromDataTransfer(dt)
          const newIds = (res && Array.isArray(res.ids)) ? [...res.ids] : []
          if (!newIds.length) return

          if (!Array.isArray(pendingMessageMeta.attachments)) pendingMessageMeta.attachments = []
          const current = pendingMessageMeta.attachments

          // Enforce per-message image count cap
          const remainingSlots = Math.max(0, IMAGE_QUOTAS.MAX_IMAGES_PER_MESSAGE - current.length)
          let allowedIds = newIds.slice(0, remainingSlots)
          const overflowIds = newIds.slice(remainingSlots)
          if (overflowIds.length) {
            console.warn(`[paste] exceeded image count cap; dropping ${overflowIds.length}`)
            for (const id of overflowIds) { try { await detachImage(id) } catch {} }
          }

          // Enforce per-message total bytes cap
          if (allowedIds.length) {
            try {
              const idsForCheck = [...current, ...allowedIds]
              const recs = await getImagesByIds(idsForCheck)
              const recById = new Map(idsForCheck.map((id, i) => [id, recs[i]]))
              const calcTotal = (ids) => ids.reduce((acc, id) => {
                const r = recById.get(id)
                return acc + (r && r.bytes ? r.bytes : 0)
              }, 0)
              let total = calcTotal(idsForCheck)
              const removed = []
              while (total > IMAGE_QUOTAS.MAX_TOTAL_BYTES_PER_MESSAGE && allowedIds.length) {
                const drop = allowedIds.pop()
                removed.push(drop)
                total = calcTotal([...current, ...allowedIds])
              }
              if (removed.length) {
                console.warn(`[paste] exceeded total bytes cap; dropping ${removed.length}`)
                for (const id of removed) { try { await detachImage(id) } catch {} }
              }
            } catch (err) {
              console.error('[paste] size check failed', err)
              for (const id of allowedIds) { try { await detachImage(id) } catch {} }
              allowedIds = []
            }
          }

          if (allowedIds.length) {
            current.push(...allowedIds)
            updateAttachIndicator()
            persistDraftAttachments()
          }
        } catch (err) {
          console.error('[paste] failed to attach images', err)
        }
      })
      inputField.__mcPasteBound = true
    }
  } catch {}

  // Initialize indicator on entry
  updateAttachIndicator()

  return function inputHandler(e) {
    if (window.modalIsActive && window.modalIsActive()) return false
    // Ctrl+F: open native file picker for images (Input mode only)
    if (e.ctrlKey && !e.shiftKey && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault()
      const fileInput = document.getElementById('attachFileInput')
      if (fileInput && typeof fileInput.click === 'function') {
        fileInput.click()
        return true
      }
      return false
    }
    // Ctrl+Shift+O: open draft images overlay (index 0)
    if (e.ctrlKey && e.shiftKey && (e.key === 'o' || e.key === 'O')) {
      e.preventDefault()
      const list = Array.isArray(pendingMessageMeta.attachments) ? pendingMessageMeta.attachments : []
      if (!list.length) return true
      // Clean stale references before opening overlay
      ;(async () => {
        await cleanStaleAttachments()
        const validList = Array.isArray(pendingMessageMeta.attachments) ? pendingMessageMeta.attachments : []
        if (!validList.length) return
        const overlay = openImageOverlay({
          modeManager,
          mode: 'draft',
          pendingMessageMeta,
          startIndex: 0,
          onChange: () => {
            updateAttachIndicator()
            persistDraftAttachments()
          },
        })
        // Expose a temporary jump helper while the overlay is open
        try { window.__mcDraftOverlay = overlay } catch {}
      })()
      return true
    }
    // Topic history picker (Ctrl+P opens chrono picker)
    if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) {
      e.preventDefault()
      openChronoTopicPicker &&
        openChronoTopicPicker({
          prevMode: 'input',
          getTopicHistory: () => topicHistory,
        })
      return true
    }
    // Emacs-like editing shortcuts in input (new message) box
    if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
      e.preventDefault()
      const el = inputField
      const end = el.selectionEnd
      const start = 0
      el.setRangeText('', start, end, 'end')
      return true
    }
    if (e.ctrlKey && (e.key === 'w' || e.key === 'W')) {
      e.preventDefault()
      const el = inputField
      const pos = el.selectionStart
      const left = el.value.slice(0, pos)
      const right = el.value.slice(el.selectionEnd)
      const newLeft = left.replace(/\s*[^\s]+\s*$/, '')
      const delStart = newLeft.length
      el.value = newLeft + right
      el.setSelectionRange(delStart, delStart)
      return true
    }
    if (e.ctrlKey && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault()
      inputField.setSelectionRange(0, 0)
      return true
    }
    if (e.ctrlKey && (e.key === 'e' || e.key === 'E')) {
      e.preventDefault()
      const len = inputField.value.length
      inputField.setSelectionRange(len, len)
      return true
    }
    if (e.ctrlKey && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault()
      const el = inputField
      const pos = el.selectionStart
      const text = el.value
      const match = text.slice(pos).match(/\S+\s*/)
      if (match) {
        const newPos = pos + match[0].length
        el.setSelectionRange(newPos, newPos)
      }
      return true
    }
    if (e.ctrlKey && e.shiftKey && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault()
      const el = inputField
      const pos = el.selectionStart
      const text = el.value.slice(0, pos)
      const match = text.match(/\s*\S+\s*$/)
      if (match) {
        const newPos = pos - match[0].length
        el.setSelectionRange(newPos, newPos)
      } else {
        el.setSelectionRange(0, 0)
      }
      return true
    }
    
    // DEV: Ctrl+G to test new sendNewMessage
    if (e.key === 'g' && e.ctrlKey && !e.shiftKey && !e.metaKey) {
      e.preventDefault()
      
      const params = {
        userText: inputField.value.trim()|| 'What is my next question?',
        imageIds: pendingMessageMeta.attachments || [],
        topicId: pendingMessageMeta.topicId || getCurrentTopicId(),
        model: pendingMessageMeta.model || getActiveModel(),
        visiblePairIds: [...new Set(activeParts.parts.map(pt => pt.pairId))],
        activePartId: activeParts.parts[activeParts.activeIndex]?.id || null,
        store: store,
        editingPairId: window.__editingPairId || null,
      }
      
      sendNewMessage(params)
        .then(pairId => {
          console.log('[DEV] Success! Created pair:', pairId)
        })
        .catch(err => {
          console.error('[DEV] Error:', err)
        })
      
      return true
    }
    
    // Ctrl+C to abort pending request
    if (e.key === 'c' && e.ctrlKey && !e.shiftKey && !e.metaKey) {
      const controller = window.__maichat && window.__maichat.requestController
      if (lifecycle.isPending() && controller) {
        e.preventDefault()
        controller.abort()
        return true
      }
      // If not pending, pass through (no-op)
      return false
    }
    // Shift+Enter = new line (don't send)
    if (e.key === 'Enter' && e.shiftKey) {
      return false
    }
    if (e.key === 'Enter') {
      const text = inputField.value.trim()

      // phase 1: input validation
      if (text) {
        if (lifecycle.isPending()) return true
        // phase 2: capture request context
        const editingId = window.__editingPairId
        const topicId = pendingMessageMeta.topicId || getCurrentTopicId()
        const model = pendingMessageMeta.model || getActiveModel()
        
        // Capture attachments before clearing draft (used throughout async send)
        const attachmentsCopy = Array.isArray(pendingMessageMeta.attachments)
          ? pendingMessageMeta.attachments.slice()
          : []

        // Add topic to history on send
        // addToTopicHistory(topicId) // depcrecated as redundant
        // topicHistoryIndex = -1 // Reset navigation index. deprecated as redundant

        //boundaryMgr.updateVisiblePairs(
        //  store.getAllPairs().sort((a, b) => a.createdAt - b.createdAt)
        //)

        boundaryMgr.setModel(pendingMessageMeta.model || getActiveModel()) // redundant, but cheap
        boundaryMgr.applySettings(getSettings())

        const preBoundary = boundaryMgr.getBoundary() // used for trim notifications
        const beforeIncludedIds = new Set(preBoundary.included.map((p) => p.id))

        lifecycle.beginSend()

        //setReadingMode(false)
        //try {
        //  window.__hud && window.__hud.setReadingMode && window.__hud.setReadingMode(false)
        //} catch {}

        // === EXTRACTED: Call sendWorkflow (async IIFE to avoid blocking) ===
        ;(async () => {
          const id = await executeSendWorkflow({
            // Input data
            text,
            topicId,
            model,
            attachments: attachmentsCopy,
            editingId,
            webSearchOverride: pendingMessageMeta.webSearchOverride,
            beforeIncludedIds,
            
            // Injected dependencies
            store,
            lifecycle,
            boundaryMgr,
            historyRuntime,
            activeParts,
            scrollController,
            requestDebug,
            updateSendDisabled,
            getSettings,
            sanitizeDisplayPreservingTokens,
            escapeHtmlAttr,
            escapeHtml,
          })

          // === POST-SEND UI UPDATES (after workflow completes) ===
          historyRuntime.renderCurrentView({ preserveActive: true })
          
          // Focus the new pair's last user part explicitly (meta remains non-focusable)
          try {
            const pane = document.getElementById('historyPane')
            const userEls = pane
              ? pane.querySelectorAll(
                  `.message[data-pair-id="${id}"][data-role="user"], .part[data-pair-id="${id}"][data-role="user"]`
                )
              : null
            const lastUserEl = userEls && userEls.length ? userEls[userEls.length - 1] : null
            if (lastUserEl) {
              const lastUserId = lastUserEl.getAttribute('data-part-id')
              if (lastUserId) {
                activeParts.setActiveById(lastUserId)
              }
            } else {
              activeParts.last()
            }
          } catch {
            activeParts.last()
          }

          historyRuntime.applyActiveMessage()
          
          // Scroll to bottom to show the newly sent user message
          if (scrollController && scrollController.scrollToBottom) {
            requestAnimationFrame(() => {
              scrollController.scrollToBottom(false)
            })
          }
          updateSendDisabled()
        })()

        // === IMMEDIATE POST-SEND CLEANUP (before async workflow completes) ===
        inputField.value = ''
        pendingMessageMeta.attachments = []  // Clear draft attachments after send
        try {
          localStorage.removeItem('maichat_draft_attachments')
          localStorage.removeItem('maichat_draft_text')
        } catch {}
        updateAttachIndicator()
      }
      return true
    }
    if (e.key === 'Escape') {
      modeManager.set('view')
      return true
    }
    return false
  }
}
