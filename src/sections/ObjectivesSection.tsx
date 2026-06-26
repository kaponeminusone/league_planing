import type { AssetRef } from '../types'
import { LazyImage } from '../components/LazyImage'

interface Props {
  objectives: AssetRef[]
}

export default function ObjectivesSection({ objectives }: Props) {
  return (
    <div className="grid grid--objectives">
      {objectives.map((obj) => (
        <article key={obj.name} className="card card--objective">
          <LazyImage src={obj.path} alt={obj.name} className="objective-icon" />
          <h3>{obj.name.replace(/_/g, ' ')}</h3>
        </article>
      ))}
    </div>
  )
}
