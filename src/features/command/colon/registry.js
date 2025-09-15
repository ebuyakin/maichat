import { saveAsJson } from './util/exporter.js'

export function createCommandRegistry({ store, selectionProvider, environment, ui, utils }){
  const commands = new Map()

  function register(cmd){ commands.set(cmd.name, cmd); if(cmd.aliases){ for(const a of cmd.aliases) commands.set(a, cmd) } }

  register({
    name: 'export',
    aliases: [],
    execute: async ({ args, flags })=>{
      const { baseIds, finalIds } = selectionProvider()
      const useBase = !!flags.base
      const ids = useBase ? baseIds : finalIds
      const fmt = (args[0]||'json').toLowerCase()
      const filename = flags.filename || autoName(environment, fmt)
      if(fmt==='json'){
        const data = buildJsonExport({ store, ids, environment })
        saveAsJson(data, filename)
        ui && ui.notify && ui.notify(`Exported ${ids.length} pairs to ${filename}`)
        return
      }
      throw new Error('Unsupported format: ' + fmt)
    }
  })

  register({
    name: 'tchange',
    aliases: [],
    execute: async ({ args, flags })=>{
      const { baseIds, finalIds } = selectionProvider()
      const ids = flags.base ? baseIds : finalIds
      const targetTopicId = await utils.topicResolver(args[0], environment)
      if(ids.length===0){ ui && ui.info && ui.info('Nothing to change'); return }
      const T = 50
      if(!flags['no-confirm'] && ui && ui.confirm){
        const ok = await ui.confirm(`Change topic for ${ids.length} pair(s)?`)
        if(!ok) return
      }
      if(flags['dry-run']){ ui && ui.info && ui.info(`[dry-run] Would change ${ids.length} pair(s)`); return }
      for(const id of ids){ store.updatePair(id, { topicId: targetTopicId }) }
      ui && ui.notify && ui.notify(`Changed topic for ${ids.length} pair(s)`) 
    }
  })

  function autoName(env, fmt){
    const ts = new Date().toISOString().replace(/[:T]/g,'-').slice(0,19)
    const model = env && env.currentModel ? env.currentModel : 'any'
    const topic = env && env.currentTopicPath ? env.currentTopicPath : 'all'
    return `export-${topic}-${model}-${ts}.${fmt}`
  }

  function buildJsonExport({ store, ids, environment }){
    const pairs = ids.map(id=> store.pairs.get(id)).filter(Boolean)
    return {
      meta: { generatedAt: new Date().toISOString(), count: pairs.length, model: environment.currentModel, topicPath: environment.currentTopicPath },
      pairs: pairs.map(p=> ({ id:p.id, createdAt:p.createdAt, topicId:p.topicId, model:p.model, star:p.star, flagColor:p.colorFlag, userText:p.userText, assistantText:p.assistantText, lifecycleState:p.lifecycleState, errorMessage:p.errorMessage }))
    }
  }

  return {
    run: async (cmd) => {
      const handler = commands.get(cmd.name)
      if(!handler) throw new Error(`Unknown command: ${cmd.name}`)
      return handler.execute({ args:cmd.args, flags:cmd.flags })
    }
  }
}
