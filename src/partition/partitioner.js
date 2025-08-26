// Partitioner v2: wraps text to viewport width using canvas measurement, groups lines into parts
// constrained by maxLines derived from viewport height * partFraction.

import { getSettings } from '../settings/index.js'

const cache = new Map() // key -> { width, partsMeta, textVersion }

export function partitionMessage({ text, role, pairId }){
  if(!text) return []
  const settings = getSettings()
  const win = (typeof window !== 'undefined') ? window : { innerHeight:800, document:{ documentElement:{}, getElementById:()=>null } }
  // Prefer actual historyPane height (excludes outer gaps which are structural) so parts always fit.
  let paneH = 0
  try {
    if(typeof document !== 'undefined'){
      const pane = document.getElementById('historyPane')
      if(pane) paneH = pane.clientHeight
    }
  } catch {}
  const viewportH = paneH || win.innerHeight || 800
  const lineHeightPx = getPartLineHeight()
  // Derive usable vertical space subtracting pane vertical padding (outer gaps). This ensures
  // a part sized at partFraction will fully fit without visual clipping behind masks.
  let padTop = 0, padBottom = 0
  try {
    if(typeof document !== 'undefined'){
      const pane = document.getElementById('historyPane')
      if(pane){
        const cs = window.getComputedStyle(pane)
        padTop = parseFloat(cs.paddingTop)||0
        padBottom = parseFloat(cs.paddingBottom)||0
      }
    }
  } catch {}
  const usableH = Math.max(1, viewportH - padTop - padBottom)
  const partPadding = settings.partPadding || 0
  const targetPartHeightPx = usableH * settings.partFraction
  const verticalBudget = targetPartHeightPx - 2*partPadding
  const maxLines = Math.max(1, Math.floor(verticalBudget / lineHeightPx))

  const baseWidth = getHistoryContentWidth()
  let wrapWidth = baseWidth - 2*partPadding
  if(wrapWidth < 40) wrapWidth = Math.max(20, baseWidth * 0.5) // minimal safeguard
  const key = pairId+':'+role
  const textVersion = text.length // simple proxy; could use hash if needed
  const cached = cache.get(key)
  if(cached && cached.width === wrapWidth && cached.textVersion === textVersion && cached.maxLines === maxLines && cached.partPadding === partPadding){
    return cached.partsMeta.map(p=> ({...p}))
  }

  const font = getUiFont()
  const ctx = getMeasureCtx(font)
  const rawLines = wrapTextToLines(text, ctx, wrapWidth)

  const parts = []
  for(let lineIndex=0; lineIndex < rawLines.length;){
    const slice = rawLines.slice(lineIndex, lineIndex + maxLines)
    const idx = parts.length
    parts.push({
      id: `${pairId}:${role}:${idx}`,
      pairId,
      role,
      index: idx,
      text: slice.join('\n'),
      lineStart: lineIndex,
      lineEnd: lineIndex + slice.length - 1,
      lineCount: slice.length,
      maxLinesUsed: maxLines
    })
    lineIndex += slice.length
  }

  cache.set(key, { width: wrapWidth, partsMeta: parts.map(p=> ({...p})), textVersion, maxLines, partPadding })
  return parts
}

// Helpers
let _lineHeightCache = null
function getPartLineHeight(){
  if(_lineHeightCache) return _lineHeightCache
  try {
    if(typeof document === 'undefined') return 18
    // Create hidden probe matching .part-inner font metrics.
    let probe = document.getElementById('mc-lineheight-probe')
    if(!probe){
      probe = document.createElement('div')
      probe.id = 'mc-lineheight-probe'
      probe.style.position = 'absolute'
      probe.style.visibility = 'hidden'
      probe.style.pointerEvents = 'none'
      probe.style.zIndex = '-1'
      probe.style.whiteSpace = 'pre'
      probe.className = 'part-inner'
      probe.textContent = 'A' // single line reference
      document.body.appendChild(probe)
    }
    const lh = probe.getBoundingClientRect().height || 18
    _lineHeightCache = lh
    return lh
  } catch { return 18 }
}

function getHistoryContentWidth(){
  if(typeof document === 'undefined') return 800
  const pane = document.getElementById('historyPane')
  if(!pane) return window.innerWidth * 0.8
  // subtract horizontal padding (left/right) from computed style
  const cs = window.getComputedStyle(pane)
  const padLeft = parseFloat(cs.paddingLeft)||0
  const padRight = parseFloat(cs.paddingRight)||0
  return pane.clientWidth - padLeft - padRight
}

let _measureCtx = null
function getMeasureCtx(font){
  if(typeof document === 'undefined'){
    // Fallback approximate context for non-DOM (tests). Assume avg char width 7px.
    return {
      font,
      measureText(str){ return { width: (str||'').length * 7 } }
    }
  }
  if(!_measureCtx){
    const canvas = document.createElement('canvas')
    _measureCtx = canvas.getContext('2d')
  }
  _measureCtx.font = font
  return _measureCtx
}

function getUiFont(){
  try {
    if(typeof document === 'undefined') return '400 13px sans-serif'
    const root = document.documentElement
    const cs = window.getComputedStyle(root)
    // Construct minimal font descriptor
    const weight = cs.fontWeight || '400'
    const size = cs.fontSize || '13px'
    const family = cs.fontFamily || 'sans-serif'
    return `${weight} ${size} ${family}`
  } catch { return '400 13px sans-serif' }
}

function wrapTextToLines(text, ctx, maxWidth){
  const paragraphs = text.split(/\n/) // keep empty lines
  const lines = []
  for(const para of paragraphs){
    if(para === ''){ lines.push(''); continue }
    const words = para.split(/(\s+)/) // keep whitespace tokens
    let cur = ''
    for(const token of words){
      if(token === '') continue
      const tentative = cur + token
      const w = ctx.measureText(tentative).width
      if(w <= maxWidth){
        cur = tentative
      } else {
        // If current empty and single token too wide, hard-break token
        if(cur === ''){
          const broken = hardBreakToken(token, ctx, maxWidth)
          for(let i=0;i<broken.length-1;i++) lines.push(broken[i])
          cur = broken[broken.length-1]
        } else {
          // push current and start new with token
            lines.push(cur.trimEnd())
            cur = token.trimStart()
        }
      }
    }
    if(cur) lines.push(cur.trimEnd())
  }
  return lines
}

function hardBreakToken(token, ctx, maxWidth){
  const pieces = []
  let buf = ''
  for(const ch of token){
    const tentative = buf + ch
    if(ctx.measureText(tentative).width <= maxWidth){
      buf = tentative
    } else {
      if(buf) pieces.push(buf)
      buf = ch
    }
  }
  if(buf) pieces.push(buf)
  return pieces
}

export function invalidatePartitionCacheOnResize(){
  cache.clear()
  _lineHeightCache = null
}
