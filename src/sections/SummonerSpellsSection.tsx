import type { SummonerSpell } from '../types'
import { LazyImage } from '../components/LazyImage'

interface Props {
  spells: SummonerSpell[]
}

export default function SummonerSpellsSection({ spells }: Props) {
  return (
    <div className="grid grid--summoners">
      {spells.map((spell) => (
        <article key={spell.id} className="card card--summoner">
          <LazyImage src={spell.icon} alt={spell.name} className="summoner-icon" />
          <div>
            <h3>{spell.name}</h3>
            <p className="muted">CD: {spell.cooldown.join(' / ')}s</p>
            <p
              className="desc"
              dangerouslySetInnerHTML={{ __html: spell.description }}
            />
          </div>
        </article>
      ))}
    </div>
  )
}
