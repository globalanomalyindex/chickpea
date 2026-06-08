/** Trigger a browser download of a Blob under the given filename. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  triggerDownload(url, filename)
  // revoke after the click has been dispatched
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Trigger a browser download of a string (e.g. SVG markup) under the given filename. */
export function downloadText(text: string, filename: string, mime = 'image/svg+xml'): void {
  const blob = new Blob([text], { type: mime })
  downloadBlob(blob, filename)
}

function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
