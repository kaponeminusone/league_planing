export const PLAYER_DRAG_MIME = 'application/x-lol-player'
export const ENEMY_DRAG_MIME = 'application/x-lol-enemy'
export const MINION_DRAG_MIME = 'application/x-lol-minion'

export interface PlayerDragPayload {
  memberId: string
  memberName: string
  memberRole: string
  championId: string
  championName: string
  championIcon: string
}

export function encodePlayerDrag(payload: PlayerDragPayload): string {
  return JSON.stringify(payload)
}

export function decodePlayerDrag(raw: string): PlayerDragPayload | null {
  try {
    const data = JSON.parse(raw) as PlayerDragPayload
    if (!data.memberId || !data.championId || !data.championIcon) return null
    return data
  } catch {
    return null
  }
}

export interface EnemyDragPayload {
  slotId: string
  slotLabel: string
  memberRole: string
  championId: string
  championName: string
  championIcon: string
}

export interface MinionDragPayload {
  side: 'blue' | 'red'
  icon: string
  label: string
}

export function encodeEnemyDrag(payload: EnemyDragPayload): string {
  return JSON.stringify(payload)
}

export function decodeEnemyDrag(raw: string): EnemyDragPayload | null {
  try {
    const data = JSON.parse(raw) as EnemyDragPayload
    if (!data.slotId || !data.championId || !data.championIcon) return null
    return data
  } catch {
    return null
  }
}

export function encodeMinionDrag(payload: MinionDragPayload): string {
  return JSON.stringify(payload)
}

export function decodeMinionDrag(raw: string): MinionDragPayload | null {
  try {
    const data = JSON.parse(raw) as MinionDragPayload
    if (!data.side || !data.icon) return null
    return data
  } catch {
    return null
  }
}

export const MAP_DRAG_MIMES = [PLAYER_DRAG_MIME, ENEMY_DRAG_MIME, MINION_DRAG_MIME] as const

export function acceptsMapDrag(types: readonly string[]): boolean {
  return MAP_DRAG_MIMES.some((m) => types.includes(m))
}
