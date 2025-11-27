export const DB_NAME = 'maichat'
export const DB_VERSION = 1
export const PAIRS = 'pairs'
export const TOPICS = 'topics'
export const META = 'meta'
export const KEYS = 'keys'

export class IndexedDbAdapter {
  constructor() {
    this.db = null
  }
  async init() {
    if (this.db) return
    this.db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(PAIRS)) db.createObjectStore(PAIRS, { keyPath: 'id' })
        if (!db.objectStoreNames.contains(TOPICS)) db.createObjectStore(TOPICS, { keyPath: 'id' })
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'name' })
        if (!db.objectStoreNames.contains(KEYS)) db.createObjectStore(KEYS, { keyPath: 'provider' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  _tx(storeName, mode) {
    const tx = this.db.transaction(storeName, mode)
    return tx.objectStore(storeName)
  }
  async savePair(pair) {
    await this.init()
    await new Promise((res, rej) => {
      const r = this._tx(PAIRS, 'readwrite').put(pair)
      r.onsuccess = () => res()
      r.onerror = () => rej(r.error)
    })
  }
  async savePairsBulk(pairs) {
    await this.init()
    await new Promise((res, rej) => {
      const tx = this.db.transaction(PAIRS, 'readwrite')
      const store = tx.objectStore(PAIRS)
      
      for (const pair of pairs) {
        store.put(pair)
      }
      
      tx.oncomplete = () => res()
      tx.onerror = () => rej(tx.error)
    })
  }
  async deletePair(id) {
    await this.init()
    await new Promise((res, rej) => {
      const r = this._tx(PAIRS, 'readwrite').delete(id)
      r.onsuccess = () => res()
      r.onerror = () => rej(r.error)
    })
  }
  async saveTopic(topic) {
    await this.init()
    await new Promise((res, rej) => {
      const r = this._tx(TOPICS, 'readwrite').put(topic)
      r.onsuccess = () => res()
      r.onerror = () => rej(r.error)
    })
  }
  async deleteTopic(id) {
    await this.init()
    await new Promise((res, rej) => {
      const r = this._tx(TOPICS, 'readwrite').delete(id)
      r.onsuccess = () => res()
      r.onerror = () => rej(r.error)
    })
  }
  async getAllPairs() {
    await this.init()
    return new Promise((res, rej) => {
      const r = this._tx(PAIRS, 'readonly').getAll()
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
  }
  async getAllTopics() {
    await this.init()
    return new Promise((res, rej) => {
      const r = this._tx(TOPICS, 'readonly').getAll()
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
  }
  async saveMeta(record) {
    await this.init()
    await new Promise((res, rej) => {
      const r = this._tx(META, 'readwrite').put(record)
      r.onsuccess = () => res()
      r.onerror = () => rej(r.error)
    })
  }
  async getMeta(name) {
    await this.init()
    return new Promise((res, rej) => {
      const r = this._tx(META, 'readonly').get(name)
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
  }
}
