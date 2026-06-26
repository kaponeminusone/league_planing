import type { Manifest } from '../types'
import { LazyImage } from '../components/LazyImage'

interface Props {
  minimap: Manifest['minimap']
}

export default function MinimapSection({ minimap }: Props) {
  return (
    <div className="minimap-layout">
      <div>
        <h3 className="subsection-title">Mapas</h3>
        <div className="maps-row">
          {minimap.maps.map((m) => (
            <figure key={m.name} className="map-figure">
              <LazyImage src={m.path} alt={m.name} className="map-img" />
              <figcaption>{m.name}</figcaption>
            </figure>
          ))}
        </div>
      </div>

      <div>
        <h3 className="subsection-title">Pings</h3>
        <div className="grid grid--small">
          {minimap.pings.map((p) => (
            <article key={p.name} className="card card--mini">
              <LazyImage src={p.path} alt={p.name} className="mini-icon" />
              <span>{p.name}</span>
            </article>
          ))}
        </div>
      </div>

      <div>
        <h3 className="subsection-title">Iconos del mapa</h3>
        <div className="grid grid--small">
          {minimap.icons.map((i) => (
            <article key={i.name} className="card card--mini">
              <LazyImage src={i.path} alt={i.name} className="mini-icon" />
              <span>{i.name}</span>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
