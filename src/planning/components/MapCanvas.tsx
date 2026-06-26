import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clampMapZoom,
  initialMapViewport,
  mapToScreen,
  screenToMap,
  viewportNeedsInitialFit,
} from '../mapCoords'
import { hitMarker, parseTimerInput } from '../markerUtils'
import { findStrokeAt } from '../strokeUtils'
import { findTextBoxAt, MIN_TEXT_BOX_NORM, normalizeTextRect } from '../textUtils'
import { pickPingWheelSegment } from '../pingWheel'
import { usePlanning } from '../PlanningContext'
import { PeerSparks } from './PeerSparks'
import { PingWheel } from './PingWheel'
import { decodeEnemyDrag, decodeMinionDrag, decodePlayerDrag, acceptsMapDrag, ENEMY_DRAG_MIME, MINION_DRAG_MIME, PLAYER_DRAG_MIME } from '../drag'
import {
  MAP_SRC,
  MARKER_SIZE,
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
    placeEnemyMarker,
    placeMinionMarker,
    removeMarker,
    addStroke,
    removeStroke,
    addTextBox,
    removeTextBox,
    pingWheelOptions,
    recordMoveUndo,
    selectedAsset,
    drawColor,
    timerSeconds,
    clearPlacement,
    broadcastCursor,
  } = usePlanning()

  const containerRef = useRef<HTMLDivElement>(null)
  const trashRef = useRef<HTMLDivElement>(null)
  const fittedRef = useRef(false)
  const lastFittedMapRef = useRef<{ w: number; h: number } | null>(null)
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
  const [erasePreview, setErasePreview] = useState<{ x: number; y: number } | null>(null)
  const [pingWheel, setPingWheel] = useState<{
    centerX: number
    centerY: number
    placePosition: MapPoint
    selectedIndex: number | null
  } | null>(null)
  const [textRectDraft, setTextRectDraft] = useState<{ from: MapPoint; to: MapPoint } | null>(null)
  const [textEditor, setTextEditor] = useState<{
    x: number
    y: number
    width: number
    height: number
    value: string
  } | null>(null)
  const panOrigin = useRef({ x: 0, y: 0, vx: 0, vy: 0 })
  const strokeDragging = useRef(false)
  const erasingRef = useRef(false)
  const textRectDragging = useRef(false)

  const viewport = activeJugada.viewport
  const viewportRef = useRef(viewport)
  viewportRef.current = viewport
  const showPlaceGhost = tool === 'place' && selectedAsset !== null && !dragOver
  const isDrawingTool = tool === 'draw' || tool === 'arrow' || tool === 'text'
  const isStrokeDragging = strokeDraft !== null

  useEffect(() => {
    if (!showPlaceGhost) setPlacePreview(null)
  }, [showPlaceGhost, selectedAsset?.id])

  useEffect(() => {
    if (tool !== 'erase') setErasePreview(null)
  }, [tool])

  useEffect(() => {
    if (tool !== 'draw' && tool !== 'arrow') {
      setStrokeDraft(null)
      strokeDragging.current = false
    }
  }, [tool])

  useEffect(() => {
    if (tool !== 'text') {
      setTextRectDraft(null)
      textRectDragging.current = false
      setTextEditor(null)
    }
  }, [tool])

  const applyInitialViewportIfNeeded = useCallback(
    (mapW: number, mapH: number) => {
      const el = containerRef.current
      if (!el || mapW <= 1 || mapH <= 1) return false

      const cw = el.clientWidth
      const ch = el.clientHeight
      if (cw < 64 || ch < 64) return false

      const mapChanged =
        lastFittedMapRef.current?.w !== mapW || lastFittedMapRef.current?.h !== mapH

      const v = viewportRef.current
      if (fittedRef.current && !mapChanged && !viewportNeedsInitialFit(v, cw, ch, mapW, mapH)) {
        return false
      }

      setViewport(initialMapViewport(cw, ch, mapW, mapH))
      lastFittedMapRef.current = { w: mapW, h: mapH }
      fittedRef.current = true
      return true
    },
    [setViewport],
  )

  useEffect(() => {
    const img = new Image()
    img.src = MAP_SRC
    img.onload = () => {
      const dims = { w: img.naturalWidth, h: img.naturalHeight }
      setMapSize(dims)
      setMapDimensions(dims)
      requestAnimationFrame(() => applyInitialViewportIfNeeded(dims.w, dims.h))
    }
  }, [setMapDimensions, applyInitialViewportIfNeeded])

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
      const el = containerRef.current
      if (!el || mapSize.w <= 1) return
      const rect = getRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const factor = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = clampMapZoom(
        viewport.zoom * factor,
        el.clientWidth,
        el.clientHeight,
        mapSize.w,
        mapSize.h,
      )
      const scale = newZoom / viewport.zoom
      applyViewport({
        zoom: newZoom,
        x: mx - (mx - viewport.x) * scale,
        y: my - (my - viewport.y) * scale,
      })
    },
    [viewport, applyViewport, mapSize],
  )

  const updatePlacePreview = (clientX: number, clientY: number) => {
    if (!showPlaceGhost) return
    const rect = getRect()
    setPlacePreview({ x: clientX - rect.left, y: clientY - rect.top })
  }

  const updateErasePreview = (clientX: number, clientY: number) => {
    if (tool !== 'erase') return
    const rect = getRect()
    setErasePreview({ x: clientX - rect.left, y: clientY - rect.top })
  }

  const tryEraseAt = useCallback(
    (clientX: number, clientY: number) => {
      const rect = getRect()
      const textHit = findTextBoxAt(
        activeJugada.textBoxes ?? [],
        clientX,
        clientY,
        viewport,
        mapSize.w,
        mapSize.h,
        rect,
      )
      if (textHit) {
        removeTextBox(textHit.id)
        return
      }
      const stroke = findStrokeAt(
        activeJugada.strokes,
        clientX,
        clientY,
        viewport,
        mapSize.w,
        mapSize.h,
        rect,
      )
      if (stroke) removeStroke(stroke.id)
    },
    [activeJugada.strokes, activeJugada.textBoxes, viewport, mapSize, removeStroke, removeTextBox],
  )

  const updatePingWheelSelection = (clientX: number, clientY: number) => {
    setPingWheel((prev) => {
      if (!prev) return prev
      const rect = getRect()
      const dx = clientX - rect.left - prev.centerX
      const dy = clientY - rect.top - prev.centerY
      return { ...prev, selectedIndex: pickPingWheelSegment(dx, dy) }
    })
  }

  const commitPingWheel = useCallback(
    (wheel: NonNullable<typeof pingWheel>) => {
      if (wheel.selectedIndex === null) return
      const opt = pingWheelOptions[wheel.selectedIndex]
      if (!opt?.path) return
      addMarker({
        assetPath: opt.path,
        label: opt.label,
        position: wheel.placePosition,
        category: 'ping',
      })
    },
    [addMarker, pingWheelOptions],
  )

  const commitTextEditor = useCallback(() => {
    setTextEditor((prev) => {
      if (!prev) return null
      const text = prev.value.trim()
      if (text) {
        addTextBox({
          x: prev.x,
          y: prev.y,
          width: prev.width,
          height: prev.height,
          text,
          color: drawColor,
        })
      }
      return null
    })
  }, [addTextBox, drawColor])

  const textBoxScreenStyle = useCallback(
    (x: number, y: number, width: number, height: number) => {
      const topLeft = mapToScreen({ x, y }, viewport, mapSize.w, mapSize.h)
      const screenW = width * mapSize.w * viewport.zoom
      const screenH = height * mapSize.h * viewport.zoom
      const fontSize = Math.max(10, Math.min(screenH * 0.38, screenW * 0.22))
      return { left: topLeft.x, top: topLeft.y, width: screenW, height: screenH, fontSize }
    },
    [viewport, mapSize],
  )

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
    if (textEditor) return

    const hit = findMarkerAt(e.clientX, e.clientY)

    if (e.button === 2) {
      e.preventDefault()
      if (pingWheel) {
        setPingWheel(null)
        return
      }
      if (hit) {
        removeMarker(hit.id)
      } else {
        clearPlacement()
      }
      return
    }
    if (e.button !== 0) return
    const pt = toMap(e.clientX, e.clientY)

    if ((e.ctrlKey || e.altKey) && pingWheelOptions.length > 0) {
      const rect = getRect()
      setPingWheel({
        centerX: e.clientX - rect.left,
        centerY: e.clientY - rect.top,
        placePosition: pt,
        selectedIndex: null,
      })
      capturePointer(e)
      return
    }

    if (pingWheel) return

    if (hit && !isDrawingTool) {
      if (tool === 'erase') {
        removeMarker(hit.id)
        erasingRef.current = true
        capturePointer(e)
        return
      }
      setSelectedMarkerId(hit.id)
      setMarkerDrag({
        id: hit.id,
        grabDx: pt.x - hit.position.x,
        grabDy: pt.y - hit.position.y,
        startPos: { ...hit.position },
      })
      capturePointer(e)
      return
    }

    if (!isDrawingTool) {
      setSelectedMarkerId(null)
      setTimerEditId(null)
    }

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

    if (tool === 'text') {
      textRectDragging.current = true
      setTextRectDraft({ from: pt, to: pt })
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
      tryEraseAt(e.clientX, e.clientY)
      erasingRef.current = true
      capturePointer(e)
      return
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    sendCursorPresence(e.clientX, e.clientY)
    updatePlacePreview(e.clientX, e.clientY)
    updateErasePreview(e.clientX, e.clientY)

    if (pingWheel) {
      updatePingWheelSelection(e.clientX, e.clientY)
      return
    }

    if (markerDrag) {
      const pt = toMap(e.clientX, e.clientY)
      moveMarker(
        markerDrag.id,
        {
          x: Math.min(1, Math.max(0, pt.x - markerDrag.grabDx)),
          y: Math.min(1, Math.max(0, pt.y - markerDrag.grabDy)),
        },
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
      return
    }

    if (textRectDragging.current && textRectDraft) {
      setTextRectDraft((prev) => (prev ? { ...prev, to: toMap(e.clientX, e.clientY) } : null))
      return
    }

    if (erasingRef.current && tool === 'erase') {
      tryEraseAt(e.clientX, e.clientY)
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (pingWheel) {
      commitPingWheel(pingWheel)
      setPingWheel(null)
      return
    }
    if (markerDrag) {
      if (trashHot || isOverTrash(e.clientX, e.clientY)) {
        removeMarker(markerDrag.id)
      } else {
        const pt = toMap(e.clientX, e.clientY)
        const finalPos = {
          x: Math.min(1, Math.max(0, pt.x - markerDrag.grabDx)),
          y: Math.min(1, Math.max(0, pt.y - markerDrag.grabDy)),
        }
        const moved =
          Math.hypot(finalPos.x - markerDrag.startPos.x, finalPos.y - markerDrag.startPos.y) > 0.002
        if (moved) {
          moveMarker(markerDrag.id, finalPos, true)
          recordMoveUndo(markerDrag.id, markerDrag.startPos, finalPos)
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
      return
    }
    if (textRectDragging.current && textRectDraft) {
      const box = normalizeTextRect(textRectDraft.from, textRectDraft.to)
      if (box.width >= MIN_TEXT_BOX_NORM && box.height >= MIN_TEXT_BOX_NORM) {
        setTextEditor({ ...box, value: '' })
      }
      setTextRectDraft(null)
      textRectDragging.current = false
      return
    }
    if (erasingRef.current) {
      erasingRef.current = false
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const pt = toMap(e.clientX, e.clientY)

    const enemyPayload = decodeEnemyDrag(e.dataTransfer.getData(ENEMY_DRAG_MIME))
    if (enemyPayload) {
      placeEnemyMarker({
        assetPath: enemyPayload.championIcon,
        label: `${enemyPayload.slotLabel} — ${enemyPayload.championName}`,
        position: pt,
        enemySlotId: enemyPayload.slotId,
        enemyLabel: enemyPayload.slotLabel,
        playerRole: enemyPayload.memberRole,
        championId: enemyPayload.championId,
        championName: enemyPayload.championName,
      })
      return
    }

    const minionPayload = decodeMinionDrag(e.dataTransfer.getData(MINION_DRAG_MIME))
    if (minionPayload) {
      placeMinionMarker(minionPayload.side, pt)
      return
    }

    const payload = decodePlayerDrag(e.dataTransfer.getData(PLAYER_DRAG_MIME))
    if (!payload) return
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
    if (!acceptsMapDrag(e.dataTransfer.types)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOver(true)
  }

  const previewWidth = (w: number) => w / viewport.zoom

  const onPointerLeave = () => {
    setPlacePreview(null)
    setErasePreview(null)
    if (pingWheel) setPingWheel(null)
    if (panning) setPanning(false)
    if (strokeDragging.current) cancelStroke()
    if (textRectDragging.current) {
      setTextRectDraft(null)
      textRectDragging.current = false
    }
    if (erasingRef.current) erasingRef.current = false
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
        : tool === 'draw' || tool === 'arrow' || tool === 'text'
          ? isStrokeDragging || textRectDragging.current
            ? 'crosshair'
            : 'crosshair'
          : tool === 'erase'
            ? 'none'
            : pingWheel
              ? 'none'
              : 'crosshair'

  const isEraseTool = tool === 'erase'
  const textRectPreview = textRectDraft ? normalizeTextRect(textRectDraft.from, textRectDraft.to) : null

  return (
    <div
      ref={containerRef}
      className={`map-canvas ${dragOver ? 'map-canvas--drop' : ''} ${isDrawingTool ? 'map-canvas--draw-tool' : ''} ${isEraseTool ? 'map-canvas--erase-tool' : ''}`}
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
          const isEnemy = m.category === 'enemy'
          const isMinion = m.category === 'minion'
          const size = isMinion ? 26 : MARKER_SIZE
          const isSelected = selectedMarkerId === m.id
          return (
            <div
              key={m.id}
              className={`map-marker ${isPlayer ? 'map-marker--player' : ''} ${isEnemy ? 'map-marker--enemy' : ''} ${isMinion ? 'map-marker--minion' : ''} ${isMinion && m.minionSide === 'red' ? 'map-marker--minion-red' : ''} ${isSelected ? 'map-marker--selected' : ''}`}
              style={{
                left: pos.x - size / 2,
                top: pos.y - (isPlayer || isEnemy ? size / 2 + 6 : size / 2),
                width: size,
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
              {(isPlayer || isEnemy) && m.playerRole && (
                <span className={`map-marker__role ${isEnemy ? 'map-marker__role--enemy' : ''}`}>
                  {m.playerRole}
                </span>
              )}
              <img src={m.assetPath} alt={m.label} draggable={false} />
              {isPlayer && (
                <span className="map-marker__player">{m.playerName}</span>
              )}
              {isEnemy && (
                <span className="map-marker__player map-marker__player--enemy">
                  {m.enemyLabel ?? m.championName}
                </span>
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
        {(activeJugada.textBoxes ?? []).map((tb) => {
          const style = textBoxScreenStyle(tb.x, tb.y, tb.width, tb.height)
          return (
            <div
              key={tb.id}
              className="map-text-box"
              style={{ ...style, color: tb.color, fontSize: style.fontSize }}
            >
              {tb.text}
            </div>
          )
        })}
        {textRectPreview && (
          <div
            className="map-text-box map-text-box--preview"
            style={{
              ...textBoxScreenStyle(
                textRectPreview.x,
                textRectPreview.y,
                textRectPreview.width,
                textRectPreview.height,
              ),
              color: drawColor,
            }}
            aria-hidden
          />
        )}
        {textEditor && (
          <div
            className="map-text-box map-text-box--editor"
            style={{
              ...textBoxScreenStyle(textEditor.x, textEditor.y, textEditor.width, textEditor.height),
              color: drawColor,
              fontSize: textBoxScreenStyle(
                textEditor.x,
                textEditor.y,
                textEditor.width,
                textEditor.height,
              ).fontSize,
            }}
          >
            <textarea
              className="map-text-box__input"
              value={textEditor.value}
              autoFocus
              placeholder="Escribe aquí…"
              onPointerDown={(e) => e.stopPropagation()}
              onChange={(e) =>
                setTextEditor((prev) => (prev ? { ...prev, value: e.target.value } : null))
              }
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  commitTextEditor()
                }
                if (e.key === 'Escape') setTextEditor(null)
              }}
              onBlur={commitTextEditor}
            />
          </div>
        )}
      </div>

      {pingWheel && pingWheelOptions.length > 0 && (
        <PingWheel
          centerX={pingWheel.centerX}
          centerY={pingWheel.centerY}
          options={pingWheelOptions}
          selectedIndex={pingWheel.selectedIndex}
        />
      )}

      {isEraseTool && erasePreview && (
        <div
          className="map-eraser-preview"
          style={{ left: erasePreview.x, top: erasePreview.y }}
          aria-hidden
        />
      )}

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
