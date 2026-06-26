import { useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import type { PlanningBootPhase } from '../usePlanningBoot'
import { APP_ICON_SRC, takeOverBootShell } from '../planningBoot'

export function PlanningBootLoader({ phase }: { phase: PlanningBootPhase }) {
  useLayoutEffect(() => {
    takeOverBootShell()
  }, [])

  if (phase === 'done') return null

  return createPortal(
    <div
      className={`planning-boot ${phase === 'exit' ? 'planning-boot--exit' : ''}`}
      aria-live="polite"
      aria-busy={phase === 'loading'}
    >
      <div className="planning-boot__inner">
        <img className="planning-boot__logo" src={APP_ICON_SRC} alt="" draggable={false} />
        <p className="planning-boot__message">
          {phase === 'loading' ? 'Cargando League Planning…' : ''}
        </p>
      </div>
    </div>,
    document.body,
  )
}
