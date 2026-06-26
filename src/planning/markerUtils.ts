import type { MapMarker, MapPoint, Viewport } from './types'
import { mapToScreen } from './mapCoords'

export function hitMarker(
  markers: MapMarker[],
  clientX: number,
  clientY: number,
  viewport: Viewport,
  mapW: number,
  mapH: number,
  rect: DOMRect,
  radius = 20,
): MapMarker | null {
  for (let i = markers.length - 1; i >= 0; i--) {
    const m = markers[i]
    const s = mapToScreen(m.position, viewport, mapW, mapH)
    const dx = clientX - rect.left - s.x
    const dy = clientY - rect.top - s.y
    if (Math.hypot(dx, dy) < radius) return m
  }
  return null
}

export function parseTimerInput(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  if (t.includes(':')) {
    const [m, s] = t.split(':')
    const mm = Number(m)
    const ss = Number(s)
    if (Number.isNaN(mm) || Number.isNaN(ss)) return null
    return mm * 60 + ss
  }
  const n = Number(t)
  return Number.isNaN(n) ? null : n
}

export function focusViewportOnPoint(
  point: MapPoint,
  containerW: number,
  containerH: number,
  mapW: number,
  mapH: number,
  zoom = 1.65,
): Viewport {
  return {
    zoom,
    x: containerW * 0.38 - point.x * mapW * zoom,
    y: containerH / 2 - point.y * mapH * zoom,
  }
}
