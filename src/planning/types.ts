export const MAP_SRC = '/assets/minimap/grieta.png'
export const MARKER_SIZE = 36
export const MIN_ZOOM = 0.4
export const MAX_ZOOM = 3
export const DEFAULT_ZOOM = 1

export type Tool = 'pan' | 'draw' | 'arrow' | 'place' | 'erase'

export interface Viewport {
  x: number
  y: number
  zoom: number
}

/** Posición normalizada 0–1 sobre el mapa */
export interface MapPoint {
  x: number
  y: number
}

export interface MapMarker {
  id: string
  assetPath: string
  label: string
  position: MapPoint
  timerSeconds?: number
  category: 'ping' | 'ward' | 'objective' | 'champion' | 'player' | 'other'
  /** Jugador del pool de equipo */
  playerId?: string
  playerName?: string
  playerRole?: string
  championId?: string
  championName?: string
}

export interface DrawingStroke {
  id: string
  type: 'freehand' | 'arrow'
  points: MapPoint[]
  color: string
  width: number
}

export interface Jugada {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  viewport: Viewport
  markers: MapMarker[]
  strokes: DrawingStroke[]
}

export type TeamSide = 'blue' | 'red' | 'none'

export const IN_GAME_ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'] as const
export const POOL_ROLES = [...IN_GAME_ROLES] as const

export interface PoolEntry {
  championId: string
  role: string
}

export interface TeamMember {
  id: string
  name: string
  role: string
  side: TeamSide
  pool: PoolEntry[]
}

export interface QuickAsset {
  id: string
  label: string
  path: string
  category: MapMarker['category']
}

export function createId() {
  return crypto.randomUUID()
}

export function createEmptyJugada(name = 'Nueva jugada'): Jugada {
  const now = new Date().toISOString()
  return {
    id: createId(),
    name,
    createdAt: now,
    updatedAt: now,
    viewport: { x: 0, y: 0, zoom: DEFAULT_ZOOM },
    markers: [],
    strokes: [],
  }
}

export function defaultTeam(): TeamMember[] {
  const roles = ['Top', 'Jungle', 'Mid', 'ADC', 'Support', 'Coach'] as const
  return Array.from({ length: 6 }, (_, i) => ({
    id: createId(),
    name: `Jugador ${i + 1}`,
    role: roles[i] ?? 'Sub',
    side: i < 5 ? ('blue' as TeamSide) : ('none' as TeamSide),
    pool: [],
  }))
}

/** Migra equipos guardados con el formato antiguo `championIds`. */
export function normalizeTeamMember(
  m: TeamMember & { championIds?: string[] },
): TeamMember {
  if (Array.isArray(m.pool)) {
    return { ...m, pool: m.pool }
  }
  const defaultRole = IN_GAME_ROLES.includes(m.role as (typeof IN_GAME_ROLES)[number])
    ? m.role
    : 'Mid'
  const pool = (m.championIds ?? []).map((championId) => ({
    championId,
    role: defaultRole,
  }))
  return { ...m, pool }
}

export function normalizeTeam(team: (TeamMember & { championIds?: string[] })[]): TeamMember[] {
  return team.map(normalizeTeamMember)
}

export function sideForRole(role: string, current?: TeamSide): TeamSide {
  if (role === 'Coach' || role === 'Sub') return 'none'
  if (IN_GAME_ROLES.includes(role as (typeof IN_GAME_ROLES)[number])) {
    return current && current !== 'none' ? current : 'blue'
  }
  return 'none'
}
