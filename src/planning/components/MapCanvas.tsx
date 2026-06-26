import { useCallback, useEffect, useRef, useState } from 'react'
import { fitMapViewport, mapToScreen, screenToMap } from '../mapCoords'
import { hitMarker, parseTimerInput } from '../markerUtils'
import { usePlanning } from '../PlanningContext'
import { PeerSparks } from './PeerSparks'
import { decodePlayerDrag, PLAYER_DRAG_MIME } from '../drag'
import {
  DEFAULT_ZOOM,
  MAP_SRC,
  MARKER_SIZE,
  MAX_ZOOM,
  MIN_ZOOM,
  type MapPoint,
  type Viewport,
} from '../types'

const MIN_ARROW_LEN = 0.012
const MIN_FREEHAND_POINTS = 2
const FREEHAND_SAMPLE = 0.003

type StrokeDraft =
  | { type: 'freehand'; points: MapPoint[] }
  | { type: 'arrow'; from: MapPoint; to: MapPoint }

export function MapCanvas() {
  const {
    activeJugada,
    tool,
    setViewport,
    setMapDimensions,
    selectedMarkerId,
    setSelectedMarkerId,
    updateMarker,
    moveMarker,
    addMarker,
    placePlayerMarker,
    removeMarker,
    addStroke,
    removeStroke,
    pushHistory,
    discardLastHistory,
    selectedAsset,
    drawColor,
    timerSeconds,
    clearPlacement,
    broadcastCursor,
  } = usePlanning()

  const containerRef = useRef<HTMLDivElement>(null)
  const trashRef = useRef<HTMLDivElement>(null)
  const fittedRef = useRef(false)
  const cursorThrottle = useRef(0)
  const [mapSize, setMapSize] = useState({ w: 1, h: 1 })
  const [panning, setPanning] = useState(false)
  const [strokeDraft, setStrokeDraft] = useState<StrokeDraft | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [placePreview, setPlacePreview] = useState<{ x: number; y: number } | null>(null)
  const [markerDrag, setMarkerDrag] = useState<{
    id: string
    grabDx: number
    grabDy: number
    startPos: MapPoint
  } | null>(null)
  const [trashHot, setTrashHot] = useState(false)
  const [timerEditId, setTimerEditId] = useState<string | null>(null)
  const [timerEditValue, setTimerEditValue] = useState('')
  const panOrigin = useRef({ x: 0, y: 0, vx: 0, vy: 0 })
  const strokeDragging = useRef(false)

  const viewport = activeJugada.viewport
  const showPlaceGhost = tool === 'place' && selectedAsset !== null && !dragOver
  const isStrokeDragging = strokeDraft !== null

  useEffect(() => {
    if (!showPlaceGhost) setPlacePreview(null)
  }, [showPlaceGhost, selectedAsset?.id])

  useEffect(() => {
    if (tool !== 'draw' && tool !== 'arrow') {
      setStrokeDraft(null)
      strokeDragging.current = false
    }
  }, [tool])

  useEffect(() => {
    const img = new Image()
    img.src = MAP_SRC
    img.onload = () => {
      const dims = { w: img.naturalWidth, h: img.naturalHeight }
      setMapSize(dims)
      setMapDimensions(dims)
      const el = containerRef.current
      if (el && !fittedRef.current) {
        fittedRef.current = true
        const v = activeJugada.viewport
        const isFresh = v.x === 0 && v.y === 0 && v.zoom === DEFAULT_ZOOM
        if (isFresh) {
          setViewport(fitMapViewport(el.clientWidth, el.clientHeight, dims.w, dims.h))
        }
      }
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedMarkerId) {
        e.preventDefault()
        removeMarker(selectedMarkerId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedMarkerId, removeMarker])

  const getRect = () => containerRef.current!.getBoundingClientRect()

  const findMarkerAt = useCallback(
    (clientX: number, clientY: number) =>
      hitMarker(
        activeJugada.markers,
        clientX,
        clientY,
        viewport,
        mapSize.w,
        mapSize.h,
        getRect(),
        MARKER_SIZE / 2 + 4,
      ),
    [activeJugada.markers, viewport, mapSize],
  )

  const isOverTrash = (clientX: number, clientY: number) => {
    const trash = trashRef.current
    if (!trash) return false
    const r = trash.getBoundingClientRect()
    return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom
  }

  const commitTimerEdit = (id: string, raw: string) => {
    const parsed = parseTimerInput(raw)
    if (parsed !== null) updateMarker(id, { timerSeconds: parsed })
    setTimerEditId(null)
  }

  const startTimerEdit = (id: string, seconds: number) => {
    setTimerEditId(id)
    setTimerEditValue(formatTimer(seconds))
    setSelectedMarkerId(id)
  }

  const toMap = useCallback(
    (clientX: number, clientY: number): MapPoint => {
      return screenToMap(clientX, clientY, viewport, mapSize.w, mapSize.h, getRect())
    },
    [viewport, mapSize],
  )

  const applyViewport = useCallback(
    (v: Viewport) => setViewport(v),
    [setViewport],
  )

  const sendCursorPresence = useCallback(
    (clientX: number, clientY: number) => {
      const now = Date.now()
      if (now - cursorThrottle.current < 80) return
      cursorThrottle.current = now
      if (mapSize.w <= 1) return
      const pt = screenToMap(clientX, clientY, viewport, mapSize.w, mapSize.h, getRect())
      broadcastCursor(activeJugada.id, pt.x, pt.y)
    },
    [activeJugada.id, broadcastCursor, viewport, mapSize],
  )

  const capturePointer = (e: React.PointerEvent) => {
    containerRef.current?.setPointerCapture(e.pointerId)
  }

  const releaseStrokeAt = useCallback(
    (endPt: MapPoint) => {
      setStrokeDraft((prev) => {
        if (!prev) return null

        if (prev.type === 'freehand') {
          const points = [...prev.points]
          const last = points[points.length - 1]
          if (!last || mapDist(last, endPt) >= FREEHAND_SAMPLE) points.push(endPt)
          if (points.length >= MIN_FREEHAND_POINTS) {
            addStroke({ type: 'freehand', points, color: drawColor, width: 2.5 })
          }
        }

        if (prev.type === 'arrow') {
          if (mapDist(prev.from, endPt) >= MIN_ARROW_LEN) {
            addStroke({
              type: 'arrow',
              points: [prev.from, endPt],
              color: drawColor,
              width: 3,
            })
          }
        }

        return null
      })
      strokeDragging.current = false
    },
    [addStroke, drawColor],
  )

  const cancelStroke = useCallback(() => {
    setStrokeDraft(null)
    strokeDragging.current = false
  }, [])

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const rect = getRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const factor = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, viewport.zoom * factor))
      const scale = newZoom / viewport.zoom
      applyViewport({
        zoom: newZoom,
        x: mx - (mx - viewport.x) * scale,
        y: my - (my - viewport.y) * scale,
      })
    },
    [viewport, applyViewport],
  )

  const updatePlacePreview = (clientX: number, clientY: number) => {
    if (!showPlaceGhost) return
    const rect = getRect()
    setPlacePreview({ x: clientX - rect.left, y: clientY - rect.top })
  }

  const updateStrokeDraft = (pt: MapPoint) => {
    setStrokeDraft((prev) => {
      if (!prev) return prev
      if (prev.type === 'arrow') {
        return { ...prev, to: pt }
      }
      const last = prev.points[prev.points.length - 1]
      if (last && mapDist(last, pt) < FREEHAND_SAMPLE) return prev
      return { ...prev, points: [...prev.points, pt] }
    })
  }

  const onPointerDown = (e: React.PointerEvent) => {
    const hit = findMarkerAt(e.clientX, e.clientY)

    if (e.button === 2) {
      e.preventDefault()
      if (hit) {
        removeMarker(hit.id)
      } else {
        clearPlacement()
      }
      return
    }
    if (e.button !== 0) return
    const pt = toMap(e.clientX, e.clientY)

    if (hit) {
      if (tool === 'erase') {
        removeMarker(hit.id)
        return
      }
      setSelectedMarkerId(hit.id)
      pushHistory()
      setMarkerDrag({
        id: hit.id,
        grabDx: pt.x - hit.position.x,
        grabDy: pt.y - hit.position.y,
        startPos: { ...hit.position },
      })
      capturePointer(e)
      return
    }

    setSelectedMarkerId(null)
    setTimerEditId(null)

    if (tool === 'pan') {
      setPanning(true)
      panOrigin.current = { x: e.clientX, y: e.clientY, vx: viewport.x, vy: viewport.y }
      capturePointer(e)
      return
    }

    if (tool === 'draw') {
      strokeDragging.current = true
      setStrokeDraft({ type: 'freehand', points: [pt] })
      capturePointer(e)
      return
    }

    if (tool === 'arrow') {
      strokeDragging.current = true
      setStrokeDraft({ type: 'arrow', from: pt, to: pt })
      capturePointer(e)
      return
    }

    if (tool === 'place' && selectedAsset) {
      addMarker({
        assetPath: selectedAsset.path,
        label: selectedAsset.label,
        position: pt,
        category: selectedAsset.category,
        timerSeconds: selectedAsset.category === 'ping' ? timerSeconds : undefined,
      })
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
        clearPlacement()
      }
      return
    }

    if (tool === 'erase') {
      const strokeHit = activeJugada.strokes.find((s) =>
        s.points.some((p) => {
          const sc = mapToScreen(p, viewport, mapSize.w, mapSize.h)
          const rect = getRect()
          return Math.hypot(e.clientX - rect.left - sc.x, e.clientY - rect.top - sc.y) < 12
        }),
      )
      if (strokeHit) removeStroke(strokeHit.id)
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    sendCursorPresence(e.clientX, e.clientY)
    updatePlacePreview(e.clientX, e.clientY)

    if (markerDrag) {
      const pt = toMap(e.clientX, e.clientY)
      moveMarker(
        markerDrag.id,
        {
          x: Math.min(1, Math.max(0, pt.x - markerDrag.grabDx)),
          y: Math.min(1, Math.max(0, pt.y - markerDrag.grabDy)),
        },
        false,
        false,
      )
      setTrashHot(isOverTrash(e.clientX, e.clientY))
      return
    }

    if (panning) {
      const dx = e.clientX - panOrigin.current.x
      const dy = e.clientY - panOrigin.current.y
      applyViewport({ ...viewport, x: panOrigin.current.vx + dx, y: panOrigin.current.vy + dy })
      return
    }

    if (strokeDragging.current && strokeDraft) {
      updateStrokeDraft(toMap(e.clientX, e.clientY))
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (markerDrag) {
      if (trashHot || isOverTrash(e.clientX, e.clientY)) {
        removeMarker(markerDrag.id, false)
      } else {
        const pt = toMap(e.clientX, e.clientY)
        const finalPos = {
          x: Math.min(1, Math.max(0, pt.x - markerDrag.grabDx)),
          y: Math.min(1, Math.max(0, pt.y - markerDrag.grabDy)),
        }
        const moved =
          Math.hypot(finalPos.x - markerDrag.startPos.x, finalPos.y - markerDrag.startPos.y) > 0.002
        if (moved) {
          moveMarker(markerDrag.id, finalPos, true, false)
        } else {
          discardLastHistory()
        }
      }
      setMarkerDrag(null)
      setTrashHot(false)
      return
    }
    if (panning) {
      setPanning(false)
      return
    }
    if (strokeDragging.current) {
      releaseStrokeAt(toMap(e.clientX, e.clientY))
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const payload = decodePlayerDrag(e.dataTransfer.getData(PLAYER_DRAG_MIME))
    if (!payload) return
    const pt = toMap(e.clientX, e.clientY)
    placePlayerMarker({
      assetPath: payload.championIcon,
      label: `${payload.memberName} — ${payload.championName}`,
      position: pt,
      playerId: payload.memberId,
      playerName: payload.memberName,
      playerRole: payload.memberRole,
      championId: payload.championId,
      championName: payload.championName,
    })
  }

  const onDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(PLAYER_DRAG_MIME)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOver(true)
  }

  const previewWidth = (w: number) => w / viewport.zoom

  const onPointerLeave = () => {
    setPlacePreview(null)
    if (panning) setPanning(false)
    if (strokeDragging.current) cancelStroke()
    if (markerDrag) {
      setMarkerDrag(null)
      setTrashHot(false)
    }
  }

  const resolvedCursor =
    markerDrag
      ? trashHot
        ? 'not-allowed'
        : 'grabbing'
      : showPlaceGhost && placePreview
      ? 'none'
      : tool === 'pan'
        ? panning
          ? 'grabbing'
          : 'grab'
        : tool === 'draw' || tool === 'arrow'
          ? isStrokeDragging
            ? 'none'
            : 'crosshair'
          : tool === 'erase'
            ? 'not-allowed'
            : 'crosshair'

  return (
    <div
      ref={containerRef}
      className={`map-canvas ${dragOver ? 'map-canvas--drop' : ''}`}
      style={{ cursor: resolvedCursor }}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onContextMenu={(e) => {
        if (!findMarkerAt(e.clientX, e.clientY)) {
          e.preventDefault()
          clearPlacement()
        }
      }}
      onDragOver={onDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div
        className="map-canvas__world"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          width: mapSize.w,
          height: mapSize.h,
        }}
      >
        <img src={MAP_SRC} alt="Summoner's Rift" draggable={false} className="map-canvas__img" />
        <svg className="map-canvas__svg" viewBox={`0 0 ${mapSize.w} ${mapSize.h}`}>
          {activeJugada.strokes.map((stroke) => (
            <g key={stroke.id}>
              {stroke.type === 'freehand' && stroke.points.length > 1 && (
                <polyline
                  points={stroke.points.map((p) => `${p.x * mapSize.w},${p.y * mapSize.h}`).join(' ')}
                  fill="none"
                  stroke={stroke.color}
                  strokeWidth={previewWidth(stroke.width)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {stroke.type === 'arrow' && stroke.points.length === 2 && (
                <Arrow
                  from={stroke.points[0]}
                  to={stroke.points[1]}
                  mapW={mapSize.w}
                  mapH={mapSize.h}
                  color={stroke.color}
                  width={previewWidth(stroke.width)}
                />
              )}
            </g>
          ))}

          {strokeDraft?.type === 'freehand' && strokeDraft.points.length > 0 && (
            <>
              {strokeDraft.points.length === 1 ? (
                <circle
                  className="stroke-preview"
                  cx={strokeDraft.points[0].x * mapSize.w}
                  cy={strokeDraft.points[0].y * mapSize.h}
                  r={4 / viewport.zoom}
                  fill={drawColor}
                />
              ) : (
                <polyline
                  className="stroke-preview"
                  points={strokeDraft.points
                    .map((p) => `${p.x * mapSize.w},${p.y * mapSize.h}`)
                    .join(' ')}
                  fill="none"
                  stroke={drawColor}
                  strokeWidth={previewWidth(2.5)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </>
          )}

          {strokeDraft?.type === 'arrow' && (
            <Arrow
              from={strokeDraft.from}
              to={strokeDraft.to}
              mapW={mapSize.w}
              mapH={mapSize.h}
              color={drawColor}
              width={previewWidth(3)}
              ghost
            />
          )}
        </svg>
      </div>

      <div className="map-canvas__markers">
        {activeJugada.markers.map((m) => {
          const pos = mapToScreen(m.position, viewport, mapSize.w, mapSize.h)
          const isPlayer = m.category === 'player' && m.playerName
          const isSelected = selectedMarkerId === m.id
          return (
            <div
              key={m.id}
              className={`map-marker ${isPlayer ? 'map-marker--player' : ''} ${isSelected ? 'map-marker--selected' : ''}`}
              style={{
                left: pos.x - MARKER_SIZE / 2,
                top: pos.y - (isPlayer ? MARKER_SIZE / 2 + 6 : MARKER_SIZE / 2),
                width: MARKER_SIZE,
              }}
              title={m.label}
              onDoubleClick={(e) => {
                e.stopPropagation()
                if (m.timerSeconds !== undefined) startTimerEdit(m.id, m.timerSeconds)
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                removeMarker(m.id)
              }}
            >
              {isPlayer && m.playerRole && (
                <span className="map-marker__role">{m.playerRole}</span>
              )}
              <img src={m.assetPath} alt={m.label} draggable={false} />
              {isPlayer && (
                <span className="map-marker__player">{m.playerName}</span>
              )}
              {m.timerSeconds !== undefined &&
                (timerEditId === m.id ? (
                  <input
                    className="map-marker__timer-input"
                    value={timerEditValue}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setTimerEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation()
                      if (e.key === 'Enter') commitTimerEdit(m.id, timerEditValue)
                      if (e.key === 'Escape') setTimerEditId(null)
                    }}
                    onBlur={() => commitTimerEdit(m.id, timerEditValue)}
                  />
                ) : (
                  <span className="map-marker__timer">{formatTimer(m.timerSeconds)}</span>
                ))}
            </div>
          )
        })}
        {showPlaceGhost && placePreview && selectedAsset && (
          <div
            className="map-marker map-marker--ghost"
            style={{
              left: placePreview.x - MARKER_SIZE / 2,
              top: placePreview.y - MARKER_SIZE / 2,
              width: MARKER_SIZE,
            }}
            aria-hidden
          >
            <img src={selectedAsset.path} alt="" draggable={false} />
            {selectedAsset.category === 'ping' && (
              <span className="map-marker__timer map-marker__timer--ghost">
                {formatTimer(timerSeconds)}
              </span>
            )}
          </div>
        )}
      </div>

      <PeerSparks />

      {(markerDrag || trashHot) && (
        <div
          ref={trashRef}
          className={`map-canvas__trash ${trashHot ? 'map-canvas__trash--hot' : ''}`}
        >
          Eliminar
        </div>
      )}
    </div>
  )
}

function mapDist(a: MapPoint, b: MapPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function Arrow({
  from,
  to,
  mapW,
  mapH,
  color,
  width,
  ghost = false,
}: {
  from: MapPoint
  to: MapPoint
  mapW: number
  mapH: number
  color: string
  width: number
  ghost?: boolean
}) {
  const x1 = from.x * mapW
  const y1 = from.y * mapH
  const x2 = to.x * mapW
  const y2 = to.y * mapH
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const head = Math.max(10, width * 4)

  return (
    <g className={ghost ? 'stroke-preview' : undefined}>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
      />
      {mapDist(from, to) >= MIN_ARROW_LEN && (
        <polygon
          points={`
            ${x2},${y2}
            ${x2 - head * Math.cos(angle - 0.4)},${y2 - head * Math.sin(angle - 0.4)}
            ${x2 - head * Math.cos(angle + 0.4)},${y2 - head * Math.sin(angle + 0.4)}
          `}
          fill={color}
          opacity={ghost ? 0.7 : 1}
        />
      )}
      {ghost && (
        <circle cx={x1} cy={y1} r={width * 1.4} fill={color} opacity={0.55} />
      )}
    </g>
  )
}

function formatTimer(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
