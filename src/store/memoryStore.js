// In-memory store with basic pub/sub
import { createMessagePair } from '../models/messagePair.js'
import { createTopic } from '../models/topic.js'

/** Simple event emitter */
class Emitter {
  constructor() { this.listeners = {} }
  on(evt, fn) { (this.listeners[evt] ||= []).push(fn); return () => this.off(evt, fn) }
  off(evt, fn) { this.listeners[evt] = (this.listeners[evt]||[]).filter(f => f!==fn) }
  emit(evt, payload) { (this.listeners[evt]||[]).forEach(f => f(payload)) }
}

export class MemoryStore {
  constructor() {
    /** @type {Map<string, import('../models/messagePair.js').MessagePair>} */
    this.pairs = new Map()
    /** @type {Map<string, import('../models/topic.js').Topic>} */
    this.topics = new Map()
  /** children index: parentId -> Set<childId> */
  this.children = new Map()
    this.emitter = new Emitter()
  // Stable root ID so persisted topics always point to the same root across sessions.
  this.rootTopicId = 'root'
  const root = createTopic({ id: this.rootTopicId, name: 'Root', parentId: null })
  root.directCount = 0
  root.totalCount = 0
  this.topics.set(this.rootTopicId, root)
  if(!this.children.has(null)) this.children.set(null, new Set())
  this.children.get(null).add(this.rootTopicId)
  this.emitter.emit('topic:add', root)
  }

  on(evt, fn){ return this.emitter.on(evt, fn) }

  addTopic(name, parentId){
    const id = crypto.randomUUID()
    const topic = createTopic({ id, name, parentId })
  // augment with counts
  topic.directCount = 0
  topic.totalCount = 0
    this.topics.set(id, topic)
  if(!this.children.has(parentId)) this.children.set(parentId, new Set())
  this.children.get(parentId).add(id)
    this.emitter.emit('topic:add', topic)
    return id
  }

  renameTopic(id, newName){
    const t = this.topics.get(id)
    if(!t) return false
    t.name = newName
    this.emitter.emit('topic:update', t)
    return true
  }

  deleteTopic(id){
    if(id === this.rootTopicId) return false // cannot delete root
    // ensure no children
    if(this.children.get(id)?.size) return false
    // ensure no pairs reference it (direct)
    for(const p of this.pairs.values()) if(p.topicId === id) return false
    const topic = this.topics.get(id)
    if(!topic) return false
    const parentId = topic.parentId
    const existed = this.topics.delete(id)
    if(existed){
      const set = this.children.get(parentId)
      if(set) set.delete(id)
      this.children.delete(id)
      this.emitter.emit('topic:delete', id)
      this.recalculateTopicCounts()
    }
    return !!existed
  }

  addMessagePair({ topicId, model, userText, assistantText }){
    const id = crypto.randomUUID()
    const pair = createMessagePair({ id, topicId, model, userText, assistantText })
    this.pairs.set(id, pair)
    this.emitter.emit('pair:add', pair)
  this._incrementCountsForTopic(topicId)
    return id
  }

  updatePair(id, patch){
    const existing = this.pairs.get(id)
    if(!existing) return false
    const oldTopicId = existing.topicId
    Object.assign(existing, patch)
    this.emitter.emit('pair:update', existing)
    if(patch.topicId && patch.topicId !== oldTopicId){
      // recompute counts cheaply: decrement old chain and increment new chain
      this._decrementCountsForTopic(oldTopicId)
      this._incrementCountsForTopic(existing.topicId)
    }
    return true
  }

  getAllPairs(){ return Array.from(this.pairs.values()) }
  getAllTopics(){ return Array.from(this.topics.values()) }

  // Internal import helpers (used by persistence)
  _importTopic(topic){
    if(!this.topics.has(topic.id)){
      // ensure new fields present
      if(typeof topic.directCount !== 'number') topic.directCount = 0
      if(typeof topic.totalCount !== 'number') topic.totalCount = 0
      this.topics.set(topic.id, topic)
      if(!this.children.has(topic.parentId)) this.children.set(topic.parentId, new Set())
      this.children.get(topic.parentId).add(topic.id)
      this.emitter.emit('topic:add', topic)
    }
  }
  _importPair(pair){
    if(!this.pairs.has(pair.id)){
      this.pairs.set(pair.id, pair)
      this.emitter.emit('pair:add', pair)
    }
  }

  /** Move a topic under newParentId (null for root). Returns true on success. */
  moveTopic(topicId, newParentId){
    if(topicId === this.rootTopicId) return false
    const topic = this.topics.get(topicId); if(!topic) return false
    // prevent cycles: ensure newParentId not in topic subtree
    if(newParentId){
      if(this._isDescendant(newParentId, topicId)) return false
    }
    const oldParent = topic.parentId
    if(oldParent === newParentId) return true // noop
    // update children index
    const oldSet = this.children.get(oldParent); if(oldSet) oldSet.delete(topicId)
    if(!this.children.has(newParentId)) this.children.set(newParentId, new Set())
    this.children.get(newParentId).add(topicId)
    topic.parentId = newParentId
    this.emitter.emit('topic:move', { id: topicId, from: oldParent, to: newParentId })
    this.recalculateTopicCounts()
    return true
  }

  _isDescendant(maybeChildId, ancestorId){
    let cur = this.topics.get(maybeChildId)
    while(cur){
      if(cur.id === ancestorId) return true
      cur = cur.parentId ? this.topics.get(cur.parentId) : null
    }
    return false
  }

  /** Recalculate direct & total counts from scratch (used after bulk ops). */
  recalculateTopicCounts(){
    for(const t of this.topics.values()){ t.directCount = 0; t.totalCount = 0 }
    for(const p of this.pairs.values()){
      const topic = this.topics.get(p.topicId)
      if(!topic) continue
      topic.directCount++
    }
    // initialize total = direct then propagate direct upward
    for(const t of this.topics.values()) t.totalCount = t.directCount
    for(const t of this.topics.values()){
      let cur = t.parentId ? this.topics.get(t.parentId) : null
      while(cur){ cur.totalCount += t.directCount; cur = cur.parentId ? this.topics.get(cur.parentId) : null }
    }
    this.emitter.emit('topic:counts')
  }

  _incrementCountsForTopic(topicId){
    let cur = this.topics.get(topicId)
    if(!cur) return
    cur.directCount++; cur.totalCount++
    while(cur.parentId){
      cur = this.topics.get(cur.parentId); if(!cur) break; cur.totalCount++
    }
  }
  _decrementCountsForTopic(topicId){
    let cur = this.topics.get(topicId)
    if(!cur) return
    cur.directCount = Math.max(0, cur.directCount-1)
    cur.totalCount = Math.max(0, cur.totalCount-1)
    while(cur.parentId){
      cur = this.topics.get(cur.parentId); if(!cur) break; cur.totalCount = Math.max(0, cur.totalCount-1)
    }
  }

  /** Utility: get path names from root to topicId */
  getTopicPath(topicId){
    const parts = []
    let cur = this.topics.get(topicId)
    while(cur){ parts.push(cur.name); cur = cur.parentId ? this.topics.get(cur.parentId) : null }
    return parts.reverse()
  }
}

export function createStore(){ return new MemoryStore() }
