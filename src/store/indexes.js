// Indexes builder: maintains derived indexes for fast filtering planning (future use)

/**
 * Maintains incremental indexes for a MemoryStore-like API (on(evt, fn), getAllPairs()).
 * Indexes:
 * - byTopic: topicId -> MessagePair[]
 * - byModel: modelLower -> MessagePair[]
 * - byStar: star(0..3) -> MessagePair[]
 * - include: pairs with includeInContext=true
 * - exclude: pairs with includeInContext=false
 */
export class Indexes {
  /** @param {import('./memoryStore.js').MemoryStore} store */
  constructor(store){
    this.store = store
    this.byTopic = new Map()
    this.byModel = new Map()
    this.byStar = [[],[],[],[]]
    this.include = []
    this.exclude = []
    this._subscriptions = []
    this._buildAll()
    this._wire()
  }

  dispose(){ this._subscriptions.forEach(off=>off()) }

  _wire(){
    this._subscriptions.push(
      this.store.on('pair:add', p=> this._addPair(p)),
      this.store.on('pair:update', p=> this._updatePair(p)),
      this.store.on('topic:add', _t=>{/* topic index lazily populated on pair add */})
    )
  }

  _buildAll(){
    const pairs = this.store.getAllPairs()
    for(const p of pairs) this._addPair(p)
  }

  _addPair(p){
    // topic
    if(!this.byTopic.has(p.topicId)) this.byTopic.set(p.topicId, [])
    this.byTopic.get(p.topicId).push(p)
    // model
    const mk = p.model.toLowerCase()
    if(!this.byModel.has(mk)) this.byModel.set(mk, [])
    this.byModel.get(mk).push(p)
    // star
    if(this.byStar[p.star]) this.byStar[p.star].push(p)
    // include/exclude
    if(p.includeInContext) this.include.push(p); else this.exclude.push(p)
  }

  _updatePair(p){
    // For simplicity Phase 1: rebuild all (low volume). Optimize later.
    this.byTopic.clear(); this.byModel.clear(); this.byStar = [[],[],[],[]]; this.include=[]; this.exclude=[]
    this._buildAll()
  }

  /** Quick query helpers */
  getByTopic(topicId){ return this.byTopic.get(topicId) || [] }
  getByModel(model){ return this.byModel.get(model.toLowerCase()) || [] }
  getByStar(star){ return this.byStar[star] || [] }
  getIncluded(){ return this.include }
  getExcluded(){ return this.exclude }
}

/** Convenience factory */
export function attachIndexes(store){ return new Indexes(store) }
