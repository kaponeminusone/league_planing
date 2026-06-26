import { useEffect, useRef, useState, type CSSProperties } from 'react'
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

  const [draftName, setDraftName] = useState(userName)
  const editingRef = useRef(false)

  useEffect(() => {
    if (!editingRef.current) setDraftName(userName)
  }, [userName])

  const commitName = () => {
    editingRef.current = false
    const next = draftName.trim().slice(0, 32) || 'user'
    setDraftName(next)
    if (next !== userName) setUserName(next)
  }

  const dot =
    syncStatus === 'connected' ? 'ok' : syncStatus === 'connecting' ? 'wait' : 'off'

  return (
    <div className="float sync-panel" title="Sincronización en tiempo real">
      <div className="sync-panel__header">
        <span className={`sync-panel__dot sync-panel__dot--${dot}`} />
        <input
          className="sync-panel__user"
          value={draftName}
          onFocus={() => {
            editingRef.current = true
          }}
          onChange={(e) => setDraftName(e.target.value.slice(0, 32))}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.currentTarget.blur()
            }
            if (e.key === 'Escape') {
              editingRef.current = false
              setDraftName(userName)
              e.currentTarget.blur()
            }
          }}
          placeholder="Tu nombre"
          maxLength={32}
          title="Tu nombre (Enter para guardar)"
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
