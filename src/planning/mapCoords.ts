import type { MapPoint, Viewport } from './types'
import { DEFAULT_ZOOM, INITIAL_ZOOM } from './types'

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

/** Zoom para que el mapa entero quepa en el contenedor. */
export function computeFitZoom(
  containerW: number,
  containerH: number,
  mapW: number,
  mapH: number,
  inset = 0.96,
): number {
  if (containerW <= 0 || containerH <= 0 || mapW <= 0 || mapH <= 0) return 1
  return Math.min(containerW / mapW, containerH / mapH) * inset
}

export interface ZoomRange {
  fit: number
  min: number
  max: number
}

/** Límites de zoom según tamaño del mapa y del stage. */
export function computeZoomRange(
  containerW: number,
  containerH: number,
  mapW: number,
  mapH: number,
): ZoomRange {
  const fit = computeFitZoom(containerW, containerH, mapW, mapH, 0.96)
  const min = Math.max(0.04, fit * 0.45)
  const max = Math.min(3, Math.max(INITIAL_ZOOM * 6, 1.5, fit * 12))
  return { fit, min, max }
}

export function clampMapZoom(
  zoom: number,
  containerW: number,
  containerH: number,
  mapW: number,
  mapH: number,
): number {
  const { min, max } = computeZoomRange(containerW, containerH, mapW, mapH)
  return Math.min(max, Math.max(min, zoom))
}

export function fitMapViewport(
  containerW: number,
  containerH: number,
  mapW: number,
  mapH: number,
): Viewport {
  const zoom = computeFitZoom(containerW, containerH, mapW, mapH, 0.96)
  const scaledW = mapW * zoom
  const scaledH = mapH * zoom
  return {
    x: (containerW - scaledW) / 2,
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

export function initialMapViewport(
  containerW: number,
  containerH: number,
  mapW: number,
  mapH: number,
  targetZoom = INITIAL_ZOOM,
): Viewport {
  const zoom = clampMapZoom(targetZoom, containerW, containerH, mapW, mapH)
  return centerViewport(containerW, containerH, mapW, mapH, zoom)
}

export function isDefaultViewport(v: Viewport): boolean {
  return v.x === 0 && v.y === 0 && v.zoom === DEFAULT_ZOOM
}

/** Viewport guardado incompatible con el mapa actual (p. ej. zoom 1 en grieta HD). */
export function viewportNeedsInitialFit(
  viewport: Viewport,
  containerW: number,
  containerH: number,
  mapW: number,
  mapH: number,
): boolean {
  if (isDefaultViewport(viewport)) return true
  if (containerW <= 0 || containerH <= 0 || mapW <= 0 || mapH <= 0) return false
  const visW = containerW / (mapW * viewport.zoom)
  return visW < 0.18 || viewport.zoom >= 0.9
}
