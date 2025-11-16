// features/images/imageStore.js
// IndexedDB-backed image storage for attachments (Phase 3)
// - Stores original (or downscaled) image blobs by id
// - Provides async base64 encoding on demand (send time)
// - Enforces global store quota; per-message caps can be enforced by callers via options
// - No external network access; privacy-first

import { IMAGE_QUOTAS, IMAGE_INGEST, IMAGE_SUPPORTED_FORMATS, IMAGE_HEIC_MIME } from './quotas.js'

const DB_NAME = 'maichat-image-store-v1'
const STORE_IMAGES = 'images'
const STORE_META = 'meta'
const META_TOTALS_KEY = 'totals'

let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        db.createObjectStore(STORE_IMAGES, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

async function withTx(mode, ...stores) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    resolve(tx)
  })
}

async function getStore(tx, name) {
  return tx.objectStore(name)
}

async function getTotals(tx) {
  const meta = await getStore(tx, STORE_META)
  return new Promise((resolve, reject) => {
    const r = meta.get(META_TOTALS_KEY)
    r.onsuccess = () => resolve(r.result || { totalBytes: 0, imageCount: 0 })
    r.onerror = () => reject(r.error)
  })
}

async function setTotals(tx, totals) {
  const meta = await getStore(tx, STORE_META)
  return new Promise((resolve, reject) => {
    const r = meta.put(totals, META_TOTALS_KEY)
    r.onsuccess = () => resolve(true)
    r.onerror = () => reject(r.error)
  })
}

async function recomputeTotals() {
  const tx = await withTx('readonly', STORE_IMAGES, STORE_META)
  const images = await getStore(tx, STORE_IMAGES)
  let totalBytes = 0, imageCount = 0
  await new Promise((resolve, reject) => {
    const cursorReq = images.openCursor()
    cursorReq.onsuccess = (e) => {
      const cursor = e.target.result
      if (!cursor) return resolve()
      const val = cursor.value
      totalBytes += val && val.bytes ? val.bytes : (val && val.blob ? val.blob.size : 0)
      imageCount += 1
      cursor.continue()
    }
    cursorReq.onerror = () => reject(cursorReq.error)
  })
  const txW = await withTx('readwrite', STORE_META)
  await setTotals(txW, { totalBytes, imageCount })
}

export async function init() {
  await openDB()
  // Ensure totals exist
  const db = await openDB()
  await new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_META], 'readonly')
    const meta = tx.objectStore(STORE_META)
    const r = meta.get(META_TOTALS_KEY)
    r.onsuccess = async () => {
      if (!r.result) {
        await recomputeTotals().catch(() => {})
      }
      resolve()
    }
    r.onerror = () => reject(r.error)
  })
}

export async function stats() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_META], 'readonly')
    const meta = tx.objectStore(STORE_META)
    const r = meta.get(META_TOTALS_KEY)
    r.onsuccess = () => {
      const totals = r.result || { totalBytes: 0, imageCount: 0 }
      resolve({
        totalBytes: totals.totalBytes || 0,
        imageCount: totals.imageCount || 0,
        quota: {
          maxStoreBytes: IMAGE_QUOTAS.MAX_IMAGE_STORE_BYTES,
          warnThresholdBytes: Math.floor(IMAGE_QUOTAS.MAX_IMAGE_STORE_BYTES * IMAGE_QUOTAS.WARN_THRESHOLD_RATIO),
        }
      })
    }
    r.onerror = () => reject(r.error)
  })
}

export async function get(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_IMAGES], 'readonly')
    const store = tx.objectStore(STORE_IMAGES)
    const r = store.get(id)
    r.onsuccess = () => resolve(r.result || null)
    r.onerror = () => reject(r.error)
  })
}

// renamed getImagesByIds everywhere
export async function getMany(ids) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_IMAGES], 'readonly')
    const store = tx.objectStore(STORE_IMAGES)
    const out = new Array(ids.length)
    let remaining = ids.length
    ids.forEach((id, i) => {
      const r = store.get(id)
      r.onsuccess = () => {
        out[i] = r.result || null
        if (--remaining === 0) resolve(out)
      }
      r.onerror = () => reject(r.error)
    })
  })
}

/**
 * Get metadata only (w, h, tokenCost) without loading blobs
 * Optimized for token estimation during budget calculation
 */
export async function getManyMetadata(ids) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_IMAGES], 'readonly')
    const store = tx.objectStore(STORE_IMAGES)
    const out = new Array(ids.length)
    let remaining = ids.length
    ids.forEach((id, i) => {
      const r = store.get(id)
      r.onsuccess = () => {
        const rec = r.result
        // Return only metadata, exclude blob and base64
        out[i] = rec ? {
          id: rec.id,
          w: rec.w,
          h: rec.h,
          tokenCost: rec.tokenCost,
          format: rec.format,
          bytes: rec.bytes,
        } : null
        if (--remaining === 0) resolve(out)
      }
      r.onerror = () => reject(r.error)
    })
  })
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result)
    fr.onerror = () => reject(fr.error)
    fr.readAsArrayBuffer(file)
  })
}

