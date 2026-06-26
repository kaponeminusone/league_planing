import { useCallback, useEffect, useRef, useState } from 'react'
import { clampMapZoom } from '../mapCoords'
import { usePlanning } from '../PlanningContext'
import { MAP_SRC } from '../types'

const MINI_W = 160
const MINI_H = 160
const ZOOM_DRAG_SENS = 0.0045

export function MapMinimap() {
  const { activeJugada, setViewport, mapDimensions } = usePlanning()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mapImg, setMapImg] = useState<HTMLImageElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const zoomDragRef = useRef<{ startX: number; startZoom: number } | null>(null)

  const viewport = activeJugada.viewport

  useEffect(() => {
    const img = new Image()
    img.src = MAP_SRC
    img.onload = () => setMapImg(img)
  }, [])

  const getStage = () => canvasRef.current?.parentElement?.parentElement ?? null

  const setZoomKeepingCenter = useCallback(
    (newZoom: number) => {
      const parent = getStage()
      if (!parent || mapDimensions.w <= 1) return

      const cw = parent.clientWidth
      const ch = parent.clientHeight
      const z = clampMapZoom(newZoom, cw, ch, mapDimensions.w, mapDimensions.h)
      const centerMapX = (cw / 2 - viewport.x) / (mapDimensions.w * viewport.zoom)
      const centerMapY = (ch / 2 - viewport.y) / (mapDimensions.h * viewport.zoom)

      setViewport({
        zoom: z,
        x: cw / 2 - centerMapX * mapDimensions.w * z,
        y: ch / 2 - centerMapY * mapDimensions.h * z,
      })
    },
    [mapDimensions, setViewport, viewport.x, viewport.y, viewport.zoom],
  )

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !mapImg) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, MINI_W, MINI_H)
    const scale = Math.min(MINI_W / mapImg.naturalWidth, MINI_H / mapImg.naturalHeight)
    const dw = mapImg.naturalWidth * scale
    const dh = mapImg.naturalHeight * scale
    const ox = (MINI_W - dw) / 2
    const oy = (MINI_H - dh) / 2

    ctx.drawImage(mapImg, ox, oy, dw, dh)

    const parent = getStage()
    if (!parent) return
    const cw = parent.clientWidth
    const ch = parent.clientHeight
    const mapW = mapImg.naturalWidth
    const mapH = mapImg.naturalHeight

    const visX = -viewport.x / (mapW * viewport.zoom)
    const visY = -viewport.y / (mapH * viewport.zoom)
    const visW = cw / (mapW * viewport.zoom)
    const visH = ch / (mapH * viewport.zoom)

    ctx.strokeStyle = '#c8aa6e'
    ctx.lineWidth = 2
    ctx.fillStyle = 'rgba(200, 170, 110, 0.15)'
    ctx.fillRect(ox + visX * dw, oy + visY * dh, visW * dw, visH * dh)
    ctx.strokeRect(ox + visX * dw, oy + visY * dh, visW * dw, visH * dh)
  }, [mapImg, viewport])

  useEffect(() => {
    draw()
  }, [draw])

  const jumpTo = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    const parent = getStage()
    if (!canvas || !mapImg || !parent) return

    const rect = canvas.getBoundingClientRect()
    const scale = Math.min(MINI_W / mapImg.naturalWidth, MINI_H / mapImg.naturalHeight)
    const dw = mapImg.naturalWidth * scale
    const dh = mapImg.naturalHeight * scale
    const ox = (MINI_W - dw) / 2
    const oy = (MINI_H - dh) / 2

    const lx = clientX - rect.left - ox
    const ly = clientY - rect.top - oy
    const nx = Math.max(0, Math.min(1, lx / dw))
    const ny = Math.max(0, Math.min(1, ly / dh))

    const cw = parent.clientWidth
    const ch = parent.clientHeight
    const zoom = viewport.zoom

    setViewport({
      zoom,
      x: cw / 2 - nx * mapImg.naturalWidth * zoom,
      y: ch / 2 - ny * mapImg.naturalHeight * zoom,
    })
  }

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!mapImg || mapDimensions.w <= 1) return
    const factor = e.deltaY > 0 ? 0.85 : 1.15
    setZoomKeepingCenter(viewport.zoom * factor)
  }

  const onZoomPointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    e.preventDefault()
    e.stopPropagation()
    zoomDragRef.current = { startX: e.clientX, startZoom: viewport.zoom }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onZoomPointerMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!zoomDragRef.current) return
    e.preventDefault()
    const dx = e.clientX - zoomDragRef.current.startX
    setZoomKeepingCenter(zoomDragRef.current.startZoom + dx * ZOOM_DRAG_SENS)
  }

  const onZoomPointerUp = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!zoomDragRef.current) return
    zoomDragRef.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  return (
    <div className="map-minimap" onWheel={onWheel}>
      <canvas
        ref={canvasRef}
        width={MINI_W}
        height={MINI_H}
        className="map-minimap__canvas"
        onPointerDown={(e) => {
          setDragging(true)
          jumpTo(e.clientX, e.clientY)
        }}
        onPointerMove={(e) => dragging && jumpTo(e.clientX, e.clientY)}
        onPointerUp={() => setDragging(false)}
        onPointerLeave={() => setDragging(false)}
        onWheel={onWheel}
      />
      <span
        className="map-minimap__zoom"
        aria-hidden
        onPointerDown={onZoomPointerDown}
        onPointerMove={onZoomPointerMove}
        onPointerUp={onZoomPointerUp}
        onPointerCancel={onZoomPointerUp}
      >
        {Math.round(viewport.zoom * 100)}%
      </span>
    </div>
  )
}
