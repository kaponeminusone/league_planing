import type { ReactNode } from 'react'
import { useIntersectionObserver } from '../hooks/useIntersectionObserver'

interface SectionProps {
  id: string
  title: string
  subtitle?: string
  count?: number
  children: ReactNode
}

export function Section({ id, title, subtitle, count, children }: SectionProps) {
  const { ref, visible } = useIntersectionObserver('300px')

  return (
    <section id={id} className="section" ref={ref}>
      <header className="section__header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="section__subtitle">{subtitle}</p>}
        </div>
        {count !== undefined && (
          <span className="section__count">{count} assets</span>
        )}
      </header>
      <div className={`section__body ${visible ? 'visible' : ''}`}>
        {visible ? children : <div className="section__placeholder">Cargando sección…</div>}
      </div>
    </section>
  )
}
