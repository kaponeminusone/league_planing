import { useEffect, useMemo, useRef, useState } from 'react'
import { usePlanning } from '../PlanningContext'
import { roleDisplayName, roleIconPath } from '../roles'
import { type EnemySlot } from '../types'

export function EnemyPoolModal() {
  const {
    manifest,
    enemyTeam,
    updateEnemyTeam,
    enemyPoolModalOpen,
    setEnemyPoolModalOpen,
    enemyPoolActiveSlot,
    setEnemyPoolActiveSlot,
  } = usePlanning()
  const [draft, setDraft] = useState<EnemySlot[]>(enemyTeam)
  const [search, setSearch] = useState('')
  const initialRef = useRef(enemyTeam)

  const open = enemyPoolModalOpen
  const activeSlot = Math.max(0, Math.min(enemyPoolActiveSlot, draft.length - 1))
  const slot = draft[activeSlot]

  useEffect(() => {
    if (!open) return
    setDraft(enemyTeam)
    setEnemyPoolActiveSlot(Math.max(0, Math.min(enemyPoolActiveSlot, enemyTeam.length - 1)))
  }, [open, enemyTeam, enemyPoolActiveSlot, setEnemyPoolActiveSlot])

  useEffect(() => {
    if (!open) return
    initialRef.current = enemyTeam
    setSearch('')
  }, [open, enemyTeam])

  const champsById = useMemo(
    () => new Map(manifest.champions.map((c) => [c.id, c])),
    [manifest.champions],
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return manifest.champions
    return manifest.champions.filter(
      (c) => c.name.toLowerCase().includes(q) || c.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }, [manifest.champions, search])

  if (!open || !slot) return null

  const patchSlot = (index: number, patch: Partial<EnemySlot>) => {
    const next = draft.map((s, i) => (i === index ? { ...s, ...patch } : s))
    setDraft(next)
    updateEnemyTeam(next)
  }

  const assignChampion = (championId: string) => {
    patchSlot(activeSlot, { championId })
  }

  const clearChampion = (championId: string) => {
    if (slot.championId === championId) patchSlot(activeSlot, { championId: null })
  }

  const onClose = () => {
    updateEnemyTeam(initialRef.current)
    setEnemyPoolModalOpen(false)
  }

  const onSave = () => {
    setEnemyPoolModalOpen(false)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="pool-modal pool-modal--select pool-modal--enemy" onClick={(e) => e.stopPropagation()}>
        <header className="pool-modal__header">
          <h2>Equipo enemigo</h2>
          <button type="button" className="pool-modal__close" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="pool-modal__body pool-modal__body--select">
          <aside className="pool-modal__roster">
            {draft.map((s, i) => {
              const champ = s.championId ? champsById.get(s.championId) : null
              const isActive = activeSlot === i
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`pool-slot ${isActive ? 'pool-slot--active' : ''} pool-slot--enemy`}
                  onClick={() => setEnemyPoolActiveSlot(i)}
                >
                  <div className="pool-slot__icon-wrap pool-slot__icon-wrap--enemy">
                    {champ ? (
                      <img className="pool-slot__champ-icon" src={champ.icon} alt={champ.name} draggable={false} />
                    ) : (
                      <img
                        className="pool-slot__role-icon"
                        src={roleIconPath(manifest, s.role)}
                        alt={s.role}
                        draggable={false}
                      />
                    )}
                  </div>
                  <div className="pool-slot__info">
                    <span className="pool-slot__label">Enemigo</span>
                    <span className="pool-slot__role">{roleDisplayName(s.role)}</span>
                    <span className="pool-slot__name pool-slot__name--static">
                      {champ?.name ?? 'Sin campeón'}
                    </span>
                  </div>
                </button>
              )
            })}
          </aside>

          <main className="pool-modal__picker">
            <div className="pool-modal__member-bar">
              <div className="pool-modal__member-settings">
                <select
                  value={slot.role}
                  onChange={(e) => patchSlot(activeSlot, { role: e.target.value })}
                >
                  {['Top', 'Jungle', 'Mid', 'ADC', 'Support', 'Sub'].map((r) => (
                    <option key={r} value={r}>
                      {roleDisplayName(r)}
                    </option>
                  ))}
                </select>
                {slot.championId && (
                  <button type="button" className="pool-modal__clear-champ" onClick={() => patchSlot(activeSlot, { championId: null })}>
                    Quitar campeón
                  </button>
                )}
              </div>
              <input
                className="pool-modal__search"
                placeholder="Buscar campeón…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <p className="pool-modal__hint">
              Clic en campeón para asignar a {roleDisplayName(slot.role)} · Clic der. para quitar
            </p>

            <div className="pool-modal__grid-wrap">
              <div className="pool-modal__grid pool-modal__grid--select">
                {filtered.map((c) => {
                  const selected = slot.championId === c.id
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`pool-champ ${selected ? 'pool-champ--selected' : ''} pool-champ--enemy`}
                      onClick={() => assignChampion(c.id)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        if (selected) clearChampion(c.id)
                      }}
                    >
                      <div className="pool-champ__portrait">
                        <img className="pool-champ__icon" src={c.icon} alt={c.name} loading="lazy" draggable={false} />
                        {selected && (
                          <img
                            className="pool-champ__role-badge"
                            src={roleIconPath(manifest, slot.role)}
                            alt={slot.role}
                            draggable={false}
                          />
                        )}
                      </div>
                      <span className="pool-champ__name">{c.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </main>
        </div>

        <footer className="pool-modal__footer">
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="primary" onClick={onSave}>
            Guardar enemigos
          </button>
        </footer>
      </div>
    </div>
  )
}
