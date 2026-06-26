import { useMemo, useState } from 'react'
import type { Item } from '../types'
import { LazyImage } from '../components/LazyImage'

interface Props {
  items: Item[]
}

const PAGE = 48

export default function ItemsSection({ items }: Props) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    if (!q) return items
    return items.filter((i) => i.name.toLowerCase().includes(q))
  }, [items, query])

  const visible = filtered.slice(0, page * PAGE)

  return (
    <div>
      <div className="toolbar">
        <input
          type="search"
          placeholder="Buscar item…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setPage(1)
          }}
        />
        <span className="muted">{filtered.length} items</span>
      </div>
      <div className="grid grid--items">
        {visible.map((item) => (
          <article key={item.id} className="card card--item">
            <LazyImage src={item.icon} alt={item.name} className="item-icon" />
            <div>
              <h3>{item.name}</h3>
              <p className="muted">
                {item.gold.total}g · {item.tags.join(', ')}
              </p>
            </div>
          </article>
        ))}
      </div>
      {visible.length < filtered.length && (
        <button className="btn" onClick={() => setPage((p) => p + 1)}>
          Cargar más items ({visible.length}/{filtered.length})
        </button>
      )}
    </div>
  )
}
