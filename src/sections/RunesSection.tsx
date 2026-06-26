import type { RuneTree } from '../types'
import { LazyImage } from '../components/LazyImage'

interface Props {
  runes: RuneTree[]
}

export default function RunesSection({ runes }: Props) {
  return (
    <div className="runes">
      {runes.map((tree) => (
        <div key={tree.id} className="rune-tree">
          <header className="rune-tree__header">
            <LazyImage src={tree.icon} alt={tree.name} className="rune-tree__icon" />
            <h3>{tree.name}</h3>
          </header>
          <div className="rune-tree__slots">
            {tree.slots.map((slot, si) => (
              <div key={si} className="rune-slot">
                {slot.map((rune) => (
                  <article key={rune.id} className="card card--rune" title={rune.name}>
                    <LazyImage src={rune.icon} alt={rune.name} className="rune-icon" />
                    <span>{rune.name}</span>
                  </article>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
