function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * `chickpea-{YYYYMMDD-HHMMSS}.{ext}`. Date is injected for testability.
 */
export function exportFilename(ext: 'svg' | 'png', date: Date = new Date()): string {
  const stamp =
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  return `chickpea-${stamp}.${ext}`
}
