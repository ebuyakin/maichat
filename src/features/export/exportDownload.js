export function downloadFile({ filename, mime, content }){
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove() }, 0)
}
