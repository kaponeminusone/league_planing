import type { MapPoint, MapTextBox, Viewport } from './types'
import { mapToScreen } from './mapCoords'

export const MIN_TEXT_BOX_NORM = 0.018

export function normalizeTextRect(from: MapPoint, to: MapPoint) {
  const x = Math.min(from.x, to.x)
  const y = Math.min(from.y, to.y)
  const width = Math.abs(to.x - from.x)
  const height = Math.abs(to.y - from.y)
  return { x, y, width, height }
}

export function findTextBoxAt(
  boxes: MapTextBox[],
  clientX: number,
  clientY: number,
  viewport: Viewport,
  mapW: number,
  mapH: number,
  rect: DOMRect,
): MapTextBox | null {
  const px = clientX - rect.left
  const py = clientY - rect.top

  for (let i = boxes.length - 1; i >= 0; i--) {
    const box = boxes[i]
    const topLeft = mapToScreen({ x: box.x, y: box.y }, viewport, mapW, mapH)
    const screenW = box.width * mapW * viewport.zoom
    const screenH = box.height * mapH * viewport.zoom
    if (px >= topLeft.x && px <= topLeft.x + screenW && py >= topLeft.y && py <= topLeft.y + screenH) {
      return box
    }
  }
  return null
}
