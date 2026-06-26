export const MAP_SRC = '/assets/minimap/grieta.png'
export const APP_ICON_SRC = '/app-icon.png'
export const MARKER_SIZE = 36
export const MIN_ZOOM = 0.4
export const MAX_ZOOM = 3
export const DEFAULT_ZOOM = 1
/** Zoom inicial al abrir / al detectar mapa HD (≈20%). */
export const INITIAL_ZOOM = 0.2

export type Tool = 'pan' | 'draw' | 'arrow' | 'place' | 'erase' | 'text'

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
  category: 'ping' | 'ward' | 'objective' | 'champion' | 'player' | 'enemy' | 'minion' | 'other'
  /** Jugador del pool de equipo */
  playerId?: string
  playerName?: string
  playerRole?: string
  /** Slot del equipo enemigo (dock inferior) */
  enemySlotId?: string
  enemyLabel?: string
  minionSide?: TeamSide
  championId?: string
  championName?: string
  authorId?: string
}

export interface DrawingStroke {
  id: string
  type: 'freehand' | 'arrow'
  points: MapPoint[]
  color: string
  width: number
  authorId?: string
}

export interface MapTextBox {
  id: string
  /** Esquina superior izquierda normalizada 0–1 */
  x: number
  y: number
  width: number
  height: number
  text: string
  color: string
  authorId?: string
}

export interface Jugada {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  viewport: Viewport
  markers: MapMarker[]
  strokes: DrawingStroke[]
  textBoxes: MapTextBox[]
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

export interface EnemySlot {
  id: string
  label: string
  role: string
  championId: string | null
}

export const ENEMY_TEAM_SIZE = 7
export const ENEMY_SLOT_ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support', 'Sub', 'Sub'] as const

export const MINION_BLUE_ICON = '/assets/minimap/minions/blue.webp'
export const MINION_RED_ICON = '/assets/minimap/minions/red.webp'

export interface QuickAsset {
  id: string
  label: string
  path: string
  category: MapMarker['category']
}

export function createId() {
  return crypto.randomUUID()
}

export function defaultViewport(): Viewport {
  return { x: 0, y: 0, zoom: DEFAULT_ZOOM }
}

/** Viewport es local por cliente — no se sincroniza entre usuarios. */
export function jugadaForSync(jugada: Jugada): Jugada {
  return { ...jugada, viewport: defaultViewport() }
}

export function mergeRemoteJugada(local: Jugada | undefined, remote: Jugada): Jugada {
  const merged = { ...remote, viewport: local?.viewport ?? defaultViewport() }
  return normalizeJugada(merged)
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
    textBoxes: [],
  }
}

export function normalizeJugada(j: Jugada): Jugada {
  return { ...j, textBoxes: j.textBoxes ?? [] }
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

export function defaultEnemyTeam(): EnemySlot[] {
  return ENEMY_SLOT_ROLES.map((role, i) => ({
    id: createId(),
    label: `Enemigo ${i + 1}`,
    role,
    championId: null,
  }))
}

export function normalizeEnemyTeam(slots: EnemySlot[]): EnemySlot[] {
  const normalized = [...slots]
  while (normalized.length < ENEMY_TEAM_SIZE) {
    const i = normalized.length
    normalized.push({
      id: createId(),
      label: `Enemigo ${i + 1}`,
      role: ENEMY_SLOT_ROLES[i] ?? 'Sub',
      championId: null,
    })
  }
  return normalized.slice(0, ENEMY_TEAM_SIZE).map((s, i) => ({
    ...s,
    role: ENEMY_SLOT_ROLES[i] ?? s.role,
    label: s.label || `Enemigo ${i + 1}`,
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
