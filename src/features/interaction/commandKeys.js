// commandKeys.js
// Factory that creates the COMMAND mode key handler. Mirrors previous inline behavior.
import { parse } from '../command/parser.js'
import { evaluate } from '../command/evaluator.js'
import { getSettings } from '../../core/settings/index.js'
import { splitFilterAndCommand } from '../command/colon/colonCommandSplitter.js'
import { parseColonCommand } from '../command/colon/colonCommandParser.js'
import { createCommandRegistry } from '../command/colon/colonCommandRegistry.js'
import { resolveTopicFilter } from '../command/topicResolver.js'
import { getActiveModel } from '../../core/models/modelCatalog.js'

export function createCommandKeyHandler({
  modeManager,
  commandInput,
  commandErrEl,
  lifecycle,
  store,
  boundaryMgr,
  pendingMessageMeta,
  historyRuntime,
  activeParts,
  scrollController,
  hudRuntime,
  openConfirmOverlay,
  getCurrentTopicId,
  pushCommandHistory,
  historyPrev,
  historyNext,
  setFilterActive,
  getCommandModeEntryActivePartId,
}) {
  function formatTopicPath(id) {
    const parts = store.getTopicPath(id)
    if (parts[0] === 'Root') parts.shift()
    return parts.join(' > ')
  }
  return function commandHandler(e) {
    if (window.modalIsActive && window.modalIsActive()) return false
    // Emacs-like shortcuts
    if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
      e.preventDefault()
      const el = commandInput
      const end = el.selectionEnd
      const start = 0
      el.setRangeText('', start, end, 'end')
      return true
    }
    if (e.ctrlKey && (e.key === 'w' || e.key === 'W')) {
      e.preventDefault()
      const el = commandInput
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
      commandInput.setSelectionRange(0, 0)
      return true
    }
    if (e.ctrlKey && (e.key === 'e' || e.key === 'E')) {
      e.preventDefault()
      const len = commandInput.value.length
      commandInput.setSelectionRange(len, len)
      return true
    }
    if (e.ctrlKey && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault()
      const el = commandInput
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
      const el = commandInput
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
    if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) {
      historyPrev()
      return true
    }
    if (e.ctrlKey && (e.key === 'n' || e.key === 'N')) {
      historyNext()
      return true
    }

    if (e.key === 'Enter') {
      const q = commandInput.value.trim()
      // HUD/debug toggles
      if (q === ':hud' || q === ':hud on') {
        hudRuntime && hudRuntime.enable && hudRuntime.enable(true)
        commandInput.value = ''
        commandErrEl.textContent = ''
        return true
      }
      if (q === ':hud off') {
        hudRuntime && hudRuntime.enable && hudRuntime.enable(false)
        commandInput.value = ''
        commandErrEl.textContent = ''
        return true
      }
      if (q === ':maskdebug' || q === ':maskdebug on') {
        commandInput.value = ''
        commandErrEl.textContent = ''
        historyRuntime.applySpacingStyles(getSettings())
        // historyRuntime.updateFadeVisibility() // legacy code
        return true
      }
      if (q === ':maskdebug off') {
        commandInput.value = ''
        commandErrEl.textContent = ''
        historyRuntime.applySpacingStyles(getSettings())
        // historyRuntime.updateFadeVisibility()
        return true
      }
      if (q === ':anim off' || q === ':noanim' || q === ':noanim on') {
        scrollController.setAnimationEnabled(false)
        commandInput.value = ''
        commandErrEl.textContent = ''
        return true
      }
      if (q === ':anim on' || q === ':noanim off') {
        scrollController.setAnimationEnabled(true)
        commandInput.value = ''
        commandErrEl.textContent = ''
        return true
      }
      if (q === ':scrolllog on') {
        window.__scrollLog = true
        commandInput.value = ''
        commandErrEl.textContent = ''
        return true
      }
      if (q === ':scrolllog off') {
        window.__scrollLog = false
        commandInput.value = ''
        commandErrEl.textContent = ''
        return true
      }

      // Colon commands: <filter> :<command [args]>
      const split = splitFilterAndCommand(q)
      if (split && split.commandPart) {
        const filterStr = split.filterPart || ''
        const cmdStr = split.commandPart
        lifecycle.setFilterQuery(filterStr)
        try {
          const basePairsAll = store
            .getAllPairs()
            .slice()
            .sort((a, b) => a.createdAt - b.createdAt)
          const currentBareTopicId = pendingMessageMeta.topicId || getCurrentTopicId()
          const currentBareModel = pendingMessageMeta.model || getActiveModel()
          const hasO = (node) => {
            if (!node) return false
            if (node.type === 'FILTER' && node.kind === 'o') return true
            if (node.type === 'NOT') return hasO(node.expr)
            if (node.type === 'AND' || node.type === 'OR')
              return hasO(node.left) || hasO(node.right)
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
          let ast = null
          if (filterStr) {
            ast = parse(filterStr)
          }
          let base = basePairsAll
          if (ast) {
            if (hasO(ast)) {
              const baseAst = stripO(ast) || { type: 'ALL' }
              base = evaluate(baseAst, basePairsAll, {
                store,
                currentTopicId: currentBareTopicId,
                currentModel: currentBareModel,
              })
            } else {
              base = evaluate(ast, basePairsAll, {
                store,
                currentTopicId: currentBareTopicId,
                currentModel: currentBareModel,
              })
            }
          }
          boundaryMgr.updateVisiblePairs(base)
          boundaryMgr.setModel(currentBareModel)
          boundaryMgr.applySettings(getSettings())
          const boundary = boundaryMgr.getBoundary()
          const includedIdsSet = new Set(boundary.included.map((p) => p.id))
          const offContextOrder = base.filter((p) => !includedIdsSet.has(p.id)).map((p) => p.id)
          let finalPairs = base
          if (ast && hasO(ast)) {
            finalPairs = evaluate(ast, base, {
              store,
              currentTopicId: currentBareTopicId,
              currentModel: currentBareModel,
              includedIds: includedIdsSet,
              offContextOrder,
            })
          }
          const baseIds = base.map((p) => p.id)
          const finalIds = finalPairs.map((p) => p.id)
          const currentTopicPath = formatTopicPath(
            pendingMessageMeta.topicId || getCurrentTopicId()
          )
          const environment = {
            currentModel: currentBareModel,
            currentTopicId: pendingMessageMeta.topicId || getCurrentTopicId(),
            currentTopicPath,
            lastFilterInput: filterStr,
          }
          const ui = {
            notify: (msg) => {
              try {
                window.__hud && window.__hud.notify && window.__hud.notify(msg)
              } catch {}
            },
            info: (msg) => {
              try {
                window.__hud && window.__hud.info && window.__hud.info(msg)
              } catch {}
            },
            confirm: (msg) => openConfirmOverlay({ modeManager, message: msg, title: 'Confirm' }),
          }
          const topicResolver = async (arg, env) => {
            if (!arg || !String(arg).trim()) return env.currentTopicId
            const ids = resolveTopicFilter(String(arg), {
              store,
              currentTopicId: env.currentTopicId,
            })
            const arr = Array.from(ids)
            if (arr.length === 1) return arr[0]
            if (arr.length === 0) throw new Error('Topic not found')
            throw new Error('Ambiguous topic expression; please specify a full path')
          }
          const registry = createCommandRegistry({
            store,
            selectionProvider: () => ({ baseIds, finalIds }),
            environment,
            ui,
            utils: { topicResolver },
          })
          const cmd = parseColonCommand(cmdStr)
          registry
            .run(cmd)
            .then(() => {
              // Handle different command types
              if (cmd.name === 'export') {
                // Export: no changes, file already downloaded
                commandErrEl.textContent = ''
                commandInput.value = filterStr
                pushCommandHistory(`${filterStr}`)
                setFilterActive(!!filterStr)
                modeManager.set('view')
                return
              }
              
              if (cmd.name === 'tchange') {
                // Topic change: re-render to update badges, preserve scroll
                historyRuntime.renderCurrentView({ preserveActive: true })
                // No scroll - preserveActive maintains position
                commandErrEl.textContent = ''
                commandInput.value = filterStr
                pushCommandHistory(`${filterStr}`)
                setFilterActive(!!filterStr)
                modeManager.set('view')
                return
              }
              
              if (cmd.name === 'delete') {
                // Delete: re-render with filter active (shows empty as confirmation)
                historyRuntime.renderCurrentView({ preserveActive: false })
                // Keep filter active to show empty view (visual confirmation)
                commandErrEl.textContent = ''
                commandInput.value = filterStr
                pushCommandHistory(`${filterStr}`)
                setFilterActive(!!filterStr)
                modeManager.set('view')
                return
              }
              
              // Other commands (future): default behavior
              historyRuntime.renderCurrentView({ preserveActive: true })
              commandErrEl.textContent = ''
              commandInput.value = filterStr
              pushCommandHistory(`${filterStr}`)
              setFilterActive(!!filterStr)
              modeManager.set('view')
            })
            .catch((ex) => {
              const raw = ex && ex.message ? String(ex.message).trim() : 'error'
              const friendly = `Command error: ${raw}`
              commandErrEl.textContent = friendly
            })
        } catch (ex) {
          const raw = ex && ex.message ? String(ex.message).trim() : 'error'
          const friendly = `Command error: ${raw}`
          commandErrEl.textContent = friendly
        }
        return true
      }

      // Apply filter and rebuild view
      const prevActiveId = getCommandModeEntryActivePartId && getCommandModeEntryActivePartId()
      lifecycle.setFilterQuery(q)
      try {
        let pairs
        if (q) {
          const ast = parse(q)
          const basePairsAll = store
            .getAllPairs()
            .slice()
            .sort((a, b) => a.createdAt - b.createdAt)
          const currentBareTopicId = pendingMessageMeta.topicId || getCurrentTopicId()
          const currentBareModel = pendingMessageMeta.model || getActiveModel()
          const hasO = (node) => {
            if (!node) return false
            if (node.type === 'FILTER' && node.kind === 'o') return true
            if (node.type === 'NOT') return hasO(node.expr)
            if (node.type === 'AND' || node.type === 'OR')
              return hasO(node.left) || hasO(node.right)
            return false
          }
          const stripO = (node) => {
            if (!node) return null
            if (node.type === 'FILTER' && node.kind === 'o') return null
            if (node.type === 'NOT') {
              const inner = stripO(node.expr)
              if (inner == null) return null
              return { type: 'NOT', expr: inner }
            }
            if (node.type === 'AND' || node.type === 'OR') {
              const l = stripO(node.left)
              const r = stripO(node.right)
              if (!l && !r) return null
              if (!l) return r
              if (!r) return l
              return { type: node.type, left: l, right: r }
            }
            return node
          }
          if (hasO(ast)) {
            const baseAst = stripO(ast) || { type: 'ALL' }
            const base = evaluate(baseAst, basePairsAll, {
              store,
              currentTopicId: currentBareTopicId,
              currentModel: currentBareModel,
            })
            boundaryMgr.updateVisiblePairs(base)
            boundaryMgr.setModel(currentBareModel)
            boundaryMgr.applySettings(getSettings())
            const boundary = boundaryMgr.getBoundary()
            const includedIds = new Set(boundary.included.map((p) => p.id))
            const offContextOrder = base.filter((p) => !includedIds.has(p.id)).map((p) => p.id)
            pairs = evaluate(ast, base, {
              store,
              currentTopicId: currentBareTopicId,
              currentModel: currentBareModel,
              includedIds,
              offContextOrder,
            })
          } else {
            pairs = evaluate(ast, basePairsAll, {
              store,
              currentTopicId: currentBareTopicId,
              currentModel: currentBareModel,
            })
          }
        } else {
          pairs = store
            .getAllPairs()
            .slice()
            .sort((a, b) => a.createdAt - b.createdAt)
        }
        historyRuntime.renderHistory(pairs)
        commandErrEl.textContent = ''
        if (!activeParts.parts.length) {
          // no parts shown
          pushCommandHistory(q)
          modeManager.set('view')
          return true
        }
        // Try to preserve previous focused part if still present.
        let preserved = false
        if (prevActiveId) {
          const before = activeParts.active() && activeParts.active().id
          activeParts.setActiveById(prevActiveId)
          const now = activeParts.active() && activeParts.active().id
          preserved = !!now && now === prevActiveId
          if (!preserved && before && now === before) {
            preserved = false
          }
        }
        // Compute fallback focus and anchor when not preserved.
        let anchorTargetId = null
        if (!preserved) {
          try {
            const lastPair = pairs && pairs.length ? pairs[pairs.length - 1] : null
            if (lastPair) {
              const lastId = lastPair.id
              const partsForPair = activeParts.parts.filter((p) => p.pairId === lastId)
              const assistants = partsForPair.filter((p) => p.role === 'assistant')
              if (assistants.length) {
                const focusPart = assistants[assistants.length - 1]
                activeParts.setActiveById(focusPart.id)
                anchorTargetId = focusPart.id
              } else {
                const users = partsForPair.filter((p) => p.role === 'user')
                if (users.length) {
                  const focusPart = users[users.length - 1]
                  activeParts.setActiveById(focusPart.id)
                  anchorTargetId = `${lastId}:meta`
                } else {
                  let idx = activeParts.parts.length - 1
                  while (idx >= 0 && activeParts.parts[idx].role === 'meta') idx--
                  if (idx >= 0) {
                    activeParts.activeIndex = idx
                  }
                  anchorTargetId = `${lastId}:meta`
                }
              }
            }
          } catch {}
        }
        historyRuntime.applyActiveMessage()
        
        // Scroll logic based on whether active message survived filtering
        if (preserved) {
          // Active survived - align it to top for consistent positioning
          const act = activeParts.active()
          if (act && act.id && scrollController && scrollController.alignTo) {
            setTimeout(() => {
              scrollController.alignTo(act.id, 'top', false)
            }, ) // experiment. set delay to 0
          }
        } else if (anchorTargetId && scrollController && scrollController.scrollToBottom) {
          // Active didn't survive - scroll to bottom to show last message
          setTimeout(() => {
            scrollController.scrollToBottom(false)
          }, 0) // experiment. set delay to 0
        }
        
        pushCommandHistory(q)
        setFilterActive(!!q)
        modeManager.set('view')
      } catch (ex) {
        const raw = ex && ex.message ? String(ex.message).trim() : 'error'
        const friendly =
          /^Unexpected token:/i.test(raw) || /^Unexpected trailing input/i.test(raw)
            ? 'Incorrect command'
            : `Incorrect command: ${raw}`
        commandErrEl.textContent = friendly
      }
      return true
    }
    if (e.key === 'Escape') {
      if (commandInput.value) {
        commandInput.value = ''
        commandErrEl.textContent = ''
        return true
      }
      return true
    }
    return false
  }
}
