import type { DrawingStroke, Viewport } from './types'
import { mapToScreen } from './mapCoords'

function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * dx + (py - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function strokeHitAt(
  stroke: DrawingStroke,
  clientX: number,
  clientY: number,
  viewport: Viewport,
  mapW: number,
  mapH: number,
  rect: DOMRect,
  threshold: number,
): boolean {
  const px = clientX - rect.left
  const py = clientY - rect.top
  const pts = stroke.points
  if (!pts.length) return false

  if (pts.length === 1) {
    const s = mapToScreen(pts[0], viewport, mapW, mapH)
    return Math.hypot(px - s.x, py - s.y) < threshold
  }

  for (let i = 0; i < pts.length - 1; i++) {
    const a = mapToScreen(pts[i], viewport, mapW, mapH)
    const b = mapToScreen(pts[i + 1], viewport, mapW, mapH)
    const hitWidth = Math.max(threshold, stroke.width * viewport.zoom * 0.6 + 8)
    if (distToSegment(px, py, a.x, a.y, b.x, b.y) < hitWidth) return true
  }
  return false
}

/** Devuelve el trazo superior bajo el cursor (el más reciente). */
export function findStrokeAt(
  strokes: DrawingStroke[],
  clientX: number,
  clientY: number,
  viewport: Viewport,
  mapW: number,
  mapH: number,
  rect: DOMRect,
  threshold = 14,
): DrawingStroke | null {
  for (let i = strokes.length - 1; i >= 0; i--) {
    if (strokeHitAt(strokes[i], clientX, clientY, viewport, mapW, mapH, rect, threshold)) {
      return strokes[i]
    }
  }
  return null
}
