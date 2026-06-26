import type { CSSProperties } from 'react'
import { usePlanning } from '../PlanningContext'
import { peerColor } from '../sync/peerColors'

export function SyncPanel() {
  const {
    syncStatus,
    userName,
    setUserName,
    connectedUsers,
    liveActivity,
    activeJugada,
    clientId,
  } = usePlanning()

  const dot =
    syncStatus === 'connected' ? 'ok' : syncStatus === 'connecting' ? 'wait' : 'off'

  return (
    <div className="float sync-panel" title="Sincronización en tiempo real">
      <div className="sync-panel__header">
        <span className={`sync-panel__dot sync-panel__dot--${dot}`} />
        <input
          className="sync-panel__user"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder="Tu nombre"
          maxLength={32}
          title="Tu nombre"
        />
      </div>

      <div className="sync-panel__users">
        <span className="sync-panel__users-label">
          En sala ({connectedUsers.length})
        </span>
        <ul className="sync-panel__list">
          {connectedUsers.map((u) => {
            const isSelf = u.clientId === clientId
            const sameJugada = u.activeId === activeJugada.id
            return (
              <li
                key={u.clientId}
                className={`sync-panel__item ${isSelf ? 'sync-panel__item--self' : ''}`}
              >
                <span
                  className="sync-panel__gem"
                  style={{ '--peer-color': peerColor(u.clientId) } as CSSProperties}
                />
                <span className="sync-panel__name">
                  {u.userName}
                  {isSelf ? ' (tú)' : ''}
                </span>
                {sameJugada && (
                  <span className="sync-panel__jugada" title="En esta jugada">
                    ●
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {liveActivity && (
        <p className="sync-panel__activity" title={liveActivity}>
          {liveActivity}
        </p>
      )}
    </div>
  )
}
