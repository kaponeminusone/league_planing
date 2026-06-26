import type { CSSProperties } from 'react'
import { mapToScreen } from '../mapCoords'
import { usePlanning } from '../PlanningContext'
import { peerColor } from '../sync/peerColors'
import type { PeerCursor } from '../sync/types'

export function PeerSparks() {
  const { activeJugada, mapDimensions, peerCursors, clientId } = usePlanning()
  const viewport = activeJugada.viewport
  const mapW = mapDimensions.w
  const mapH = mapDimensions.h

  if (mapW <= 1) return null

  const visible = peerCursors.filter(
    (c) => c.activeId === activeJugada.id && c.clientId !== clientId,
  )

  if (!visible.length) return null

  return (
    <div className="peer-sparks" aria-hidden>
      {visible.map((c) => (
        <PeerSpark key={c.clientId} cursor={c} viewport={viewport} mapW={mapW} mapH={mapH} />
      ))}
    </div>
  )
}

function PeerSpark({
  cursor,
  viewport,
  mapW,
  mapH,
}: {
  cursor: PeerCursor
  viewport: { x: number; y: number; zoom: number }
  mapW: number
  mapH: number
}) {
  const pos = mapToScreen({ x: cursor.x, y: cursor.y }, viewport, mapW, mapH)
  const color = peerColor(cursor.clientId)

  return (
    <div
      className="peer-spark"
      style={{
        left: pos.x,
        top: pos.y,
        '--peer-color': color,
      } as CSSProperties}
    >
      <span className="peer-spark__pulse" />
      <span className="peer-spark__gem" />
      <span className="peer-spark__name">{cursor.userName}</span>
    </div>
  )
}
