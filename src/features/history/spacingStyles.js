// spacingStyles.js — runtime injection of spacing-related styles for history pane
export function applySpacingStyles(settings){
  if(!settings) return
  const { partPadding=4, gapOuterPx=20, gapMetaPx=6, gapIntraPx=6, gapBetweenPx=10, fadeInMs=120, fadeOutMs=120, fadeTransitionMs=120 } = settings
  const baseFadeMs = Math.max(fadeInMs||0, fadeOutMs||0, fadeTransitionMs||0)
  let styleEl = document.getElementById('runtimeSpacing')
  if(!styleEl){ styleEl = document.createElement('style'); styleEl.id='runtimeSpacing'; document.head.appendChild(styleEl) }
  styleEl.textContent = `#historyPane{padding-top:${gapOuterPx}px; padding-bottom:${gapOuterPx}px;}
  /* Edge overlays: gradient within outer gap (G) pinned to the scroller edges */
  #historyPane::before, #historyPane::after{ content:''; position:sticky; left:0; right:0; pointer-events:none; z-index:2; display:block; }
  /* Sticky overlays: position at pane edges by offsetting by -G into the padding zone. */
  #historyPane::before{position:sticky; top:-${gapOuterPx}px; height:${gapOuterPx}px; background:linear-gradient(to bottom, var(--bg) 0%, var(--bg) 5%, rgba(0,0,0,0) 100%); }
  #historyPane::after{ bottom:-${gapOuterPx}px; height:${gapOuterPx}px; background:linear-gradient(to top, var(--bg) 0%, var(--bg) 5%, rgba(0,0,0,0) 100%); }
    .history{gap:0;}
    .gap{width:100%; flex:none;}
    .gap-between{height:${gapBetweenPx}px;}
    .gap-meta{height:${gapMetaPx}px;}
    .gap-intra{height:${gapIntraPx}px;}
    .part{margin:0;box-shadow:none;background:transparent;opacity:1;transition:opacity ${baseFadeMs}ms linear;}
    .part.user .part-inner, .part.assistant .part-inner{padding:${partPadding}px;}
    .part.meta .part-inner{padding:0 ${partPadding}px; display:flex; flex-direction:row; align-items:center; gap:12px; min-height:1.6em; width:100%; box-sizing:border-box;}
    .part.meta .badge.model{color:#aaa;}
    .part.meta{white-space:nowrap;}
    .part.meta .meta-left{display:flex; gap:10px; align-items:center; white-space:nowrap;}
    .part.meta .meta-right{display:flex; gap:10px; align-items:center; margin-left:auto; white-space:nowrap;}
    .part.meta .badge{white-space:nowrap;}
    .part.user .part-inner{background:#0d2233; border-radius:3px; position:relative;}
    .part.assistant .part-inner{background:transparent;}
    .part.meta .part-inner{background:transparent; position:relative;}
    .part.assistant .part-inner, .part.meta .part-inner{position:relative;}
    .part.active .part-inner::after{content:''; position:absolute; top:1px; left:1px; right:1px; bottom:1px; border:1px solid var(--focus-ring); border-radius:3px; pointer-events:none;}
    .part.active.assistant .part-inner{background:rgba(40,80,120,0.10);} 
    .part.active{box-shadow:none; background:transparent;}`
}
