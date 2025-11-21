// file purpose?

import { parse } from '../command/parser.js'
import { hasUnargumentedTopicFilter, hasUnargumentedModelFilter } from '../command/parser.js'
import { evaluate } from '../command/evaluator.js'
import { getSettings } from '../../core/settings/index.js'
import { createKeyRouter } from './keyRouter.js'
import { splitFilterAndCommand } from '../command/colon/colonCommandSplitter.js'
import { parseColonCommand } from '../command/colon/colonCommandParser.js'
import { createCommandRegistry } from '../command/colon/colonCommandRegistry.js'
import { resolveTopicFilter } from '../command/topicResolver.js'
import { addToTopicHistory } from './inputKeys.js'
import { openConfirmOverlay } from '../command/confirmOverlay.js'
// Topics moved (Phase 6.4)
import { createTopicPicker } from '../topics/topicPicker.js'
import { createChronoTopicPicker } from '../topics/chronoTopicPicker.js'
import { openTopicEditor } from '../topics/topicEditor.js'
// Config overlays moved (Phase 6.6)
import { openSettingsOverlay } from '../config/settingsOverlay.js'
import { openApiKeysOverlay } from '../config/apiKeysOverlay.js'
import { openModelSelector } from '../config/modelSelector.js'
import { openModelEditor } from '../config/modelEditor.js'
import { openHelpOverlay } from '../config/helpOverlay.js'
import { openDailyStatsOverlay } from '../config/dailyStatsOverlay.js'
import { getActiveModel, getModelMeta } from '../../core/models/modelCatalog.js'
// Compose pipeline not yet moved (Phase 6.5). Use current send/ path.
// Compose pipeline moved (Phase 6.5) to features/compose
import { executeSend } from '../compose/pipeline.js'
import { sanitizeAssistantText } from './sanitizeAssistant.js'
import { extractCodeBlocks } from '../codeDisplay/codeExtractor.js'
import { extractEquations } from '../codeDisplay/equationExtractor.js'
import { createCodeOverlay } from '../codeDisplay/codeOverlay.js'
import { createEquationOverlay } from '../codeDisplay/equationOverlay.js'
import { openModal } from '../../shared/openModal.js'
import { setupCopyShortcuts } from '../formatting/copyUtilities.js'
import { createViewKeyHandler } from './viewKeys.js'
import { openSourcesOverlay } from '../history/sourcesOverlay.js'
import { openReaskOverlay } from '../history/reaskOverlay.js'
import { bindNormalReaskActions } from '../history/historyView.js'
import { openImageOverlay } from '../images/imageOverlay.js'
import { sendNewMessage } from '../newMessage/sendNewMessageOrchestrator.js'
import { createCommandKeyHandler } from './commandKeys.js'
import { createInputKeyHandler } from './inputKeys.js'
import { createAppMenuController } from './appMenu.js'
import {
  loadCommandHistory,
  saveCommandHistory,
  pushCommand,
  setFilterActive as setFilterActivePref,
  getFilterActive,
} from './userPrefs.js'