function loadImageBitmapFromBlob(blob) {
  if (window.createImageBitmap) {
    return window.createImageBitmap(blob)
  }
  // Fallback via <img>
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })
}

async function downscaleIfNeeded(blob) {
  try {
    const fmt = blob.type
    if (!IMAGE_SUPPORTED_FORMATS.has(fmt)) {
      if (fmt === IMAGE_HEIC_MIME) {
        throw new Error('unsupported_heic')
      }
      throw new Error('unsupported_format')
    }
    const img = await loadImageBitmapFromBlob(blob)
    const w = img.width, h = img.height
    const longest = Math.max(w, h)
    let outW = w, outH = h
    if (longest > IMAGE_INGEST.MAX_LONGEST_EDGE_PX) {
      const scale = IMAGE_INGEST.MAX_LONGEST_EDGE_PX / longest
      outW = Math.max(1, Math.round(w * scale))
      outH = Math.max(1, Math.round(h * scale))
    }
    // No downscale needed
    if (outW === w && outH === h) {
      return { blob, w, h, bytes: blob.size, format: fmt }
    }
    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d', { alpha: true })
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, outW, outH)
    const outType = fmt === 'image/jpeg' ? 'image/jpeg' : (fmt === 'image/webp' ? 'image/webp' : 'image/png')
    const outBlob = await new Promise((resolve) => canvas.toBlob(resolve, outType, IMAGE_INGEST.JPEG_QUALITY))
    const ob = outBlob || blob
    return { blob: ob, w: outW, h: outH, bytes: ob.size, format: ob.type || outType }
  } catch (e) {
    throw e
  }
}

async function putImageRecord(rec) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_IMAGES, STORE_META], 'readwrite')
    const images = tx.objectStore(STORE_IMAGES)
    const meta = tx.objectStore(STORE_META)
    const getTotalsReq = meta.get(META_TOTALS_KEY)
    getTotalsReq.onsuccess = () => {
      const totals = getTotalsReq.result || { totalBytes: 0, imageCount: 0 }
      // Global quota check
      const newTotalBytes = (totals.totalBytes || 0) + rec.bytes
      if (newTotalBytes > IMAGE_QUOTAS.MAX_IMAGE_STORE_BYTES) {
        tx.abort()
        return reject(new Error('global_quota_exceeded'))
      }
      const putReq = images.put(rec)
      putReq.onsuccess = () => {
        const newTotals = {
          totalBytes: newTotalBytes,
          imageCount: (totals.imageCount || 0) + 1,
        }
        const setReq = meta.put(newTotals, META_TOTALS_KEY)
        setReq.onsuccess = () => resolve({ ok: true, totals: newTotals })
        setReq.onerror = () => reject(setReq.error)
      }
      putReq.onerror = () => reject(putReq.error)
    }
    getTotalsReq.onerror = () => reject(getTotalsReq.error)
  })
}

export async function attachFromFiles(fileList, options = {}) {
  const files = Array.from(fileList || []).filter(Boolean)
  const results = { ids: [], warnings: [], errors: [] }
  for (const file of files) {
    try {
      if (!file || !file.type || (!IMAGE_SUPPORTED_FORMATS.has(file.type) && file.type !== IMAGE_HEIC_MIME)) {
        results.warnings.push({ type: 'skip', reason: 'unsupported_format', name: file && file.name })
        continue
      }
      if (file.type === IMAGE_HEIC_MIME) {
        results.errors.push({ type: 'reject', reason: 'unsupported_heic', name: file.name })
        continue
      }
      // Downscale/convert if needed
      const processed = await downscaleIfNeeded(file)
      const id = crypto.randomUUID()
      
      // S17: Compute token costs for ALL providers upfront (eager precomputation)
      const { estimateImageTokens } = await import('../../core/context/tokenEstimator.js')
      const { SUPPORTED_PROVIDERS } = await import('../../core/models/modelCatalog.js')
      const tokenCost = {}
      for (const provider of SUPPORTED_PROVIDERS) {
        tokenCost[provider] = estimateImageTokens({ w: processed.w, h: processed.h }, provider)
      }
      
      const rec = {
        id,
        blob: processed.blob,
        format: processed.format,
        w: processed.w,
        h: processed.h,
        bytes: processed.bytes,
        createdAt: Date.now(),
        // S14: Add optional base64 field (populated lazily in S15)
        base64: undefined,
        // S17: tokenCost precomputed for all providers at attach time
        tokenCost,
        // refCount removed: one image = one message (direct ownership)
      }
      await putImageRecord(rec)
      results.ids.push(id)
    } catch (e) {
      if (e && e.message === 'global_quota_exceeded') {
        results.errors.push({ type: 'reject', reason: 'global_quota_exceeded' })
        break
      }
      results.errors.push({ type: 'reject', reason: 'unknown', error: String(e && e.message || e) })
    }
  }
  return results
}

