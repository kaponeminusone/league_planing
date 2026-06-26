import type { Jugada, TeamMember, Viewport } from '../types'

export interface PresenceUser {
  clientId: string
  userName: string
  activeId: string | null
}

export interface PeerCursor {
  clientId: string
  userName: string
  activeId: string
  x: number
  y: number
  at: number
}

export interface RoomState {
  jugadas: Jugada[]
  activeId: string | null
  team: TeamMember[]
  lastEditBy: string | null
  lastEditAt: string | null
  lastEditAction: string | null
}

export type SyncStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export type ServerMessage =
  | { type: 'init'; state: RoomState; users: PresenceUser[] }
  | { type: 'presence'; users: PresenceUser[] }
  | { type: 'jugada'; jugada: Jugada; by: string; at: string; action?: string; clientId: string }
  | {
      type: 'jugadas'
      jugadas: Jugada[]
      activeId: string | null
      by: string
      at: string
      action?: string
      clientId: string
    }
  | { type: 'active'; activeId: string; by: string; at: string; clientId: string }
  | { type: 'team'; team: TeamMember[]; by: string; at: string; clientId: string }
  | {
      type: 'activity'
      userName: string
      action: string
      at: string
      clientId: string
    }
  | { type: 'cursors'; cursors: PeerCursor[] }
  | {
      type: 'viewport'
      jugadaId: string
      viewport: Viewport
      by: string
      clientId: string
    }

export type ClientMessage =
  | {
      type: 'join'
      clientId: string
      userName: string
      activeId?: string
      state?: { jugadas: Jugada[]; activeId: string; team: TeamMember[] }
    }
  | { type: 'set-user'; userName: string }
  | { type: 'patch-jugada'; jugada: Jugada; action?: string }
  | { type: 'set-jugadas'; jugadas: Jugada[]; activeId: string; action?: string }
  | { type: 'set-active'; activeId: string }
  | { type: 'set-team'; team: TeamMember[] }
  | { type: 'activity'; action: string }
  | { type: 'cursor'; activeId: string; x: number; y: number }
  | { type: 'viewport'; jugadaId: string; viewport: Viewport }

export function getWsUrl(): string {
  const env = import.meta.env.VITE_WS_URL as string | undefined
  if (env) return env
  if (import.meta.env.PROD) {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${location.host}`
  }
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${location.hostname}:3001`
}

const CLIENT_ID_KEY = 'lol-planning-client-id'
const USER_NAME_KEY = 'lol-planning-user-name'

export function loadClientId(): string {
  let id = localStorage.getItem(CLIENT_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(CLIENT_ID_KEY, id)
  }
  return id
}

export function loadUserName(): string {
  return localStorage.getItem(USER_NAME_KEY) ?? 'user'
}

export function saveUserName(name: string) {
  localStorage.setItem(USER_NAME_KEY, name)
}
