export const PLAYER_DRAG_MIME = 'application/x-lol-player'

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
