import type { AssetRef } from '../types'
import { LazyImage } from '../components/LazyImage'

interface Props {
  wards: AssetRef[]
}

export default function WardsSection({ wards }: Props) {
  return (
    <div className="grid grid--wards">
      {wards.map((w) => (
        <article key={w.name} className="card card--ward">
          <LazyImage src={w.path} alt={w.name} className="ward-icon" />
          <h3>{w.name.replace(/_/g, ' ')}</h3>
        </article>
      ))}
    </div>
  )
}
