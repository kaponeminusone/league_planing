export interface Spell {
  key: string
  name: string
  description: string
  cooldown: number[]
  cost: number[]
  range: number[]
  path: string
}

export interface Champion {
  id: string
  key: string
  name: string
  title: string
  tags: string[]
  partype: string
  lore: string
  icon: string
  splash: string
  passive: { name: string; description: string; path: string } | null
  spells: Spell[]
}

export interface Item {
  id: string
  name: string
  description: string
  gold: { base: number; total: number; sell: number; purchasable: boolean }
  stats: Record<string, number>
  tags: string[]
  into?: string[]
  from?: string[]
  icon: string
}

export interface Rune {
  id: number
  key: string
  name: string
  shortDesc: string
  longDesc: string
  icon: string
}

export interface RuneTree {
  id: number
  key: string
  name: string
  icon: string
  slots: Rune[][]
}

export interface SummonerSpell {
  id: string
  name: string
  description: string
  cooldown: number[]
  icon: string
}

export interface AssetRef {
  name: string
  path: string
}

export interface RoleIcon {
  id: string
  label: string
  path: string
}

export interface Manifest {
  version: string
  cdragon: string
  language: string
  downloadedAt: string
  sources: { dataDragon: string; communityDragon: string }
  champions: Champion[]
  items: Item[]
  runes: RuneTree[]
  summonerSpells: SummonerSpell[]
  roles: RoleIcon[]
  minimap: {
    pings: AssetRef[]
    icons: AssetRef[]
    maps: AssetRef[]
  }
  objectives: AssetRef[]
  wards: AssetRef[]
}

export type SectionId =
  | 'overview'
  | 'champions'
  | 'items'
  | 'runes'
  | 'summoners'
  | 'minimap'
  | 'objectives'
  | 'wards'
