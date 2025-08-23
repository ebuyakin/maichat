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
    this.emitter = new Emitter()
    this.rootTopicId = this.addTopic('Root', null)
  }

  on(evt, fn){ return this.emitter.on(evt, fn) }

  addTopic(name, parentId){
    const id = crypto.randomUUID()
    const topic = createTopic({ id, name, parentId })
    this.topics.set(id, topic)
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
    // ensure no pairs reference it
    for(const p of this.pairs.values()) if(p.topicId === id) return false
    const existed = this.topics.delete(id)
    if(existed) this.emitter.emit('topic:delete', id)
    return existed
  }

  addMessagePair({ topicId, model, userText, assistantText }){
    const id = crypto.randomUUID()
    const pair = createMessagePair({ id, topicId, model, userText, assistantText })
    this.pairs.set(id, pair)
    this.emitter.emit('pair:add', pair)
    return id
  }

  updatePair(id, patch){
    const existing = this.pairs.get(id)
    if(!existing) return false
    Object.assign(existing, patch)
    this.emitter.emit('pair:update', existing)
    return true
  }

  getAllPairs(){ return Array.from(this.pairs.values()) }
  getAllTopics(){ return Array.from(this.topics.values()) }

  // Internal import helpers (used by persistence)
  _importTopic(topic){
    if(!this.topics.has(topic.id)){
      this.topics.set(topic.id, topic)
      this.emitter.emit('topic:add', topic)
    }
  }
  _importPair(pair){
    if(!this.pairs.has(pair.id)){
      this.pairs.set(pair.id, pair)
      this.emitter.emit('pair:add', pair)
    }
  }
}

export function createStore(){ return new MemoryStore() }
