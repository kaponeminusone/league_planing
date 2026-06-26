import type { MapPoint, Viewport } from './types'

export function screenToMap(
  screenX: number,
  screenY: number,
  viewport: Viewport,
  mapWidth: number,
  mapHeight: number,
  containerRect: DOMRect,
): MapPoint {
  const localX = screenX - containerRect.left
  const localY = screenY - containerRect.top
  const mapX = (localX - viewport.x) / (mapWidth * viewport.zoom)
  const mapY = (localY - viewport.y) / (mapHeight * viewport.zoom)
  return {
    x: Math.max(0, Math.min(1, mapX)),
    y: Math.max(0, Math.min(1, mapY)),
  }
}

export function mapToScreen(
  point: MapPoint,
  viewport: Viewport,
  mapWidth: number,
  mapHeight: number,
): { x: number; y: number } {
  return {
    x: point.x * mapWidth * viewport.zoom + viewport.x,
    y: point.y * mapHeight * viewport.zoom + viewport.y,
  }
}

export function fitMapViewport(
  containerW: number,
  containerH: number,
  mapW: number,
  mapH: number,
  horizontalBias = 0.12,
): Viewport {
  const zoom = Math.min(containerW / mapW, containerH / mapH) * 0.98
  const scaledW = mapW * zoom
  const scaledH = mapH * zoom
  return {
    x: (containerW - scaledW) * horizontalBias,
    y: (containerH - scaledH) / 2,
    zoom,
  }
}

export function centerViewport(
  containerW: number,
  containerH: number,
  mapW: number,
  mapH: number,
  zoom: number,
): Viewport {
  return {
    x: (containerW - mapW * zoom) / 2,
    y: (containerH - mapH * zoom) / 2,
    zoom,
  }
}
