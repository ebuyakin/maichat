// historyRuntime moved from ui/history/historyRuntime.js
import { buildMessagesForDisplay, flattenMessagesToParts } from './messageList.js'
import { getSettings } from '../../core/settings/index.js'
import * as linkHints from './linkHints.js'

// partitioner removed in message-based rendering
import { parse } from '../command/parser.js'
import { evaluate } from '../command/evaluator.js'
import { getActiveModel } from '../../core/models/modelCatalog.js'
import { applySpacingStyles as applySpacingStylesHelper } from './spacingStyles.js'
import { applyFadeVisibility } from './fadeVisibility.js'

/**
 * Creates the history runtime controller - the main orchestrator for message history display.
 * 
 * This factory function sets up:
 * - Message rendering pipeline (DOM construction, styling)
 * - Active message tracking and highlighting
 * - Scroll event handlers and viewport management
 * - Context boundary visualization (off-context badges)
 * - Status display (message counts, position indicators)
 * - Filter-based view updates
 * 
 * Returns an API with functions for rendering, navigation, and display updates.
 * 
 * @param {Object} ctx - Runtime context with dependencies
 * @param {Object} ctx.store - Message and topic data store
 * @param {Object} ctx.activeParts - Active message tracking controller
 * @param {Object} ctx.historyView - DOM rendering controller
 * @param {Object} ctx.scrollController - Scroll position management
 * @param {Object} ctx.boundaryMgr - Context boundary calculator
 * @param {Object} ctx.lifecycle - New message lifecycle handler
 * @param {Object} ctx.pendingMessageMeta - Pending message metadata (topic, model)
 * @returns {Object} API with renderHistory, renderCurrentView, applyActiveMessage, etc.
 */
