// Minimal parser for colon commands: name [positional...] [--flag] [--flag=value] [-s]
export function parseColonCommand(str){
  const s = (str||'').trim()
  if(!s) throw new Error('Empty command')
  // Tokenize respecting simple quotes
  const tokens=[]; let buf=''; let inSingle=false; let inDouble=false; let esc=false
  const flush=()=>{ if(buf.length){ tokens.push(buf); buf='' } }
  for(let i=0;i<s.length;i++){
    const ch=s[i]
    if(esc){ buf+=ch; esc=false; continue }
    if(ch==='\\'){ esc=true; continue }
    if(ch==='\'' && !inDouble){ inSingle=!inSingle; continue }
    if(ch==='"' && !inSingle){ inDouble=!inDouble; continue }
    if(!inSingle && !inDouble && /\s/.test(ch)){ flush(); continue }
    buf+=ch
  }
  flush()
  if(!tokens.length) throw new Error('Empty command')
  const name = tokens.shift()
  const args=[]; const flags={}
  for(const t of tokens){
    if(t.startsWith('--')){
      const eq = t.indexOf('=')
      if(eq>2){ flags[t.slice(2,eq)] = t.slice(eq+1) }
      else { flags[t.slice(2)] = true }
    } else if(t.startsWith('-') && t.length>1){
      // short flags: -abc => {a:true,b:true,c:true}
      const shorts=t.slice(1)
      for(const c of shorts){ flags[c]=true }
    } else {
      args.push(t)
    }
  }
  return { name, args, flags }
}
