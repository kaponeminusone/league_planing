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
    lastEditBy,
    activeJugada,
    clientId,
  } = usePlanning()

  const dot =
    syncStatus === 'connected' ? 'ok' : syncStatus === 'connecting' ? 'wait' : 'off'

  const onSameJugada = connectedUsers.filter(
    (u) => u.clientId !== clientId && u.activeId === activeJugada.id,
  )

  return (
    <div className="float sync-strip" title="Sincronización">
      <span className={`sync-strip__dot sync-strip__dot--${dot}`} />
      <input
        className="sync-strip__user"
        value={userName}
        onChange={(e) => setUserName(e.target.value)}
        placeholder="user"
        maxLength={32}
        title="Tu nombre"
      />
      {connectedUsers.length > 1 && (
        <span className="sync-strip__count" title={`${connectedUsers.length} conectados`}>
          {connectedUsers.length}
        </span>
      )}
      {onSameJugada.length > 0 && (
        <div className="sync-strip__peers" title="En la misma jugada">
          {onSameJugada.map((u) => (
            <span
              key={u.clientId}
              className="sync-strip__peer"
              style={{ '--peer-color': peerColor(u.clientId) } as CSSProperties}
              title={u.userName}
            >
              <span className="sync-strip__peer-gem" />
            </span>
          ))}
        </div>
      )}
      {(liveActivity || lastEditBy) && (
        <span className="sync-strip__hint" title={liveActivity ?? lastEditBy ?? ''}>
          {liveActivity ? '●' : '○'}
        </span>
      )}
    </div>
  )
}
