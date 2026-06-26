import { useMemo, useState } from 'react'
import { usePlanning } from '../PlanningContext'
import { encodePlayerDrag, PLAYER_DRAG_MIME } from '../drag'
import { roleDisplayName, roleIconPath } from '../roles'
import { IN_GAME_ROLES, type TeamMember, type TeamSide } from '../types'

const ROLE_ORDER = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'] as const

function roleSort(a: TeamMember, b: TeamMember) {
  const ia = ROLE_ORDER.indexOf(a.role as (typeof ROLE_ORDER)[number])
  const ib = ROLE_ORDER.indexOf(b.role as (typeof ROLE_ORDER)[number])
  return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
}

function isInGame(m: TeamMember) {
  return m.side !== 'none' && IN_GAME_ROLES.includes(m.role as (typeof IN_GAME_ROLES)[number])
}

export function TeamPoolBar() {
  const { team, manifest, activeJugada, setPoolModalOpen, focusOnPlayer } = usePlanning()
  const [open, setOpen] = useState(true)

  const champsById = useMemo(
    () => new Map(manifest.champions.map((c) => [c.id, c])),
    [manifest.champions],
  )

  const markersByPlayer = useMemo(
    () => new Map(activeJugada.markers.filter((m) => m.playerId).map((m) => [m.playerId!, m])),
    [activeJugada.markers],
  )

  const blueInGame = useMemo(
    () => team.filter((m) => isInGame(m) && m.side === 'blue').sort(roleSort),
    [team],
  )
  const redInGame = useMemo(
    () => team.filter((m) => isInGame(m) && m.side === 'red').sort(roleSort),
    [team],
  )

  const portraitFor = (member: TeamMember) => {
    const onMap = markersByPlayer.get(member.id)
    if (onMap) return { src: onMap.assetPath, label: onMap.championName ?? member.name }
    const first = member.pool[0]
    const champ = first ? champsById.get(first.championId) : null
    if (champ) return { src: champ.icon, label: champ.name }
    return null
  }

  const renderInGameRow = (members: TeamMember[], side: TeamSide) => {
    if (!members.length) return null
    return (
      <div className={`team-hud__row team-hud__row--${side}`}>
        {members.map((member) => {
          const portrait = portraitFor(member)
          const onMap = markersByPlayer.has(member.id)
          return (
            <button
              key={member.id}
              type="button"
              className={`team-hud__portrait ${onMap ? 'team-hud__portrait--on-map' : ''}`}
              title={
                onMap
                  ? `Ir a ${member.name} (${member.role})`
                  : `${member.name} — sin posición en mapa`
              }
              disabled={!onMap}
              onClick={() => focusOnPlayer(member.id)}
            >
              {portrait ? (
                <img src={portrait.src} alt={portrait.label} draggable={false} />
              ) : (
                <img
                  className="team-hud__portrait-role-icon"
                  src={roleIconPath(manifest, member.role)}
                  alt={member.role}
                  draggable={false}
                />
              )}
              <span className="team-hud__portrait-role">{roleDisplayName(member.role)}</span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className={`float team-panel ${open ? 'team-panel--open' : ''}`}>
      <button
        type="button"
        className="team-panel__toggle icon-btn icon-btn--on"
        onClick={() => setOpen((v) => !v)}
        title={open ? 'Ocultar equipo' : 'Pool de equipo'}
      >
        EQ
      </button>
      {open && (
        <div className="team-panel__body">
          <div className="team-panel__head">
            <span>En juego</span>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setPoolModalOpen(true)}
              title="Configurar equipo"
            >
              ⚙
            </button>
          </div>

          {renderInGameRow(blueInGame, 'blue')}
          {renderInGameRow(redInGame, 'red')}

          <div className="team-panel__divider" />

          <div className="team-panel__head">
            <span>Pools</span>
          </div>

          {team.map((member) => {
            const count = member.pool.length
            const stackClass = count > 8 ? 'team-pool-card__stack--multi' : ''

            return (
              <div key={member.id} className="team-pool-card">
                <div className="team-pool-card__name">{member.name}</div>
                <div className={`team-pool-card__stack ${stackClass}`}>
                  {count === 0 ? (
                    <span className="team-pool-card__empty muted">vacío</span>
                  ) : (
                    member.pool.map((entry) => {
                      const champ = champsById.get(entry.championId)
                      if (!champ) return null
                      return (
                        <button
                          key={`${entry.championId}-${entry.role}`}
                          type="button"
                          className="team-pool-card__orb"
                          draggable
                          title={`${member.name} — ${champ.name} (${entry.role})`}
                          onDragStart={(e) => {
                            e.dataTransfer.setData(
                              PLAYER_DRAG_MIME,
                              encodePlayerDrag({
                                memberId: member.id,
                                memberName: member.name,
                                memberRole: entry.role,
                                championId: champ.id,
                                championName: champ.name,
                                championIcon: champ.icon,
                              }),
                            )
                            e.dataTransfer.effectAllowed = 'copy'
                            const img = e.currentTarget.querySelector('.team-pool-card__orb-champ')
                            if (img instanceof HTMLImageElement) {
                              e.dataTransfer.setDragImage(img, 18, 18)
                            }
                          }}
                        >
                          <img
                            className="team-pool-card__orb-champ"
                            src={champ.icon}
                            alt={champ.name}
                            draggable={false}
                          />
                          <span className="team-pool-card__orb-role-wrap" aria-hidden>
                            <img
                              className="team-pool-card__orb-role"
                              src={roleIconPath(manifest, entry.role)}
                              alt=""
                              draggable={false}
                            />
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
