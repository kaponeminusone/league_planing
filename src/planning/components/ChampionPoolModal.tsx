import { useEffect, useMemo, useRef, useState } from 'react'
import { usePlanning } from '../PlanningContext'
import { roleDisplayName, roleIconPath } from '../roles'
import {
  createId,
  IN_GAME_ROLES,
  POOL_ROLES,
  sideForRole,
  type PoolEntry,
  type TeamMember,
  type TeamSide,
} from '../types'

interface RolePickerState {
  championId: string
  x: number
  anchorY: number
  placement: 'above' | 'below'
}

export function ChampionPoolModal() {
  const { manifest, team, updateTeam, poolModalOpen, setPoolModalOpen } = usePlanning()
  const [draft, setDraft] = useState<TeamMember[]>(team)
  const [activeMember, setActiveMember] = useState(0)
  const [search, setSearch] = useState('')
  const [rolePicker, setRolePicker] = useState<RolePickerState | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const open = poolModalOpen

  useEffect(() => {
    if (open) {
      setDraft(team)
      setActiveMember(0)
      setSearch('')
      setRolePicker(null)
    }
  }, [open, team])

  useEffect(() => {
    if (!rolePicker) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRolePicker(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rolePicker])

  const member = draft[activeMember]

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return manifest.champions
    return manifest.champions.filter(
      (c) => c.name.toLowerCase().includes(q) || c.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }, [manifest.champions, search])

  const champsById = useMemo(
    () => new Map(manifest.champions.map((c) => [c.id, c])),
    [manifest.champions],
  )

  if (!open || !member) return null

  const poolByChamp = new Map(member.pool.map((e) => [e.championId, e]))
  const inGame = IN_GAME_ROLES.includes(member.role as (typeof IN_GAME_ROLES)[number])

  const patchMember = (index: number, patch: Partial<TeamMember>) => {
    setDraft((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)))
  }

  const setPool = (index: number, pool: PoolEntry[]) => {
    patchMember(index, { pool })
  }

  const openRolePicker = (championId: string, target: HTMLElement) => {
    const tile =
      (target.closest('.pool-champ') as HTMLElement | null) ??
      (target.closest('.pool-list-chip') as HTMLElement | null)
    if (!tile) return
    const tileRect = tile.getBoundingClientRect()
    const bubbleHeight = 88
    const placement = tileRect.top < bubbleHeight + 12 ? 'below' : 'above'
    setRolePicker({
      championId,
      x: tileRect.left + tileRect.width / 2,
      anchorY: placement === 'above' ? tileRect.top : tileRect.bottom,
      placement,
    })
  }

  const confirmRole = (role: string) => {
    if (!rolePicker) return
    const { championId } = rolePicker
    const existing = member.pool.find((e) => e.championId === championId)
    if (existing) {
      setPool(
        activeMember,
        member.pool.map((e) => (e.championId === championId ? { ...e, role } : e)),
      )
    } else {
      setPool(activeMember, [...member.pool, { championId, role }])
    }
    setRolePicker(null)
  }

  const removeFromPool = (championId: string) => {
    setPool(
      activeMember,
      member.pool.filter((e) => e.championId !== championId),
    )
    if (rolePicker?.championId === championId) setRolePicker(null)
  }

  const onChampClick = (champId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    openRolePicker(champId, e.currentTarget)
  }

  const onChampContextMenu = (champId: string, e: React.MouseEvent) => {
    e.preventDefault()
    if (poolByChamp.has(champId)) removeFromPool(champId)
  }

  const save = () => {
    updateTeam(draft)
    setPoolModalOpen(false)
  }

  const onClose = () => {
    setDraft(team)
    setPoolModalOpen(false)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="pool-modal pool-modal--select" onClick={(e) => e.stopPropagation()}>
        <header className="pool-modal__header">
          <h2>Selección de pool</h2>
          <button type="button" className="pool-modal__close" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="pool-modal__body pool-modal__body--select">
          <aside className="pool-modal__roster">
            {draft.map((m, i) => {
              const isActive = activeMember === i
              const slotRole = IN_GAME_ROLES.includes(m.role as (typeof IN_GAME_ROLES)[number])
                ? m.role
                : 'Mid'
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`pool-slot ${isActive ? 'pool-slot--active' : ''}`}
                  onClick={() => {
                    setActiveMember(i)
                    setRolePicker(null)
                  }}
                >
                  <div className="pool-slot__icon-wrap">
                    <img
                      className="pool-slot__role-icon"
                      src={roleIconPath(manifest, slotRole)}
                      alt={slotRole}
                      draggable={false}
                    />
                  </div>
                  <div className="pool-slot__info">
                    <span className="pool-slot__label">Selección</span>
                    <span className="pool-slot__role">{roleDisplayName(m.role)}</span>
                    <input
                      className="pool-slot__name"
                      value={m.name}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => patchMember(i, { name: e.target.value })}
                    />
                  </div>
                  <span className="pool-slot__count">{m.pool.length}</span>
                </button>
              )
            })}
            <button
              type="button"
              className="pool-modal__add"
              onClick={() => {
                if (draft.length >= 6) return
                setDraft([
                  ...draft,
                  { id: createId(), name: 'Nuevo', role: 'Sub', side: 'none', pool: [] },
                ])
                setActiveMember(draft.length)
                setRolePicker(null)
              }}
              disabled={draft.length >= 6}
            >
              + Jugador
            </button>
          </aside>

          <main className="pool-modal__picker">
            <div className="pool-modal__member-bar">
              <div className="pool-modal__member-settings">
                <select
                  value={member.role}
                  onChange={(e) => {
                    const role = e.target.value
                    patchMember(activeMember, {
                      role,
                      side: sideForRole(role, member.side),
                    })
                  }}
                >
                  {['Top', 'Jungle', 'Mid', 'ADC', 'Support', 'Coach', 'Sub'].map((r) => (
                    <option key={r} value={r}>
                      {roleDisplayName(r)}
                    </option>
                  ))}
                </select>
                {inGame && (
                  <select
                    value={member.side === 'none' ? 'blue' : member.side}
                    onChange={(e) =>
                      patchMember(activeMember, { side: e.target.value as TeamSide })
                    }
                  >
                    <option value="blue">Azul</option>
                    <option value="red">Rojo</option>
                  </select>
                )}
              </div>

              <input
                className="pool-modal__search"
                placeholder="Buscar campeón…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {member.pool.length > 0 && (
              <div className="pool-modal__pool-list">
                <span className="pool-modal__pool-list-label">Pool de {member.name}</span>
                <div className="pool-modal__pool-list-items">
                  {member.pool.map((entry) => {
                    const champ = champsById.get(entry.championId)
                    if (!champ) return null
                    return (
                      <button
                        key={entry.championId}
                        type="button"
                        className="pool-list-chip"
                        title={`${champ.name} · ${roleDisplayName(entry.role)} (clic: cambiar rol · clic der: quitar)`}
                        onClick={(e) => openRolePicker(entry.championId, e.currentTarget)}
                        onContextMenu={(e) => onChampContextMenu(entry.championId, e)}
                      >
                        <img
                          className="pool-list-chip__portrait"
                          src={champ.icon}
                          alt={champ.name}
                          draggable={false}
                        />
                        <img
                          className="pool-list-chip__role"
                          src={roleIconPath(manifest, entry.role)}
                          alt={entry.role}
                          draggable={false}
                        />
                        <span className="pool-list-chip__name">{champ.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <p className="pool-modal__hint">
              Clic en campeón → elige línea · Clic der. en el pool o en la lista para quitar
            </p>

            <div
              ref={gridRef}
              className="pool-modal__grid-wrap"
              onClick={() => setRolePicker(null)}
            >
              <div className="pool-modal__grid pool-modal__grid--select">
                {filtered.map((c) => {
                  const entry = poolByChamp.get(c.id)
                  const selected = Boolean(entry)
                  const picking = rolePicker?.championId === c.id
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`pool-champ ${selected ? 'pool-champ--selected' : ''} ${picking ? 'pool-champ--picking' : ''}`}
                      onClick={(e) => onChampClick(c.id, e)}
                      onContextMenu={(e) => onChampContextMenu(c.id, e)}
                    >
                      <div className="pool-champ__portrait">
                        <img
                          className="pool-champ__icon"
                          src={c.icon}
                          alt={c.name}
                          loading="lazy"
                          draggable={false}
                        />
                        {selected && entry && (
                          <img
                            className="pool-champ__role-badge"
                            src={roleIconPath(manifest, entry.role)}
                            alt={entry.role}
                            draggable={false}
                          />
                        )}
                      </div>
                      <span className="pool-champ__name">{c.name}</span>
                    </button>
                  )
                })}
              </div>

              {rolePicker && (
                <div
                  className={`role-bubbles role-bubbles--fixed role-bubbles--${rolePicker.placement}`}
                  style={{
                    left: rolePicker.x,
                    top: rolePicker.anchorY,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="role-bubbles__title">Línea</span>
                  <div className="role-bubbles__row">
                    {POOL_ROLES.map((role) => (
                      <button
                        key={role}
                        type="button"
                        className="role-bubbles__btn"
                        title={roleDisplayName(role)}
                        onClick={() => confirmRole(role)}
                      >
                        <img src={roleIconPath(manifest, role)} alt={role} draggable={false} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>

        <footer className="pool-modal__footer">
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="primary" onClick={save}>
            Guardar equipo
          </button>
        </footer>
      </div>
    </div>
  )
}
