import { useEffect, useState } from 'react'
import { computeStage, type Stage } from './stageScale'
import { ARTBOARD } from './heroLayout'

export function useStageScale(): Stage {
  const [stage, setStage] = useState<Stage>(() =>
    computeStage(
      typeof window === 'undefined' ? ARTBOARD.w : window.innerWidth,
      typeof window === 'undefined' ? ARTBOARD.h : window.innerHeight,
      ARTBOARD,
    ),
  )
  useEffect(() => {
    const onResize = () => setStage(computeStage(window.innerWidth, window.innerHeight, ARTBOARD))
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return stage
}
