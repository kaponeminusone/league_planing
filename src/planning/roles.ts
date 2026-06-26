import type { Manifest } from '../types'
import { IN_GAME_ROLES, POOL_ROLES } from './types'

export const ROLE_ASSET_IDS: Record<string, string> = {
  Top: 'top',
  Jungle: 'jungle',
  Mid: 'mid',
  ADC: 'adc',
  Support: 'support',
}

export function roleIconPath(manifest: Manifest | undefined, role: string): string {
  const assetId = ROLE_ASSET_IDS[role] ?? 'mid'
  const fromManifest = manifest?.roles?.find((r) => r.id === assetId)
  if (fromManifest) return fromManifest.path
  return `/assets/roles/${assetId}.png`
}

export function roleDisplayName(role: string): string {
  const map: Record<string, string> = {
    Top: 'TOP',
    Jungle: 'JUNGLA',
    Mid: 'MID',
    ADC: 'ADC',
    Support: 'SUPPORT',
    Coach: 'COACH',
    Sub: 'SUB',
  }
  return map[role] ?? role.toUpperCase()
}

export function cyclePoolRole(role: string): string {
  const idx = POOL_ROLES.indexOf(role as (typeof POOL_ROLES)[number])
  if (idx === -1) return POOL_ROLES[0]
  return POOL_ROLES[(idx + 1) % POOL_ROLES.length]
}

export function defaultPickRole(memberRole: string): string {
  return IN_GAME_ROLES.includes(memberRole as (typeof IN_GAME_ROLES)[number])
    ? memberRole
    : 'Mid'
}