export function createInteraction({
  ctx,
  dom: { commandInput, commandErrEl, inputField, sendBtn, historyPaneEl },
  historyRuntime,
  requestDebug,
  hudRuntime,
}) {
  // Restore local state and utilities (previously at top)
  const { store, activeParts, lifecycle, boundaryMgr, pendingMessageMeta } = ctx
  const modeManager = window.__modeManager
  // Reading Mode toggle (centers on j/k when active)
  let readingMode = false
  let currentTopicId = store.rootTopicId
  let commandHistory = loadCommandHistory()
  let commandHistoryPos = -1
  function pushCommandHistory(q) {
    commandHistory = pushCommand(commandHistory, q)
    saveCommandHistory(commandHistory)
  }
  function setFilterActive(active) {
    setFilterActivePref(!!active)
  }
  function restoreLastFilter() {
    if (getFilterActive() && commandHistory.length > 0) {
      const lastFilter = commandHistory[commandHistory.length - 1]
      if (lastFilter) {
        commandInput.value = lastFilter
        // Trigger filter application logic (same as pressing Enter)
        lifecycle.setFilterQuery(lastFilter)
        historyRuntime.renderCurrentView({ preserveActive: true })
        try {
          const act = ctx.activeParts && ctx.activeParts.active && ctx.activeParts.active()
          const id = act && act.id
          if (id && ctx.scrollController && ctx.scrollController.alignTo) {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                ctx.scrollController.alignTo(id, 'bottom', false)
              })
            })
          }
        } catch {}
        modeManager.set('view')
      }
    }
  }
  function historyPrev() {
    if (!commandHistory.length) return
    if (commandHistoryPos === -1) commandHistoryPos = commandHistory.length
    if (commandHistoryPos > 0) {
      commandHistoryPos--
      // If the new position shows the same value as currently in input, skip to previous
      if (commandHistory[commandHistoryPos] === commandInput.value && commandHistoryPos > 0) {
        commandHistoryPos--
      }
      commandInput.value = commandHistory[commandHistoryPos]
    }
  }
  function historyNext() {
    if (!commandHistory.length) return
    if (commandHistoryPos === -1) return
    if (commandHistoryPos < commandHistory.length) commandHistoryPos++
    if (commandHistoryPos === commandHistory.length) {
      commandInput.value = ''
      commandHistoryPos = -1
    } else {
      commandInput.value = commandHistory[commandHistoryPos]
    }
  }
  let lastAppliedFilter = ''
  let commandModeEntryActivePartId = null
  let hudEnabled = false
  let maskDebug = true
  const BASE =
    typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL
      ? import.meta.env.BASE_URL
      : '/'
  const tutorialUrl = (BASE.endsWith('/') ? BASE : BASE + '/') + 'tutorial.html'

  // Create overlay instances (used by view handler and others)
  const codeOverlay = createCodeOverlay({ modeManager })
  const equationOverlay = createEquationOverlay({ modeManager })

  // Setup copy utilities and expose globally for view handler
  const copyUtils = setupCopyShortcuts(activeParts)
  window.copyCodeBlock = copyUtils.copyCode
  window.copyEquation = copyUtils.copyEquation
  window.copyMessage = copyUtils.copyMessage

  // VIEW handler extracted
  const getReadingMode = () => readingMode
  const setReadingMode = (v) => {
    readingMode = !!v
  }
  const viewHandler = createViewKeyHandler({
    modeManager,
    activeParts,
    historyRuntime,
    scrollController: ctx.scrollController,
    hudRuntime,
    store,
    codeOverlay,
    equationOverlay,
    getReadingMode,
    setReadingMode,
    cycleStar,
    toggleFlag,
    setStarRating,
    handleEditIfErrorActive,
    handleDeleteIfErrorActive,
    openSources: (pairId) => openSourcesOverlay({ store, pairId, modeManager }),
    openImages: (pairId, startIndex = 0) => {
      const pair = store.pairs.get(pairId)
      if (pair && Array.isArray(pair.attachments) && pair.attachments.length) {
        openImageOverlay({ modeManager, mode: 'view', pair, startIndex })
      }
    },
    openReaskIfAllowed: () => {
      const act = activeParts.active()
      if (!act) return false
      const pair = store.pairs.get(act.pairId)
      if (!pair || pair.lifecycleState === 'error') return false
      if (!historyRuntime.isLastInFiltered || !historyRuntime.isLastInFiltered(pair.id)) return false
      if (window.modalIsActive && window.modalIsActive()) return false
      const defModel = (ctx.pendingMessageMeta && ctx.pendingMessageMeta.model) || getActiveModel()
      openReaskOverlay({
        modeManager,
        defaultModel: defModel,
        onConfirm: (model) => {
          reAskInPlace(pair.id, model)
        },
      })
      return true
    },
    restorePreviousIfAllowed: () => {
      const act = activeParts.active()
      if (!act) return false
      const pair = store.pairs.get(act.pairId)
      if (!pair || pair.lifecycleState === 'error') return false
      if (!pair.previousAssistantText) return false
      restorePrevious(pair.id)
      return true
    },
  })

  // COMMAND handler extracted
  const commandHandler = createCommandKeyHandler({
    modeManager,
    commandInput,
    commandErrEl,
    lifecycle,
    store,
    boundaryMgr,
    pendingMessageMeta,
    historyRuntime,
    activeParts,
    scrollController: ctx.scrollController,
    hudRuntime,
    openConfirmOverlay,
    getCurrentTopicId: () => currentTopicId,
    pushCommandHistory: (q) => {
      pushCommandHistory(q)
      commandHistoryPos = -1
    },
    historyPrev,
    historyNext,
    setFilterActive,
    getCommandModeEntryActivePartId: () => commandModeEntryActivePartId,
  })

  const inputHandler = createInputKeyHandler({
    modeManager,
    inputField,
    lifecycle,
    store,
    boundaryMgr,
    pendingMessageMeta,
    historyRuntime,
    activeParts,
    scrollController: ctx.scrollController,
    requestDebug,
    updateSendDisabled,
    getCurrentTopicId: () => currentTopicId,
    getReadingMode: () => readingMode,
    setReadingMode: (v) => {
      readingMode = !!v
    },
    sanitizeDisplayPreservingTokens,
    escapeHtmlAttr,
    escapeHtml,
    renderPendingMeta,
    openChronoTopicPicker,
  })
  function cycleStar() {
    const act = activeParts.active()
    if (!act) return
    const pair = store.pairs.get(act.pairId)
    if (!pair) return
    const next = (pair.star + 1) % 4
    store.updatePair(pair.id, { star: next })
    updateMetaBadgesInline(pair.id, { star: next })
  }
  function setStarRating(star) {
    const act = activeParts.active()
    if (!act) return
    const pair = store.pairs.get(act.pairId)
    if (!pair) return
    if (pair.star === star) return
    store.updatePair(pair.id, { star })
    updateMetaBadgesInline(pair.id, { star })
  }
  function toggleFlag() {
    const act = activeParts.active()
    if (!act) return
    const pair = store.pairs.get(act.pairId)
    if (!pair) return
    const next = pair.colorFlag === 'b' ? 'g' : 'b'
    store.updatePair(pair.id, { colorFlag: next })
    updateMetaBadgesInline(pair.id, { colorFlag: next })
  }
  function openQuickTopicPicker({ prevMode }) {
    const openMode = prevMode || modeManager.mode
    createTopicPicker({
      store,
      modeManager,
      onSelect: (topicId) => {
        if (openMode === 'input') {
          pendingMessageMeta.topicId = topicId
          renderPendingMeta()
          try {
            localStorage.setItem('maichat_pending_topic', pendingMessageMeta.topicId)
          } catch {}

          // NEW: Apply topic defaults (defaultModel and webSearchOverride)
          const topic = store.topics.get(topicId)
          if (topic) {
            // Apply default model if configured and enabled
            if (topic.defaultModel) {
              const modelMeta = getModelMeta(topic.defaultModel)
              if (modelMeta && modelMeta.enabled) {
                pendingMessageMeta.model = topic.defaultModel
                renderPendingMeta()
                try { localStorage.setItem('maichat_pending_model', pendingMessageMeta.model) } catch {}
              }
            }
            // Apply web search override if configured
            if (typeof topic.webSearchOverride === 'boolean') {
              pendingMessageMeta.webSearchOverride = topic.webSearchOverride
            } else {
              delete pendingMessageMeta.webSearchOverride
            }
          }

          // Add to topic history
          addToTopicHistory(topicId)

          // Auto-refresh history if filter contains unargumented 't'
          const currentFilter = lifecycle.getFilterQuery ? lifecycle.getFilterQuery() : ''
          if (currentFilter) {
            try {
              const ast = parse(currentFilter)
              if (hasUnargumentedTopicFilter(ast)) {
                // Re-apply filter with new topic - focus LAST message (like G key)
                historyRuntime.renderCurrentView({ preserveActive: false })

                // Focus last message and scroll to bottom (command mode pattern)
                try {
                  activeParts.last()
                  if (ctx.scrollController && ctx.scrollController.scrollToBottom) {
                    // Delayed scroll to catch async KaTeX rendering, then apply active styling
                    setTimeout(() => {
                      ctx.scrollController.scrollToBottom(false)
                      // Apply active message styling AFTER scroll completes
                      requestAnimationFrame(() => {
                        historyRuntime.applyActiveMessage()
                      })
                    }, 0) // testing 0 delay. with topic filter
                  }
                } catch {}
              }
            } catch {
              // Parse error - ignore, don't refresh
            }
          }
        } else if (openMode === 'view') {
          const act = activeParts.active()
          if (act) {
            const pair = store.pairs.get(act.pairId)
            if (pair) {
              store.updatePair(pair.id, { topicId })
              // Inline update of topic badge; do not rebuild list per spec
              updateMetaBadgesInline(pair.id, { topicId })
              // Preserve focus styling
              activeParts.setActiveById(act.id)
              historyRuntime.applyActiveMessage()
            }
          }
        }
        if (prevMode) modeManager.set(prevMode)
      },
      onCancel: () => {
        if (prevMode) modeManager.set(prevMode)
      },
    })
  }

  function openChronoTopicPicker({ prevMode, topicHistory, getTopicHistory }) {
    const openMode = prevMode || modeManager.mode
    const currentTopicId = pendingMessageMeta.topicId || currentTopicId
    const history = getTopicHistory ? getTopicHistory() : topicHistory || []

    createChronoTopicPicker({
      store,
      modeManager,
      topicHistory: history,
      currentTopicId: currentTopicId,
      onSelect: (topicId) => {
        if (openMode === 'input') {
          pendingMessageMeta.topicId = topicId
          renderPendingMeta()
          try {
            localStorage.setItem('maichat_pending_topic', pendingMessageMeta.topicId)
          } catch {}

          // NEW: Apply topic defaults (defaultModel and webSearchOverride)
          const topic = store.topics.get(topicId)
          if (topic) {
            // Apply default model if configured and enabled
            if (topic.defaultModel) {
              const modelMeta = getModelMeta(topic.defaultModel)
              if (modelMeta && modelMeta.enabled) {
                pendingMessageMeta.model = topic.defaultModel
                renderPendingMeta()
                try { localStorage.setItem('maichat_pending_model', pendingMessageMeta.model) } catch {}
              }
            }
            // Apply web search override if configured
            if (typeof topic.webSearchOverride === 'boolean') {
              pendingMessageMeta.webSearchOverride = topic.webSearchOverride
            } else {
              delete pendingMessageMeta.webSearchOverride
            }
          }

          // Add to topic history
          addToTopicHistory(topicId)

          // Auto-refresh history if filter contains unargumented 't'
          const currentFilter = lifecycle.getFilterQuery ? lifecycle.getFilterQuery() : ''
          if (currentFilter) {
            try {
              const ast = parse(currentFilter)
              if (hasUnargumentedTopicFilter(ast)) {
                // Re-apply filter with new topic - focus LAST message (like G key)
                historyRuntime.renderCurrentView({ preserveActive: false })

                // Focus last message and scroll to bottom (command mode pattern)
                try {
                  activeParts.last()
                  if (ctx.scrollController && ctx.scrollController.scrollToBottom) {
                    // Delayed scroll to catch async KaTeX rendering, then apply active styling
                    setTimeout(() => {
                      ctx.scrollController.scrollToBottom(false)
                      // Apply active message styling AFTER scroll completes
                      requestAnimationFrame(() => {
                        historyRuntime.applyActiveMessage()
                      })
                    }, 0) // set delay to 0 to test
                  }
                } catch {}
              }
            } catch {
              // Parse error - ignore, don't refresh
            }
          }
        }
        if (prevMode) modeManager.set(prevMode)
      },
      onCancel: () => {
        if (prevMode) modeManager.set(prevMode)
      },
    })
  }

  function updateMetaBadgesInline(pairId, changes) {
    try {
      const pane = document.getElementById('historyPane')
      if (!pane) return
      // Query for assistant-meta in message-based view
      const metaRoot = pane.querySelector(
        `.message.assistant[data-pair-id="${pairId}"] .assistant-meta`
      )
      if (!metaRoot) return
      const left = metaRoot.querySelector('.meta-left')
      const right = metaRoot.querySelector('.meta-right')
      if (!left || !right) return
      // Stars
      if (Object.prototype.hasOwnProperty.call(changes, 'star')) {
        const v = Math.max(0, Math.min(3, Number(changes.star) || 0))
        const starsEl = left.querySelector('.badge.stars')
        if (starsEl) {
          starsEl.textContent = '★'.repeat(v) + '☆'.repeat(Math.max(0, 3 - v))
        }
      }
      // Flag
      if (Object.prototype.hasOwnProperty.call(changes, 'colorFlag')) {
        const flagEl = left.querySelector('.badge.flag')
        if (flagEl) {
          flagEl.setAttribute('data-flag', changes.colorFlag === 'b' ? 'b' : 'g')
          flagEl.title = changes.colorFlag === 'b' ? 'Flagged (blue)' : 'Unflagged (grey)'
        }
      }
      // Topic path text/title
      if (Object.prototype.hasOwnProperty.call(changes, 'topicId')) {
        const badge = left.querySelector('.badge.topic')
        const topic = store.topics.get(changes.topicId)
        if (badge && topic) {
          const path = formatTopicPath(topic.id)
          badge.textContent = middleTruncate(path, 72)
          badge.title = path
        }
      }
    } catch {}
  }
  // App menu controller
  const appMenu = createAppMenuController({
    modeManager,
    store,
    activeParts,
    historyRuntime,
    pendingMessageMeta,
    tutorialUrl,
    overlays: {
      openTopicEditor,
      openModelEditor,
      openDailyStatsOverlay,
      openSettingsOverlay,
      openApiKeysOverlay,
      openHelpOverlay,
    },
    getActiveModel,
    renderPendingMeta,
    scrollController: ctx.scrollController,
  })
  appMenu.handleGlobalClick()
  function renderPendingMeta() {
    const pm = document.getElementById('pendingModel')
    const pt = document.getElementById('pendingTopic')
    if (pm) {
      pm.textContent = pendingMessageMeta.model || getActiveModel() || 'gpt-4o-mini'
      if (!pm.textContent) pm.textContent = 'gpt-4o-mini'
      pm.title = `Model: ${pendingMessageMeta.model || getActiveModel() || 'gpt-4o-mini'} (Ctrl+M select (Input mode) · Ctrl+Shift+M manage (any mode))`
    }
    if (pt) {
      const topic = store.topics.get(pendingMessageMeta.topicId || currentTopicId)
      if (topic) {
        const path = formatTopicPath(topic.id)
        pt.textContent = middleTruncate(path, 90)
        pt.title = `Topic: ${path} (Ctrl+T pick, Ctrl+Shift+T edit)`
      } else {
        const rootTopic = store.topics.get(store.rootTopicId)
        if (rootTopic) {
          const path = formatTopicPath(rootTopic.id)
          pt.textContent = middleTruncate(path, 90)
          pt.title = `Topic: ${path} (Ctrl+T pick, Ctrl+Shift+T edit)`
        } else {
          pt.textContent = 'Select Topic'
          pt.title = 'No topic found (Ctrl+T)'
        }
      }
    }
  }
  function formatTopicPath(id) {
    const parts = store.getTopicPath(id)
    if (parts[0] === 'Root') parts.shift()
    return parts.join(' > ')
  }
  function middleTruncate(str, max) {
    if (str.length <= max) return str
    const keep = max - 3
    const head = Math.ceil(keep / 2)
    const tail = Math.floor(keep / 2)
    return str.slice(0, head) + '…' + str.slice(str.length - tail)
  }
  function updateSendDisabled() {
    if (!sendBtn) return
    const empty = inputField.value.trim().length === 0
    const zeroIncluded =
      historyRuntime.getContextStats() && historyRuntime.getContextStats().includedCount === 0
    const pending = lifecycle.isPending()
    sendBtn.disabled = empty || pending || zeroIncluded
    if (pending) {
      // Replace dot animation with timer (mm:ss)
      if (sendBtn.__animTimer) {
        clearInterval(sendBtn.__animTimer)
        sendBtn.__animTimer = null
      }
      if (!sendBtn.__pendingTimer) {
        sendBtn.__pendingStart = Date.now()
        const renderTimer = () => {
          if (!lifecycle.isPending()) {
            return
          }
          const elapsed = Date.now() - (sendBtn.__pendingStart || Date.now())
          const mm = Math.floor(elapsed / 60000)
          const ss = Math.floor((elapsed % 60000) / 1000)
          const label = `AI is thinking: ${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
          // Include a hidden widest-case placeholder (59:59) to keep width constant
          sendBtn.innerHTML = `<span class=\"lbl\" data-base=\"AI is thinking: 59:59\">${label}</span>`
        }
        renderTimer()
        sendBtn.__pendingTimer = setInterval(() => {
          if (!lifecycle.isPending()) {
            return
          }
          renderTimer()
        }, 1000)
      }
      sendBtn.classList.add('pending')
      sendBtn.title = 'Request in progress…'
    } else {
      if (sendBtn.__pendingTimer) {
        clearInterval(sendBtn.__pendingTimer)
        sendBtn.__pendingTimer = null
      }
      if (sendBtn.__animTimer) {
        clearInterval(sendBtn.__animTimer)
        sendBtn.__animTimer = null
      }
      sendBtn.textContent = 'Send'
      sendBtn.classList.remove('pending')
      if (zeroIncluded) {
        sendBtn.title = 'Cannot send: no pairs included in context (token budget exhausted)'
      } else {
        sendBtn.title = 'Send'
      }
    }
  }

  modeManager.onChange((m) => {
    historyRuntime.renderStatus()
    if (m === 'view') {
      commandInput.blur()
      inputField.blur()
    } else if (m === 'input') {
      // Delay focus to avoid mouse click interference
      requestAnimationFrame(() => inputField.focus())
    } else if (m === 'command') {
      commandModeEntryActivePartId = activeParts.active() ? activeParts.active().id : null
      // Reset command history position so first Ctrl-P shows previous command, not current
      commandHistoryPos = commandHistory.length
      // Delay focus to avoid mouse click interference
      requestAnimationFrame(() => commandInput.focus())
    }
  })
  const keyRouter = createKeyRouter({
    modeManager,
    handlers: { view: viewHandler, command: commandHandler, input: inputHandler },
  })
  keyRouter.attach()

  // Helpers for segmented sanitize preserving placeholders & inline equation markers
  function sanitizeDisplayPreservingTokens(text) {
    if (!text) return text || ''
    const TOKEN_REGEX = /(\[[a-zA-Z0-9_]+-\d+\]|\[eq-\d+\]|__EQINL_\d+__)/g
    const parts = text.split(TOKEN_REGEX).filter((p) => p !== '' && p != null)
    let out = ''
    for (const part of parts) {
      if (TOKEN_REGEX.test(part)) {
        out += part // token untouched
      } else {
        out += sanitizeAssistantText(part)
      }
      TOKEN_REGEX.lastIndex = 0
    }
    return out
  }
  function escapeHtmlAttr(str) {
    return String(str).replace(
      /[&<>"']/g,
      (s) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[s]
    )
  }
  function escapeHtml(str) {
    const div = document.createElement('div')
    div.textContent = str
    return div.innerHTML
  }
  document.addEventListener('click', (e) => {
    const msgEl = e.target.closest('.message')
    if (!msgEl) return
    // Allow interactive controls to work without changing selection when inside assistant-meta
    const t = e.target
    const tag = t && t.tagName ? t.tagName.toLowerCase() : ''
    const isInteractive =
      tag === 'button' ||
      tag === 'a' ||
      tag === 'input' ||
      tag === 'textarea' ||
      t.getAttribute('role') === 'button' ||
      t.isContentEditable
    if (isInteractive) return
    const id = msgEl.getAttribute('data-part-id')
    if (!id) return
    activeParts.setActiveById(id)
    historyRuntime.applyActiveMessage()
    // No auto-scroll on click per spec. If reading mode is ON, we still center for readability.
    try {
      if (readingMode && ctx.scrollController && ctx.scrollController.alignToMessage) {
        const act = activeParts.active()
        if (act) ctx.scrollController.alignToMessage(act.id, 'center', false)
      }
    } catch {}
  })
  // Bind normal re-ask button clicks
  try {
    const histRoot = document.getElementById('history')
    bindNormalReaskActions(histRoot, {
      onReask: (pairId) => {
        const pair = store.pairs.get(pairId)
        if (!pair || pair.lifecycleState === 'error') return
        if (!historyRuntime.isLastInFiltered || !historyRuntime.isLastInFiltered(pair.id)) return
        const defModel = (ctx.pendingMessageMeta && ctx.pendingMessageMeta.model) || getActiveModel()
        openReaskOverlay({
          modeManager,
          defaultModel: defModel,
          onConfirm: (model) => {
            reAskInPlace(pair.id, model)
          },
        })
      },
    })
  } catch {}
  window.addEventListener('keydown', (e) => {
    if (!e.ctrlKey) return
    const k = e.key.toLowerCase()
    if (window.modalIsActive && window.modalIsActive()) return
    if (k === 'i') {
      e.preventDefault()
      modeManager.set('input')
    } else if (e.shiftKey && k === 'd') {
      e.preventDefault()
      openDailyStatsOverlay({ store, activeParts, historyRuntime, modeManager })
    } else if (k === 'd' && !e.shiftKey) {
      e.preventDefault()
      modeManager.set('command')
    } else if (k === 'v') {
      e.preventDefault()
      modeManager.set('view')
    } else if (e.shiftKey && k === 'h') {
      e.preventDefault()
      try {
        window.open(tutorialUrl, '_blank', 'noopener')
      } catch {
        window.location.href = tutorialUrl
      }
    } else if (k === 't') {
      if (e.shiftKey) {
        if (!document.getElementById('appLoading')) {
          e.preventDefault()
          openTopicEditor({
            store,
            onClose: ({ dirty } = {}) => {
              if (dirty) {
                // Re-render to update topic badges in history (no scrolling needed)
                historyRuntime.renderCurrentView({ preserveActive: true })
              }
              // Mode restoration handled by modal's restoreMode: true
            },
          })
        }
      } else {
        if (!document.getElementById('appLoading')) {
          e.preventDefault()
          const prevMode = modeManager.mode
          openQuickTopicPicker({ prevMode })
        }
      }
    } else if (k === 'm') {
      if (e.shiftKey) {
        e.preventDefault()
        const prevMode = modeManager.mode
        openModelEditor({
          store,
          onClose: ({ dirty } = {}) => {
            pendingMessageMeta.model = getActiveModel()
            renderPendingMeta()
              try { localStorage.setItem('maichat_pending_model', pendingMessageMeta.model) } catch {}
            if (dirty) {
              // Re-render to update model badges in history (no scrolling needed)
              historyRuntime.renderCurrentView({ preserveActive: true })
            }
            modeManager.set(prevMode)
          },
        })
      } else {
        if (modeManager.mode !== 'input') return
        e.preventDefault()
        const prevMode = modeManager.mode
        openModelSelector({
          onClose: ({ dirty } = {}) => {
            pendingMessageMeta.model = getActiveModel()
            renderPendingMeta()
              try { localStorage.setItem('maichat_pending_model', pendingMessageMeta.model) } catch {}
            if (dirty) {
              // Check if there's an unargumented 'm' filter active
              const currentFilter = lifecycle.getFilterQuery ? lifecycle.getFilterQuery() : ''
              if (currentFilter) {
                try {
                  const ast = parse(currentFilter)
                  if (hasUnargumentedModelFilter(ast)) {
                    // Re-apply filter with new model - focus LAST message
                    historyRuntime.renderCurrentView({ preserveActive: false })
                    
                    // Focus last message and scroll to bottom
                    try {
                      activeParts.last()
                      if (ctx.scrollController && ctx.scrollController.scrollToBottom) {
                        setTimeout(() => {
                          ctx.scrollController.scrollToBottom(false)
                          requestAnimationFrame(() => {
                            historyRuntime.applyActiveMessage()
                          })
                        }, 0)
                      }
                    } catch {}
                  }
                } catch {
                  // Parse error - ignore, don't refresh
                }
              }
            }
            modeManager.set(prevMode)
          },
        })
      }
    } else if (k === ';' || e.code === 'Semicolon') {
      e.preventDefault()
      const prevMode = modeManager.mode
      openApiKeysOverlay({
        modeManager,
        onClose: () => {
          modeManager.set(prevMode)
        },
      })
    } else if (k === ',') {
      e.preventDefault()
      const prevMode = modeManager.mode
      openSettingsOverlay({
        onClose: () => {
          modeManager.set(prevMode)
        },
      })
    } else if (e.key === '.' || e.code === 'Period') {
      e.preventDefault()
      appMenu.toggle()
    } else if (e.shiftKey && k === 'r') {
      e.preventDefault()
      requestDebug.toggle()
    } else if (e.shiftKey && k === 's') {
      e.preventDefault()
      window.seedTestMessages && window.seedTestMessages()
    }
    // Removed global error actions for clarity; use VIEW-only e/d on focused row
  })
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F1') {
      e.preventDefault()
      openHelpOverlay({ modeManager, onClose: () => {} })
    }
  })
  if (sendBtn) {
    // Delegate to Enter key handler (inputKeys.js)
    // This ensures Send button uses the same complete logic as Enter:
    // - Topic history tracking
    // - Boundary management
    // - Code/equation extraction
    // - All error handling
    sendBtn.addEventListener('click', () => {
      // Only work in INPUT mode
      if (modeManager.mode !== 'input') return
      
      // Dispatch Enter key event
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        bubbles: true,
        cancelable: true
      })
      inputField.dispatchEvent(enterEvent)
    })
    inputField.addEventListener('input', updateSendDisabled)
  }
  // No persistent policy to clear on scroll in stateless model
  // No policy clearing needed on typing in stateless model
  // Helpers for error edit/delete actions
  function isErrorPair(pairId) {
    const p = store.pairs.get(pairId)
    return !!p && p.lifecycleState === 'error'
  }
  function handleEditIfErrorActive() {
    const act = activeParts.active()
    if (!act) return false
    const pair = store.pairs.get(act.pairId)
    if (!pair || pair.lifecycleState !== 'error') return false
    prepareEditResend(pair.id)
    return true
  }
  function handleDeleteIfErrorActive() {
    const act = activeParts.active()
    if (!act) return false
    const pair = store.pairs.get(act.pairId)
    if (!pair || pair.lifecycleState !== 'error') return false
    deletePairWithFocus(pair.id)
    return true
  }
  function prepareEditResend(pairId) {
    const pair = store.pairs.get(pairId)
    if (!pair) return
    inputField.value = pair.userText || ''
    pendingMessageMeta.topicId = pair.topicId
    // Model intentionally NOT copied - preserve user's current model selection
    // Copy attachments into draft so edit-resend preserves images
    try {
      if (!Array.isArray(pendingMessageMeta.attachments)) pendingMessageMeta.attachments = []
      const src = Array.isArray(pair.attachments) ? pair.attachments : []
      pendingMessageMeta.attachments = src.slice()
      // Persist draft state to survive reload (no typing listeners)
      try {
        localStorage.setItem('maichat_draft_attachments', JSON.stringify(pendingMessageMeta.attachments))
        localStorage.setItem('maichat_draft_text', inputField.value || '')
      } catch {}
      // Update small attachments indicator (icon + count)
      try {
        const ind = document.getElementById('attachIndicator')
        const cnt = document.getElementById('attachCount')
        const n = pendingMessageMeta.attachments.length
        if (ind && cnt) {
          if (n === 0) {
            cnt.textContent = ''
            ind.setAttribute('aria-label', 'No images attached')
            ind.style.display = 'none'
            ind.hidden = false
          } else {
            cnt.textContent = n > 1 ? String(n) : ''
            ind.setAttribute('aria-label', n === 1 ? '1 image attached' : `${n} images attached`)
            ind.style.display = 'inline-flex'
            ind.hidden = false
          }
        }
      } catch {}
    } catch {}
    renderPendingMeta()
    // Delete the original pair after copying its content, but keep images (transfer on resend)
    store.removePair(pair.id, true)
    historyRuntime.renderCurrentView({ preserveActive: true })
    // Focus on last message and scroll to bottom
    try {
      activeParts.last()
      historyRuntime.applyActiveMessage()
      if (ctx.scrollController && ctx.scrollController.scrollToBottom) {
        setTimeout(() => {
          ctx.scrollController.scrollToBottom(false)
        }, 0)
      }
    } catch {}
    modeManager.set('input')
    inputField.focus()
    window.__editingPairId = pair.id
  }
  function deletePairWithFocus(pairId) {
    store.removePair(pairId)
    historyRuntime.renderCurrentView({ preserveActive: true })
    // Always focus on last message and scroll to bottom after deletion
    try {
      activeParts.last()
      historyRuntime.applyActiveMessage()
      if (ctx.scrollController && ctx.scrollController.scrollToBottom) {
        setTimeout(() => {
          ctx.scrollController.scrollToBottom(false)
        }, 0)
      }
    } catch {
      // If no parts remain (empty history), no focus needed
    }
  }
  async function reAskInPlace(pairId, model) {
    const USE_NEW_PIPELINE = localStorage.getItem('maichat_use_new_pipeline') === 'true'
    
    if (USE_NEW_PIPELINE) {
      // === NEW PIPELINE ===
      const pair = store.pairs.get(pairId)
      if (!pair) return
      
      // Mark pending re-ask to disable the button
      try { window.__pendingReaskPairId = pair.id } catch {}
      
      // Build params for new pipeline
      const params = {
        userText: pair.userText || '',
        pendingImageIds: (pair.attachments || []).slice(),
        topicId: pair.topicId,
        modelId: model || getActiveModel(),
        visiblePairIds: [...new Set(activeParts.parts.map(pt => pt.pairId))],
        activePartId: activeParts.parts[activeParts.activeIndex]?.id || null,
        editingPairId: pairId,  // This makes it re-ask
      }
      
      // Send (async, fire-and-forget)
      sendNewMessage(params).finally(() => {
        // Clear pending flag after completion
        try { window.__pendingReaskPairId = null } catch {}
      })
      
    } else {
      // === OLD PIPELINE ===
      const pair = store.pairs.get(pairId)
      if (!pair) return
      // Mark pending re-ask to disable the button (no spinner badge in history)
      try { window.__pendingReaskPairId = pair.id } catch {}
      // Show input pending UI for consistency with normal send
      lifecycle.beginSend()
      updateSendDisabled()
      // Switch to input mode and align to bottom (consistency: like new send)
      try { modeManager.set('input') } catch {}
      try {
        // Focus user's part of this pair if available and bottom-align it (parity with new send UX)
        const pane = document.getElementById('historyPane')
        const userEl = pane && pane.querySelector(`.message[data-pair-id="${pair.id}"][data-role="user"], .part[data-pair-id="${pair.id}"][data-role="user"]`)
        const uid = userEl && userEl.getAttribute('data-part-id')
        if (uid) {
          activeParts.setActiveById(uid)
          historyRuntime.applyActiveMessage()
          if (ctx.scrollController && ctx.scrollController.alignTo) {
            ctx.scrollController.alignTo(uid, 'bottom', false)
          }
        }
      } catch {}
      const controller = new AbortController()
      const settings = getSettings()
      const timeoutSec = settings.requestTimeoutSec || 120
      const timeoutMs = timeoutSec * 1000
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
      if (!window.__maichat) window.__maichat = {}
      window.__maichat.requestController = controller
      try {
        // Build WYSIWYG visible pairs chrono
        const currentPairs = activeParts.parts
          .map((pt) => store.pairs.get(pt.pairId))
          .filter(Boolean)
        const chrono = [...new Set(currentPairs)].sort((a, b) => a.createdAt - b.createdAt)
        boundaryMgr.updateVisiblePairs(chrono)
        boundaryMgr.setModel(model || getActiveModel())
        boundaryMgr.applySettings(getSettings())
        const tStart = Date.now()
        const execResult = await executeSend({
          store,
          model: model || getActiveModel(),
          topicId: pair.topicId,
          userText: pair.userText || '',
          signal: controller.signal,
          visiblePairs: chrono,
          attachments: Array.isArray(pair.attachments) ? pair.attachments.slice() : [],
          topicWebSearchOverride: undefined,
          onDebugPayload: (payload) => {
            historyRuntime.setSendDebug(payload.predictedMessageCount, payload.trimmedCount)
            requestDebug.setPayload(payload)
            historyRuntime.updateMessageCount(historyRuntime.getPredictedCount(), chrono.length)
          },
        })
    const responseMs = Math.max(0, Date.now() - tStart)
        const rawText = execResult.content
        // Extract code and equations, then sanitize display
        const codeExtraction = extractCodeBlocks(rawText)
        const afterCode = codeExtraction.hasCode ? codeExtraction.displayText : rawText
        const eqResult = extractEquations(afterCode, { inlineMode: 'markers' })
        const afterEq = eqResult.displayText
        const sanitized = sanitizeDisplayPreservingTokens(afterEq)
        let finalDisplay = sanitized
        if (eqResult.inlineSimple && eqResult.inlineSimple.length) {
          for (const item of eqResult.inlineSimple) {
            const span = `<span class="eq-inline" data-tex="${escapeHtmlAttr(item.raw)}">${escapeHtml(item.unicode)}</span>`
            finalDisplay = finalDisplay.replaceAll(item.marker, span)
          }
        }
        finalDisplay = finalDisplay.replace(/\s*\[([a-z0-9_]+-\d+|eq-\d+)\]\s*/gi, ' [$1] ')
        finalDisplay = finalDisplay.replace(/ {2,}/g, ' ')
        // Compute new token counts (user + assistant only)
        let textTokens = 0
        try {
          const userTok = estimateTokens((pair.userText || ''), getSettings().charsPerToken || 4)
          const asstTok = estimateTokens((rawText || ''), getSettings().charsPerToken || 4)
          textTokens = userTok + asstTok
        } catch {}
        const updateData = {
          previousAssistantText: pair.assistantText || '',
          previousModel: pair.model || undefined,
          replacedAt: Date.now(),
          replacedBy: model || getActiveModel(),
          assistantText: rawText,
          model: model || getActiveModel(),
          lifecycleState: 'complete',
          errorMessage: undefined,
          textTokens,
          responseMs,
        }
        if (Array.isArray(execResult.citations) && execResult.citations.length) {
          updateData.citations = execResult.citations
        }
        if (execResult.citationsMeta && typeof execResult.citationsMeta === 'object') {
          updateData.citationsMeta = execResult.citationsMeta
        }
        if (codeExtraction.hasCode) updateData.codeBlocks = codeExtraction.codeBlocks
        if (eqResult.equationBlocks && eqResult.equationBlocks.length)
          updateData.equationBlocks = eqResult.equationBlocks
        updateData.processedContent =
          codeExtraction.hasCode || eqResult.hasEquations ? finalDisplay : sanitizeAssistantText(rawText)
        store.updatePair(pair.id, updateData)
        clearTimeout(timeoutId)
        window.__maichat.requestController = null
        // Clear pending and pending UI
        try { window.__pendingReaskPairId = null } catch {}
        lifecycle.completeSend()
        updateSendDisabled()
        historyRuntime.renderCurrentView({ preserveActive: true })
        lifecycle.handleNewAssistantReply(pair.id)
      } catch (ex) {
        clearTimeout(timeoutId)
        window.__maichat.requestController = null
        let errMsg
        if (ex.name === 'AbortError') errMsg = 'Request aborted'
        else errMsg = ex && ex.message ? ex.message : 'error'
        store.updatePair(pair.id, { lifecycleState: 'error', errorMessage: errMsg, assistantText: '' })
        try { window.__pendingReaskPairId = null } catch {}
        lifecycle.completeSend()
        updateSendDisabled()
        historyRuntime.renderCurrentView({ preserveActive: true })
      }
    }
  }
  function restorePrevious(pairId) {
    const pair = store.pairs.get(pairId)
    if (!pair || !pair.previousAssistantText) return
    const curAsst = pair.assistantText || ''
    const curModel = pair.model || undefined
    const prevAsst = pair.previousAssistantText
    const prevModel = pair.previousModel || curModel
    // Re-extract for display
    const codeExtraction = extractCodeBlocks(prevAsst)
    const afterCode = codeExtraction.hasCode ? codeExtraction.displayText : prevAsst
    const eqResult = extractEquations(afterCode, { inlineMode: 'markers' })
    const afterEq = eqResult.displayText
    const sanitized = sanitizeDisplayPreservingTokens(afterEq)
    let finalDisplay = sanitized
    if (eqResult.inlineSimple && eqResult.inlineSimple.length) {
      for (const item of eqResult.inlineSimple) {
        const span = `<span class="eq-inline" data-tex="${escapeHtmlAttr(item.raw)}">${escapeHtml(item.unicode)}</span>`
        finalDisplay = finalDisplay.replaceAll(item.marker, span)
      }
    }
    finalDisplay = finalDisplay.replace(/\s*\[([a-z0-9_]+-\d+|eq-\d+)\]\s*/gi, ' [$1] ')
    finalDisplay = finalDisplay.replace(/ {2,}/g, ' ')
    let textTokens = 0
    try {
      const userTok = estimateTokens((pair.userText || ''), getSettings().charsPerToken || 4)
      const asstTok = estimateTokens((prevAsst || ''), getSettings().charsPerToken || 4)
      textTokens = userTok + asstTok
    } catch {}
    store.updatePair(pair.id, {
      assistantText: prevAsst,
      model: prevModel,
      previousAssistantText: curAsst,
      previousModel: curModel,
      processedContent: codeExtraction.hasCode || eqResult.hasEquations ? finalDisplay : sanitizeAssistantText(prevAsst),
      codeBlocks: codeExtraction.hasCode ? codeExtraction.codeBlocks : undefined,
      equationBlocks: (eqResult.equationBlocks && eqResult.equationBlocks.length) ? eqResult.equationBlocks : undefined,
      textTokens,
      lifecycleState: 'complete',
      errorMessage: undefined,
    })
    historyRuntime.renderCurrentView({ preserveActive: true })
    // After restoring, align the assistant message depending on fit: top if too tall, bottom if it fits
    // Defer alignment until next frame to allow scrollController.remeasure() to complete
    requestAnimationFrame(() => {
      try {
        const pane = document.getElementById('historyPane')
        if (!pane) return
        const nodes = Array.from(
          pane.querySelectorAll(
            `.message[data-pair-id="${pair.id}"][data-role="assistant"], .part[data-pair-id="${pair.id}"][data-role="assistant"]`
          )
        )
        if (!nodes || !nodes.length) return
        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        const firstRect = first.getBoundingClientRect()
        const lastRect = last.getBoundingClientRect()
        const paneRect = pane.getBoundingClientRect()
        const replyHeight = lastRect.bottom - firstRect.top
        const clippedTop = Math.max(0, paneRect.top - firstRect.top)
        const logicalReplyHeight = replyHeight + clippedTop
        const fits = logicalReplyHeight <= paneRect.height - 2
        const assistantId = first.getAttribute('data-part-id')
        if (assistantId) {
          activeParts.setActiveById(assistantId)
          historyRuntime.applyActiveMessage()
          if (ctx.scrollController && ctx.scrollController.alignTo) {
            ctx.scrollController.alignTo(assistantId, fits ? 'bottom' : 'top', false)
          }
        }
      } catch {}
    })
  }
  return {
    keyRouter,
    updateSendDisabled,
    renderPendingMeta,
    openQuickTopicPicker,
    openChronoTopicPicker,
    prepareEditResend,
    deletePairWithFocus,
    isErrorPair,
    restoreLastFilter,
    reAskInPlace,
    restorePrevious,
  }
}