export function createHistoryRuntime(ctx) {
  const {
    store,
    activeParts,
    historyView,
    scrollController,
    boundaryMgr,
    lifecycle,
    pendingMessageMeta,
  } = ctx // unpack ctx

  const historyPaneEl = document.getElementById('historyPane')
  const historyEl = document.getElementById('history')
  const commandErrEl = document.getElementById('commandError')
  let lastContextStats = null

  let lastContextIncludedIds = new Set()
  let lastPredictedCount = 0
  let lastTrimmedCount = 0
  let lastViewportH = window.innerHeight
  // Track the last (most recent) pair id in the current filtered set (LFS)
  let lastFilteredPairId = null

  function setSendDebug(predictedMessageCount, trimmedCount) {
    if (typeof predictedMessageCount === 'number') lastPredictedCount = predictedMessageCount
    if (typeof trimmedCount === 'number') lastTrimmedCount = trimmedCount
  }
  function setContextStats(stats, includedIds) {
    lastContextStats = stats
    if (includedIds) lastContextIncludedIds = includedIds
  }
  function layoutHistoryPane() {
    const topBar = document.getElementById('topBar')
    const inputBar = document.getElementById('inputBar')
    const histPane = document.getElementById('historyPane')
    if (!topBar || !inputBar || !histPane) return
    const topH = topBar.getBoundingClientRect().height
    const botH = inputBar.getBoundingClientRect().height
    histPane.style.top = topH + 'px'
    histPane.style.bottom = botH + 'px'
  }

  window.addEventListener('resize', layoutHistoryPane) // check this too
  window.addEventListener('resize', () => {
    try { linkHints.exit && linkHints.exit() } catch {}
    const h = window.innerHeight
    if (!h || !lastViewportH) {
      lastViewportH = h
      return
    }
    const delta = Math.abs(h - lastViewportH) / lastViewportH
    if (delta >= 0.1) {
      lastViewportH = h
      // No partition cache; just re-render preserving active
      renderCurrentView({ preserveActive: true })
      // After resize rebuild, keep the currently focused part on-screen (non-intrusive)
      // is this legacy too?
      try { // strongly suspect this is legacy code
        const act = activeParts && activeParts.active && activeParts.active()
        const id = act && act.id
        if (id && scrollController && scrollController.ensureVisible) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              scrollController.ensureVisible(id, false) // is ensureVisible still used?
            })
          })
        }
      } catch { }
    }
  })

  // Track scroll direction for viewport-based active switching
  let __lastScrollTop = historyEl ? historyEl.scrollTop : 0

  function updateActiveOnScroll() {
    const pane = historyEl
    if (!pane) return
    try {
      const isProg =
        ctx.scrollController &&
        ctx.scrollController.isProgrammaticScroll &&
        ctx.scrollController.isProgrammaticScroll()
      const lastKey = (window && window.__lastKey) || ''
      const isStepKey =
        lastKey === 'j' ||
        lastKey === 'k' ||
        lastKey === 'J' ||
        lastKey === 'K' ||
        lastKey === 'ArrowDown' ||
        lastKey === 'ArrowUp'
      // Permit active switching for user-initiated step scrolls (j/k), but ignore ongoing smooth animations
      if (isProg && !isStepKey) {
        __lastScrollTop = pane.scrollTop
        return
      }
      const dirDown = pane.scrollTop > __lastScrollTop + 1
      const dirUp = pane.scrollTop < __lastScrollTop - 1
      __lastScrollTop = pane.scrollTop
      if (!dirDown && !dirUp) return
      const act = activeParts.active && activeParts.active()
      if (!act) return
      let idx =
        typeof activeParts.activeIndex === 'number'
          ? activeParts.activeIndex
          : (activeParts.parts || []).findIndex((p) => p.id === act.id)
      if (idx < 0) return

      // Thresholds in scrollTop space
      const S = pane.scrollTop
      const H = pane.clientHeight
      // Prefer settings for fade zone; fallback to CSS var
      const s = getSettings && getSettings()
      let fadeZone = s && Number.isFinite(s.fadeZonePx) ? s.fadeZonePx : 0
      if (!fadeZone) {
        try {
          const v = getComputedStyle(document.documentElement).getPropertyValue('--fade-zone')
          const n = parseFloat(v)
          if (Number.isFinite(n)) fadeZone = n
        } catch { }
      }
      const topThreshold = S + fadeZone
      const bottomThreshold = S + H - fadeZone

      // Use direct children (.message) of #history to avoid selector scoping issues
      const nodes = Array.from(pane.children).filter(
        (n) => n.classList && n.classList.contains('message')
      )
      if (nodes.length === 0) return
      let safety = 0
      while (safety++ < 100) {
        const curr = nodes[idx]
        if (!curr) break
        const top = curr.offsetTop
        const bottom = top + curr.offsetHeight

        if (dirDown) {
          // Scrolling down: switch when ENTIRE message is above the BOTTOM edge of top fade zone
          // This means the message bottom has crossed above topThreshold (with 1px earlier trigger)
          if (bottom <= topThreshold - 1 && idx + 1 < nodes.length) {
            idx++
            continue
          }
        } else if (dirUp) {
          // Scrolling up: switch when ENTIRE message is below the TOP edge of bottom fade zone
          // This means the message top has crossed below bottomThreshold (with 1px earlier trigger)
          if (top >= bottomThreshold + 1 && idx - 1 >= 0) {
            idx--
            continue
          }
        }
        break
      }

      if (idx !== activeParts.activeIndex && nodes[idx]) {
        const id =
          nodes[idx].getAttribute('data-part-id') || nodes[idx].getAttribute('data-message-id')
        if (id) {
          activeParts.activeIndex = idx // Update index directly
          activeParts.setActiveById(id)
          applyActiveMessage()
        }
      }
    } catch { }
  }

  function applySpacingStyles(settings) {
    applySpacingStylesHelper(settings)
  }

  /**
   * Renders message history to the DOM with context boundary calculation and styling.
   * 
   * This is the main rendering pipeline that:
   * 1. Sorts pairs chronologically
   * 2. Calculates context boundary (which messages fit in LLM token budget)
   * 3. Transforms pairs into messages and parts for rendering
   * 4. Injects HTML into DOM via historyView
   * 5. Applies visual styling (fade zones, off-context badges)
   * 6. Updates active message highlighting and scroll measurements
   * 
   * @param {Array<id, userText, assistantText, createdAt, topicId, model, lifcycleState>} pairs - Message pairs to render (user + assistant exchanges)
   * @returns {void}
   */

  function renderHistory(pairs) {
    try { linkHints.exit && linkHints.exit() } catch {}
    // section 1
    pairs = [...pairs].sort((a, b) => a.createdAt - b.createdAt) // pairs - coming from storage, indexDb
    // Update LFS (last in filtered set) based on the final set passed for rendering
    lastFilteredPairId = pairs.length ? pairs[pairs.length - 1].id : null
    const settings = getSettings()
    const cpt = settings.charsPerToken || 3.5
    const activeModel = pendingMessageMeta.model || getActiveModel() || 'gpt'

    // section 2. boundary.  
    boundaryMgr.applySettings({
      userRequestAllowance: settings.userRequestAllowance || 0,
      charsPerToken: cpt,
    })
    boundaryMgr.setModel(activeModel)
    boundaryMgr.updateVisiblePairs(pairs)
    const boundary = boundaryMgr.getBoundary()
    lastContextStats = boundary.stats
    lastContextIncludedIds = new Set(boundary.included.map((p) => p.id))
    lastPredictedCount = boundary.included.length

    // section 3. HTML construction
    const messages = buildMessagesForDisplay(pairs) // construct HTML here
    const parts = flattenMessagesToParts(messages) // ?
    activeParts.setParts(parts) // this is

    try {
      ctx.__messages = messages
    } catch { }

    historyView.renderMessages(messages) // builds HTML/DOM structure

    // section 4
    // Apply initial fade state before first paint to avoid bright-then-dim flicker on re-render
    // updateFadeVisibility({ initial: true }) // legacy
    applyOutOfContextStyling()
    updateMessageCount(boundary.included.length, pairs.length)

    // whhat does this do?
    requestAnimationFrame(() => {
      scrollController.remeasure()
      applyActiveMessage()
    })
    lifecycle.updateNewReplyBadgeVisibility()
  }

  /**
   * Renders the current filtered view of message history.
   * 
   * Main entry point for displaying messages based on active filter command.
   * Handles:
   * - Filter parsing and evaluation (including 'o' modifier for off-context)
   * - Getting all pairs from store and applying filter
   * - Delegating to renderHistory() for actual rendering
   * - Optionally preserving the currently active message
   * 
   * Called when:
   * - User enters a filter command (e.g., "t starred:2+")
   * - Topic changes
   * - Window resizes
   * - Initial app load
   * 
   * @param {Object} opts - Options for rendering
   * @param {boolean} opts.preserveActive - Whether to keep current active message highlighted
   * @returns {void}
   */
  function renderCurrentView(opts = {}) {
    const { preserveActive = false } = opts
    const prevActiveId = preserveActive && activeParts.active() ? activeParts.active().id : null

    let all = store
      .getAllPairs()
      .slice()
      .sort((a, b) => a.createdAt - b.createdAt)

    const fq = lifecycle.getFilterQuery ? lifecycle.getFilterQuery() : ''
    if (fq) {
      // parsing filter? don't we have a special function for that?
      try {
        const ast = parse(fq)
        const currentTopicId =
          (pendingMessageMeta && pendingMessageMeta.topicId) || store.rootTopicId
        const currentModel = (pendingMessageMeta && pendingMessageMeta.model) || getActiveModel()
        // Detect/strip 'o' to compute base and boundary when needed
        const hasO = (node) => {
          if (!node) return false
          if (node.type === 'FILTER' && node.kind === 'o') return true
          if (node.type === 'NOT') return hasO(node.expr)
          if (node.type === 'AND' || node.type === 'OR') return hasO(node.left) || hasO(node.right)
          return false
        }
        const stripO = (node) => {
          if (!node) return null
          if (node.type === 'FILTER' && node.kind === 'o') return null
          if (node.type === 'NOT') {
            const inner = stripO(node.expr)
            return inner ? { type: 'NOT', expr: inner } : null
          }
          if (node.type === 'AND' || node.type === 'OR') {
            const l = stripO(node.left),
              r = stripO(node.right)
            if (!l && !r) return null
            if (!l) return r
            if (!r) return l
            return { type: node.type, left: l, right: r }
          }
          return node
        }
        if (hasO(ast)) {
          const baseAst = stripO(ast) || { type: 'ALL' }
          const base = evaluate(baseAst, all, { store, currentTopicId, currentModel })
          boundaryMgr.updateVisiblePairs(base)
          boundaryMgr.setModel(currentModel)
          boundaryMgr.applySettings(getSettings())
          const boundary = boundaryMgr.getBoundary()
          const includedIds = new Set(boundary.included.map((p) => p.id))
          const offContextOrder = base.filter((p) => !includedIds.has(p.id)).map((p) => p.id)
          all = evaluate(ast, base, {
            store,
            currentTopicId,
            currentModel,
            includedIds,
            offContextOrder,
          })
        } else {
          all = evaluate(ast, all, { store, currentTopicId, currentModel })
        }
        if (commandErrEl) {
          commandErrEl.textContent = ''
          commandErrEl.title = ''
        }
      } catch (ex) {
        if (commandErrEl) {
          const raw = ex && ex.message ? String(ex.message).trim() : 'error'
          let friendly
          if (/^Unexpected token:/i.test(raw) || /^Unexpected trailing input/i.test(raw))
            friendly = 'Incorrect command'
          else friendly = `Incorrect command: ${raw}`
          commandErrEl.textContent = friendly
          commandErrEl.title = friendly
        }
        return
      }
    }

    renderHistory(all) // NB!
    if (prevActiveId) {
      activeParts.setActiveById(prevActiveId)
      if (!activeParts.active()) {
        activeParts.last()
      }
      applyActiveMessage()
    }
  }

  function applyActiveMessage() {
    // Remove active classes, then set on the current message node
    document.querySelectorAll('.message.active').forEach((el) => el.classList.remove('active'))
    const act = activeParts.active()
    if (!act) return
    const el = document.querySelector(`.message[data-part-id="${act.id}"]`)
    if (el) {
      el.classList.add('active')
      scrollController.setActiveIndex(activeParts.activeIndex)
      // updateFadeVisibility() // LEGACY: Replaced by CSS gradient overlays
      updateMessagePosition()
    }
  }
  function updateMessagePosition() {
    const el = document.getElementById('messagePosition')
    if (!el) return
    const activeIdx = activeParts.activeIndex
    const total = activeParts.parts.length
    if (activeIdx !== null && activeIdx !== undefined && total > 0) {
      // Calculate pair number (each pair has 2 parts: user + assistant)
      const pairNumber = Math.floor(activeIdx / 2) + 1
      el.textContent = `${pairNumber}`
    } else {
      el.textContent = '-'
    }
  }

  /**
   * LEGACY FUNCTION - Replaced by CSS gradient overlays.
   * 
   * This function dynamically changed individual message opacity based on scroll position
   * to create a fade effect at top/bottom edges. Now replaced by static CSS gradients
   * (.gradientOverlayTop and .gradientOverlayBottom) which are more performant.
   * 
   * Keeping code for reference but all calls are commented out.
   * 
   * @deprecated Use CSS gradient overlays instead (see layout.css)
   * @param {Object} opts - Options object
   * @param {boolean} opts.initial - Whether this is initial render (skips animation)
   * @returns {void}
   */
  function updateFadeVisibility(opts = {}) {
    return // DISABLED - Legacy function, replaced by CSS gradients
    const initial = !!opts.initial
    const settings = getSettings()
    const pane = historyPaneEl
    if (!pane) return
    const nodes = pane.querySelectorAll('#history > .message')
    applyFadeVisibility({ paneEl: pane, parts: nodes, settings, initial })
  }

  historyEl.addEventListener('scroll', () => {
    // updateFadeVisibility() // LEGACY: Replaced by CSS gradient overlays
    updateActiveOnScroll()
  })

  function renderStatus() {
    const modeEl = document.getElementById('modeIndicator')
    if (!modeEl) return
    const m = (window.__modeManager && window.__modeManager.mode) || 'view'
    modeEl.textContent = `[${m}]`
    modeEl.classList.remove('mode-view', 'mode-command', 'mode-input')
    if (m === 'command') modeEl.classList.add('mode-command')
    else if (m === 'input') modeEl.classList.add('mode-input')
    else modeEl.classList.add('mode-view')
  }
  function updateMessageCount(included, visible) {
    const el = document.getElementById('messageCount')
    if (!el) return
    let newestHidden = false
    try {
      const allPairs = [...ctx.store.getAllPairs()].sort((a, b) => a.createdAt - b.createdAt)
      const newest = allPairs[allPairs.length - 1]
      if (newest) {
        const visiblePairIds = new Set(activeParts.parts.map((p) => p.pairId))
        if (!visiblePairIds.has(newest.id)) newestHidden = true
      }
    } catch { }
    const prefix = newestHidden ? '(-) ' : ''
    let body
    if (lastTrimmedCount > 0 && lastPredictedCount === included) {
      const sent = included - lastTrimmedCount
      body = `[${sent}-${lastTrimmedCount}]/${visible}`
    } else {
      body = `${included}/${visible}`
    }
    el.textContent = prefix + body
    if (lastContextStats) {
      el.title =
        (newestHidden ? 'Latest message hidden by filter. ' : '') +
        `Predicted included / Visible. Predicted tokens: ${lastContextStats.totalIncludedTokens}. URA model active. Trimmed last send: ${lastTrimmedCount}`
    } else {
      el.title =
        (newestHidden ? 'Latest message hidden by filter. ' : '') + 'Predicted Included / Visible'
    }
  }
  function applyOutOfContextStyling() {
    const els = document.querySelectorAll('#history .message')
    els.forEach((el) => {
      const partId = el.getAttribute('data-part-id')
      if (!partId) return
      const partObj = activeParts.parts.find((p) => p.id === partId)
      if (!partObj) return
      const included = lastContextIncludedIds.has(partObj.pairId)
      el.classList.toggle('ooc', !included)
      // Adjust offctx badge inside assistant meta
      if (el.getAttribute('data-role') === 'assistant') {
        const off = el.querySelector('.assistant-meta .badge.offctx')
        if (off) {
          if (!included) {
            off.textContent = 'off'
            off.setAttribute('data-offctx', '1')
          } else {
            off.textContent = ''
            off.setAttribute('data-offctx', '0')
          }
        }
      }
    })
  }
  function jumpToBoundary() {
    if (!lastContextIncludedIds || lastContextIncludedIds.size === 0) return
    const idx = activeParts.parts.findIndex((pt) => lastContextIncludedIds.has(pt.pairId))
    if (idx >= 0) {
      activeParts.activeIndex = idx
      applyActiveMessage()
    }
  }

  try {
    lifecycle.bindApplyActivePart && lifecycle.bindApplyActivePart(applyActiveMessage)
  } catch { }

  // 
  return {
    layoutHistoryPane,
    applySpacingStyles,
    renderHistory, // 
    renderCurrentView,
    applyActiveMessage,
    // updateFadeVisibility, // LEGACY: Removed from exports, replaced by CSS gradients
    updateMessageCount,
    applyOutOfContextStyling,
    jumpToBoundary,
    renderStatus,
    setSendDebug,
    setContextStats,
    getContextStats: () => lastContextStats,
    getPredictedCount: () => lastPredictedCount,
    getTrimmedCount: () => lastTrimmedCount,
    getIncludedIds: () => new Set(lastContextIncludedIds),
    // LFS helpers
    getLastFilteredPairId: () => lastFilteredPairId,
    isLastInFiltered: (pairId) => !!pairId && pairId === lastFilteredPairId,
  }
}
