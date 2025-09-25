// Equation (LaTeX math) detection and extraction with hybrid simple/complex handling
// Mirrors codeExtractor pattern but keeps concerns separate.

// Regex patterns applied AFTER code extraction to avoid $ inside code blocks
const DISPLAY_DOLLAR = /\$\$([\s\s]*?)\$\$/g; // non-greedy
const BRACKETED = /\\\[([\s\S]*?)\\\]/g;
// Inline: single $ ... $ (no newline). Negative lookahead for $$ handled by not matching $$ pairs here.
const INLINE = /(^|[^$])\$([^\n$][^$]*?)\$(?!\$)/g;

// Simple heuristic configuration
const SIMPLE_MAX_LEN = 30;
const FORBIDDEN_MACROS = /\\(frac|sqrt|sum|int|begin|over|align|matrix|displaystyle|text)\b/;
const ALLOWED_MACROS = /\\(alpha|beta|gamma|delta|epsilon|pi|mu|sigma|theta|lambda|phi|psi|omega|times|cdot|pm|to|rightarrow|leftarrow)\b/g;
const SAFE_CHARS = /^[A-Za-z0-9_+\-*=<>≤≥(),.\/ ^\\]*$/; // includes backslash for allowed macros & spaces

export function extractEquations(content){
  if(!content || typeof content !== 'string') return { displayText: content, equationBlocks: [], hasEquations:false };
  let working = content;
  const equationBlocks = [];
  let eqIndex = 0;

  function classifyAndReplace(match, texBody, display){
    eqIndex++;
    const raw = texBody.trim();
    const isSimple = classifySimple(raw, display);
    if(isSimple){
      const unicode = convertSimpleInline(raw);
      return (display? '' : ' ') + `<span class="eq-inline" data-tex="${escapeHtmlAttr(raw)}">${unicode}</span>` + ' ';
    } else {
      equationBlocks.push({ index:eqIndex, tex: raw, display: !!display, lineCount: raw.split(/\n/).length });
      return ` [eq-${eqIndex}] `;
    }
  }

  // Process display first
  working = working.replace(DISPLAY_DOLLAR, (_, body)=> classifyAndReplace(_, body, true));
  working = working.replace(BRACKETED, (_, body)=> classifyAndReplace(_, body, true));
  // Inline last (use function to capture prefix char group 1)
  working = working.replace(INLINE, (m, prefix, body)=> prefix + classifyAndReplace(m, body, false));

  return { displayText: working, equationBlocks, hasEquations: equationBlocks.length>0 };
}

function classifySimple(raw, display){
  if(display) return false; // display math always complex for now (overlay worthy)
  if(raw.length > SIMPLE_MAX_LEN) return false;
  if(FORBIDDEN_MACROS.test(raw)) return false;
  if(!SAFE_CHARS.test(raw.replace(ALLOWED_MACROS,'x'))) return false; // replace allowed macros then test
  // Disallow nested braces in superscripts/subscripts beyond simple patterns
  if(/\^\{[^{}]*\{/.test(raw)) return false;
  if(/_\{[^{}]*\{/.test(raw)) return false;
  return true;
}

// Basic conversion: Greek + arrows + symbols + superscripts/subscripts digits
function convertSimpleInline(raw){
  let out = raw;
  out = out.replace(ALLOWED_MACROS, (m)=> macroToUnicode(m.slice(1)) );
  // Superscripts
  out = out.replace(/\^\(([-+]?\d+)\)/g, (_,d)=> toSuperscript(d));
  out = out.replace(/\^(-?\d)/g, (_,d)=> toSuperscript(d));
  // Subscripts digits
  out = out.replace(/_([0-9])/g, (_,d)=> toSubscript(d));
  // Simple sub i/j/n/k optional
  out = out.replace(/_(i|j|n|k)\b/g, (_,c)=> subLetter(c));
  return out;
}

function macroToUnicode(name){
  const map = {
    alpha:'α', beta:'β', gamma:'γ', delta:'δ', epsilon:'ε', pi:'π', mu:'μ', sigma:'σ', theta:'θ', lambda:'λ', phi:'φ', psi:'ψ', omega:'ω',
    times:'×', cdot:'·', pm:'±', to:'→', rightarrow:'→', leftarrow:'←'
  };
  return map[name] || name;
}
function toSuperscript(num){
  const map = {'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','-':'⁻','+':'⁺'};
  return String(num).split('').map(c=> map[c]||c).join('');
}
function toSubscript(d){
  const map = {'0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉'};
  return map[d]||d;
}
function subLetter(ch){
  const map = { i:'ᵢ', j:'ⱼ', n:'ₙ', k:'ₖ' };
  return map[ch] || ch;
}
function escapeHtmlAttr(str){
  return String(str).replace(/[&<>"']/g, s=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[s]));
}

export function applyEquationsToPair(messagePair){
  if(!messagePair || !messagePair.assistantText) return messagePair;
  const base = messagePair.processedContent || messagePair.assistantText;
  const { displayText, equationBlocks, hasEquations } = extractEquations(base);
  if(hasEquations){
    messagePair.processedContent = displayText; // augment further
    messagePair.equationBlocks = equationBlocks;
    console.log(`[EquationExtractor] Processed message ${messagePair.id}: equations=${equationBlocks.length}`);
  }
  return messagePair;
}