export async function attachFromDataTransfer(dataTransfer) {
  try {
    if (!dataTransfer) return { ids: [], warnings: [], errors: [] }
    const items = Array.from(dataTransfer.items || [])
    let files = []
    for (const it of items) {
      if (it.kind === 'file') {
        const f = it.getAsFile()
        if (f) files.push(f)
      }
    }
    // Fallback: some browsers populate files for images even if items is empty or lacks file kinds
    if (!files.length && dataTransfer.files && dataTransfer.files.length) {
      files = Array.from(dataTransfer.files)
    }
    // Filter to images only
    files = files.filter((f) => f && typeof f.type === 'string' && f.type.startsWith('image/'))
    if (!files.length) return { ids: [], warnings: [], errors: [] }
    return attachFromFiles(files)
  } catch (e) {
    return { ids: [], warnings: [], errors: [{ type: 'reject', reason: 'unknown', error: String(e && e.message || e) }] }
  }
}

export async function detach(id) {
  // Simplified: direct delete without refCount (one image = one message)
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_IMAGES, STORE_META], 'readwrite')
    const images = tx.objectStore(STORE_IMAGES)
    const meta = tx.objectStore(STORE_META)
    const g = images.get(id)
    g.onsuccess = () => {
      const rec = g.result
      if (!rec) return resolve(false)
      // Delete image and update totals
      const del = images.delete(id)
      del.onsuccess = () => {
        const getTotalsReq = meta.get(META_TOTALS_KEY)
        getTotalsReq.onsuccess = () => {
          const totals = getTotalsReq.result || { totalBytes: 0, imageCount: 0 }
          const newTotals = {
            totalBytes: Math.max(0, (totals.totalBytes || 0) - (rec.bytes || 0)),
            imageCount: Math.max(0, (totals.imageCount || 1) - 1),
          }
          const setReq = meta.put(newTotals, META_TOTALS_KEY)
          setReq.onsuccess = () => resolve(true)
          setReq.onerror = () => reject(setReq.error)
        }
        getTotalsReq.onerror = () => reject(getTotalsReq.error)
      }
      del.onerror = () => reject(del.error)
    }
    g.onerror = () => reject(g.error)
  })
}

export async function purge(id) {
  // Alias for detach() - kept for compatibility; both do direct delete now
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_IMAGES, STORE_META], 'readwrite')
    const images = tx.objectStore(STORE_IMAGES)
    const meta = tx.objectStore(STORE_META)
    const g = images.get(id)
    g.onsuccess = () => {
      const rec = g.result
      if (!rec) return resolve(false)
      const del = images.delete(id)
      del.onsuccess = () => {
        const getTotalsReq = meta.get(META_TOTALS_KEY)
        getTotalsReq.onsuccess = () => {
          const totals = getTotalsReq.result || { totalBytes: 0, imageCount: 0 }
          const newTotals = {
            totalBytes: Math.max(0, (totals.totalBytes || 0) - (rec.bytes || 0)),
            imageCount: Math.max(0, (totals.imageCount || 1) - 1),
          }
          const setReq = meta.put(newTotals, META_TOTALS_KEY)
          setReq.onsuccess = () => resolve(true)
          setReq.onerror = () => reject(setReq.error)
        }
        getTotalsReq.onerror = () => reject(getTotalsReq.error)
      }
      del.onerror = () => reject(del.error)
    }
    g.onerror = () => reject(g.error)
  })
}

export async function encodeToBase64(id) {
  const rec = await get(id)
  if (!rec) throw new Error('not_found')
  
  // S15: Return cached base64 if already encoded
  if (rec.base64 && rec.base64.data) {
    return rec.base64
  }
  
  // Encode blob to base64
  const ab = await readFileAsArrayBuffer(rec.blob)
  // Convert ArrayBuffer to Base64
  const bytes = new Uint8Array(ab)
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK)
    binary += String.fromCharCode.apply(null, slice)
  }
  const base64Data = btoa(binary)
  const base64Obj = { 
    mime: rec.format || rec.blob.type || 'application/octet-stream', 
    data: base64Data,
    chars: base64Data.length  // S15: Cache char count for payload size tracking
  }
  
  // S15: Persist base64 to IndexedDB for future reuse
  try {
    const db = await openDB()
    await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_IMAGES], 'readwrite')
      const store = tx.objectStore(STORE_IMAGES)
      rec.base64 = base64Obj
      const putReq = store.put(rec)
      putReq.onsuccess = () => resolve()
      putReq.onerror = () => reject(putReq.error)
    })
  } catch (err) {
    // If persistence fails, still return the encoded result (non-blocking)
    console.warn('[imageStore] Failed to cache base64 for', id, err)
  }
  
  return base64Obj
}

/**
 * S17: Get precomputed image token cost for a specific provider
 * Returns cached value computed at attach time (all providers precomputed)
 * 
 * @param {string} id - Image ID
 * @param {string} providerId - Provider identifier (e.g., 'openai', 'anthropic')
 * @returns {Promise<number>} Token cost for this provider (0 if image not found or cost missing)
 */
export async function getImageTokenCost(id, providerId) {
  const rec = await get(id)
  if (!rec) return 0
  
  const providerKey = (providerId || 'openai').toLowerCase()
  
  // Return precomputed cost (all providers computed at attach time)
  return rec.tokenCost?.[providerKey] || 0
}
