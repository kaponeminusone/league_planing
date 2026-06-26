import type { EnemySlot, Jugada, TeamMember, Viewport } from './types'

const JUGADAS_KEY = 'lol-planning-jugadas'
const TEAM_KEY = 'lol-planning-team'
const ENEMY_TEAM_KEY = 'lol-planning-enemy-team'
const ACTIVE_KEY = 'lol-planning-active-id'

export function loadJugadas(): Jugada[] {
  try {
    const raw = localStorage.getItem(JUGADAS_KEY)
    return raw ? (JSON.parse(raw) as Jugada[]) : []
  } catch {
    return []
  }
}

export function saveJugadas(jugadas: Jugada[]) {
  localStorage.setItem(JUGADAS_KEY, JSON.stringify(jugadas))
}

export function loadActiveJugadaId(): string | null {
  return localStorage.getItem(ACTIVE_KEY)
}

export function saveActiveJugadaId(id: string) {
  localStorage.setItem(ACTIVE_KEY, id)
}

export function loadTeam(): TeamMember[] | null {
  try {
    const raw = localStorage.getItem(TEAM_KEY)
    return raw ? (JSON.parse(raw) as TeamMember[]) : null
  } catch {
    return null
  }
}

export function saveTeam(team: TeamMember[]) {
  localStorage.setItem(TEAM_KEY, JSON.stringify(team))
}

export function loadEnemyTeam(): EnemySlot[] | null {
  try {
    const raw = localStorage.getItem(ENEMY_TEAM_KEY)
    return raw ? (JSON.parse(raw) as EnemySlot[]) : null
  } catch {
    return null
  }
}

export function saveEnemyTeam(slots: EnemySlot[]) {
  localStorage.setItem(ENEMY_TEAM_KEY, JSON.stringify(slots))
}

export function clampViewport(v: Viewport): Viewport {
  return {
    x: v.x,
    y: v.y,
    zoom: Math.min(3, Math.max(0.4, v.zoom)),
  }
}
