export function saveAsJson(obj, filename){
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type:'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'export.json'
  document.body.appendChild(a)
  a.click()
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove() }, 0)
}
