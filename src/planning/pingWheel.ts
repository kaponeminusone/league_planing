import type { Manifest } from '../types'

/** Orden horario desde arriba, igual que la rueda de pings de LoL. */
export const PING_WHEEL_SEGMENTS = [
  { assetKey: 'danger', label: 'Peligro' },
  { assetKey: 'push', label: 'Empujar' },
  { assetKey: 'onmyway', label: 'Voy' },
  { assetKey: 'assist', label: 'Asistencia' },
  { assetKey: 'getback', label: 'Retirada' },
  { assetKey: 'allin', label: 'All-in' },
  { assetKey: 'missing', label: 'Desaparecido' },
  { assetKey: 'enemyvision', label: 'Visión enemiga' },
] as const

export const PING_WHEEL_DEAD_ZONE = 20
export const PING_WHEEL_SIZE = 200
export const PING_WHEEL_ICON_RADIUS = 68

/** Ángulo en grados matemáticos (0° = derecha, -90° = arriba). */
export function segmentAngle(index: number): number {
  return index * 45 - 90
}

export function segmentPosition(index: number, center: number, radius: number) {
  const rad = (segmentAngle(index) * Math.PI) / 180
  return {
    x: center + radius * Math.cos(rad),
    y: center + radius * Math.sin(rad),
  }
}

export interface PingWheelOption {
  assetKey: string
  label: string
  path: string
}

export function buildPingWheelOptions(manifest: Manifest): PingWheelOption[] {
  const byName = new Map(manifest.minimap.pings.map((p) => [p.name, p.path]))
  return PING_WHEEL_SEGMENTS.map((seg) => ({
    assetKey: seg.assetKey,
    label: seg.label,
    path: byName.get(seg.assetKey) ?? '',
  }))
}

/** Índice 0–7 según dirección del ratón (horario desde arriba); null en el centro. */
export function pickPingWheelSegment(dx: number, dy: number): number | null {
  const dist = Math.hypot(dx, dy)
  if (dist < PING_WHEEL_DEAD_ZONE) return null

  let angle = (Math.atan2(dx, -dy) * 180) / Math.PI
  if (angle < 0) angle += 360

  return Math.floor((angle + 22.5) / 45) % 8
}

/** Sector SVG para resaltar la opción activa. */
export function segmentWedgePath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  index: number,
): string {
  const half = 22.5
  const start = ((segmentAngle(index) - half) * Math.PI) / 180
  const end = ((segmentAngle(index) + half) * Math.PI) / 180
  const x1 = cx + outerR * Math.cos(start)
  const y1 = cy + outerR * Math.sin(start)
  const x2 = cx + outerR * Math.cos(end)
  const y2 = cy + outerR * Math.sin(end)
  const xi1 = cx + innerR * Math.cos(start)
  const yi1 = cy + innerR * Math.sin(start)
  const xi2 = cx + innerR * Math.cos(end)
  const yi2 = cy + innerR * Math.sin(end)
  return [
    `M ${xi1} ${yi1}`,
    `L ${x1} ${y1}`,
    `A ${outerR} ${outerR} 0 0 1 ${x2} ${y2}`,
    `L ${xi2} ${yi2}`,
    `A ${innerR} ${innerR} 0 0 0 ${xi1} ${yi1}`,
    'Z',
  ].join(' ')
}
