import { useEffect, useState } from 'react'
import {
  dismissBootShell,
  EXIT_MS,
  isBootCached,
  markBootCached,
  MIN_SPLASH_MS,
  preloadMapImage,
} from './planningBoot'

export type PlanningBootPhase = 'loading' | 'exit' | 'done'

export function usePlanningBoot() {
  const cached = isBootCached()
  const [phase, setPhase] = useState<PlanningBootPhase>(cached ? 'done' : 'loading')

  useEffect(() => {
    if (cached) {
      dismissBootShell()
      return
    }

    let cancelled = false
    const start = Date.now()

    const finish = () => {
      if (cancelled) return
      setPhase('exit')
      window.setTimeout(() => {
        if (cancelled) return
        markBootCached()
        dismissBootShell()
        setPhase('done')
      }, EXIT_MS)
    }

    ;(async () => {
      try {
        await preloadMapImage()
      } catch {
        /* MapCanvas reintentará */
      }
      if (cancelled) return
      const elapsed = Date.now() - start
      const wait = Math.max(0, MIN_SPLASH_MS - elapsed)
      if (wait > 0) await new Promise((r) => window.setTimeout(r, wait))
      finish()
    })()

    return () => {
      cancelled = true
    }
  }, [cached])

  return {
    phase,
    showLoader: phase === 'loading' || phase === 'exit',
    isRevealed: phase === 'done',
  }
}
