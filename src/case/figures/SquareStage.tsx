import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * A responsive square that measures its own width and hands the pixel size down, so the
 * figure SVGs render crisp at any column width without overflowing. Capped so the figures
 * stay legible (not gigantic) on wide screens.
 */
export function SquareStage({
  children,
  max = 460,
}: {
  children: (size: number) => ReactNode
  max?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setSize(Math.max(120, Math.min(max, el.getBoundingClientRect().width)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [max])

  return (
    <div ref={ref} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      {size > 0 && children(size)}
    </div>
  )
}
