import type { Champion } from '../types'
import { LazyImage } from '../components/LazyImage'

interface Props {
  champions: Champion[]
}

export default function ChampionsSection({ champions }: Props) {
  return (
    <div className="grid grid--champions">
      {champions.map((champ) => (
        <article key={champ.id} className="card card--champion">
          <div className="card__splash">
            <LazyImage src={champ.splash} alt={champ.name} />
          </div>
          <div className="card__body">
            <div className="card__header">
              <LazyImage src={champ.icon} alt="" className="card__icon" />
              <div>
                <h3>{champ.name}</h3>
                <p className="muted">{champ.title}</p>
              </div>
            </div>
            <div className="tags">
              {champ.tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>
            <div className="spells-row">
              {champ.passive && (
                <LazyImage
                  src={champ.passive.path}
                  alt={`${champ.name} passive`}
                  className="spell-icon"
                />
              )}
              {champ.spells.map((s) => (
                <LazyImage
                  key={s.key}
                  src={s.path}
                  alt={`${champ.name} ${s.key}`}
                  className="spell-icon"
                />
              ))}
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
