import { runExport } from '../../export/exportApi.js'
import { downloadFile } from '../../export/exportDownload.js'

export function createCommandRegistry({ store, selectionProvider, environment, ui, utils }) {
  const commands = new Map()

  function register(cmd) {
    commands.set(cmd.name, cmd)
    if (cmd.aliases) {
      for (const a of cmd.aliases) commands.set(a, cmd)
    }
  }

  register({
    name: 'export',
    aliases: [],
    execute: async ({ args, flags }) => {
      const { baseIds, finalIds } = selectionProvider()
      const useBase = !!flags.base
      const ids = useBase ? baseIds : finalIds
      const fmt = (args[0] || 'json').toLowerCase()
      const order = (flags.order || 'time').toLowerCase()
      const filename = flags.filename // if missing, exportApi will auto-name
      const {
        filename: outName,
        mime,
        content,
      } = runExport({
        store,
        pairIds: ids,
        format: fmt,
        order,
        filename,
        filterInput: environment?.lastFilterInput || '',
        app: environment?.appVersion || undefined,
      })
      downloadFile({ filename: outName, mime, content })
      ui && ui.notify && ui.notify(`Exported ${ids.length} pairs to ${outName}`)
      return
    },
  })

  register({
    name: 'tchange',
    aliases: [],
    execute: async ({ args, flags }) => {
      const { baseIds, finalIds } = selectionProvider()
      const ids = flags.base ? baseIds : finalIds
      const targetTopicId = await utils.topicResolver(args[0], environment)
      if (ids.length === 0) {
        ui && ui.info && ui.info('Nothing to change')
        return
      }
      const T = 50
      if (!flags['no-confirm'] && ui && ui.confirm) {
        const ok = await ui.confirm(`Change topic for ${ids.length} pair(s)?`)
        if (!ok) return
      }
      if (flags['dry-run']) {
        ui && ui.info && ui.info(`[dry-run] Would change ${ids.length} pair(s)`)
        return
      }
      for (const id of ids) {
        store.updatePair(id, { topicId: targetTopicId })
      }
      ui && ui.notify && ui.notify(`Changed topic for ${ids.length} pair(s)`)
    },
  })

  register({
    name: 'delete',
    aliases: [],
    execute: async ({ args, flags }) => {
      // Guard: Block dynamic filters (r, o, bare t, tN)
      const filterStr = environment?.lastFilterInput || ''
      
      // Check for dynamic filters:
      // - r or rN (recent messages)
      // - o or oN (context boundary)
      // - bare t (current topic from input bar)
      // - tN where N is a number (last N from current topic)
      const hasRecent = /\br\d*\b/.test(filterStr)
      const hasContext = /\bo\d*\b/.test(filterStr)
      const hasBareT = /\bt\s/.test(filterStr) || /\bt$/.test(filterStr) // bare t followed by space or end
      const hasTN = /\bt\d+\b/.test(filterStr) // t followed by digits
      
      if (hasRecent || hasContext || hasBareT || hasTN) {
        const blocked = []
        if (hasRecent) blocked.push('r')
        if (hasContext) blocked.push('o')
        if (hasBareT || hasTN) blocked.push('t/tN')
        
        throw new Error(
          `Delete-incompatible filter (no ${blocked.join(', ')})`
        )
      }
      
      const { baseIds, finalIds } = selectionProvider()
      const ids = finalIds  // WYSIWYG - delete what's displayed
      
      if (ids.length === 0) {
        ui && ui.info && ui.info('Nothing to delete')
        return
      }
      
      const SAFE_LIMIT = 50
      if (ids.length > SAFE_LIMIT && !flags.force) {
        throw new Error(`Too many pairs (${ids.length}). Use --force to delete >50 pairs.`)
      }
      
      // Always confirm
      const ok = await ui.confirm(
        `Delete ${ids.length} pair(s)?\n\nThis action cannot be undone.`
      )
      if (!ok) return
      
      // Execute deletion
      for (const id of ids) {
        store.removePair(id)
      }
      
      ui && ui.notify && ui.notify(`Deleted ${ids.length} pair(s)`)
    },
  })

  // autoName and inline buildJsonExport removed in favor of features/export

  return {
    run: async (cmd) => {
      const handler = commands.get(cmd.name)
      if (!handler) throw new Error(`Unknown command: ${cmd.name}`)
      return handler.execute({ args: cmd.args, flags: cmd.flags })
    },
  }
}
