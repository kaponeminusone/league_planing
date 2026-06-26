/**
 * Descarga assets oficiales de Data Dragon (Riot) y CommunityDragon.
 * No hace scraping de sitios de terceros (OP.GG, Wiki, etc.).
 *
 * Uso:
 *   npm run download              — metadata + iconos + minimap + splashes base
 *   npm run download:full         — incluye todas las splash arts de skins
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const ASSETS = path.join(ROOT, 'public', 'assets')
const DATA_DIR = path.join(ROOT, 'public', 'data')

const DDRAGON_API = 'https://ddragon.leagueoflegends.com'
const DDRAGON_CDN = `${DDRAGON_API}/cdn`
const CDRAGON = 'https://raw.communitydragon.org/latest'

const LANG = 'en_US'
const FULL_SPLASHES = process.argv.includes('--full-splashes')

const stats = { downloaded: 0, skipped: 0, failed: 0 }

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  const text = await res.text()
  if (text.trimStart().startsWith('<')) {
    throw new Error(`Respuesta HTML en lugar de JSON: ${url}`)
  }
  return JSON.parse(text)
}

async function downloadFile(url, dest) {
  await fs.mkdir(path.dirname(dest), { recursive: true })
  try {
    await fs.access(dest)
    stats.skipped++
    return false
  } catch {
    /* file missing */
  }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(120_000) })
    if (!res.ok) {
      stats.failed++
      console.warn(`  ✗ ${res.status} ${url}`)
      return false
    }
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 50) {
      stats.failed++
      return false
    }
    await fs.writeFile(dest, buf)
    stats.downloaded++
    return true
  } catch (err) {
    stats.failed++
    console.warn(`  ✗ ${url}: ${err.message}`)
    return false
  }
}

async function getLatestVersion() {
  const versions = await fetchJson(`${DDRAGON_API}/api/versions.json`)
  return versions[0]
}

async function downloadDdragonJson(version) {
  const files = [
    'champion.json',
    'item.json',
    'summoner.json',
    'runesReforged.json',
    'profileicon.json',
    'map.json',
  ]

  const json = {}
  for (const file of files) {
    const url = `${DDRAGON_CDN}/${version}/data/${LANG}/${file}`
    console.log(`  JSON: ${file}`)
    json[file.replace('.json', '')] = await fetchJson(url)
    await fs.writeFile(
      path.join(DATA_DIR, 'ddragon', file),
      JSON.stringify(json[file.replace('.json', '')], null, 2),
    )
  }
  return json
}

async function downloadChampionAssets(version, championList, championFull) {
  console.log('\n📦 Campeones (Data Dragon)...')
  const champions = []

  for (const champ of Object.values(championList.data)) {
    const id = champ.id
    const key = champ.key
    const folder = path.join(ASSETS, 'champions', id)

    const iconDest = path.join(folder, 'icon.png')
    await downloadFile(
      `${DDRAGON_CDN}/${version}/img/champion/${champ.image.full}`,
      iconDest,
    )

    const splashDest = path.join(folder, 'splash.jpg')
    await downloadFile(
      `${DDRAGON_API}/cdn/img/champion/splash/${id}_0.jpg`,
      splashDest,
    )

    const spellsDir = path.join(folder, 'spells')
    const spellFiles = []

    let fullData = championFull[id]
    if (!fullData) {
      try {
        fullData = await fetchJson(
          `${DDRAGON_CDN}/${version}/data/${LANG}/champion/${id}.json`,
        )
        fullData = fullData.data[id]
      } catch {
        fullData = champ
      }
    }

    if (fullData.passive?.image?.full) {
      const passiveDest = path.join(folder, 'passive.png')
      await downloadFile(
        `${DDRAGON_CDN}/${version}/img/passive/${fullData.passive.image.full}`,
        passiveDest,
      )
    }

    const spellKeys = ['q', 'w', 'e', 'r']
    for (let i = 0; i < (fullData.spells?.length ?? 0); i++) {
      const spell = fullData.spells[i]
      const spellKey = spellKeys[i] ?? `spell${i}`
      const spellDest = path.join(spellsDir, `${spellKey}.png`)
      await downloadFile(
        `${DDRAGON_CDN}/${version}/img/spell/${spell.image.full}`,
        spellDest,
      )
      spellFiles.push({
        key: spellKey,
        name: spell.name,
        description: spell.description,
        cooldown: spell.cooldown,
        cost: spell.cost,
        range: spell.range,
        path: `/assets/champions/${id}/spells/${spellKey}.png`,
      })
    }

    if (FULL_SPLASHES) {
      const cdragonSplashBase = `${CDRAGON}/plugins/rcp-be-lol-game-data/global/default/v1/champion-splashes/${key}`
      for (const skin of fullData.skins ?? [{ num: 0 }]) {
        const skinNum = String(skin.num).padStart(3, '0')
        await downloadFile(
          `${cdragonSplashBase}/${key}${skinNum}.jpg`,
          path.join(folder, 'splashes', `skin_${skin.num}.jpg`),
        )
      }
    }

    champions.push({
      id,
      key,
      name: champ.name,
      title: champ.title,
      tags: champ.tags,
      partype: champ.partype,
      lore: fullData.lore ?? '',
      icon: `/assets/champions/${id}/icon.png`,
      splash: `/assets/champions/${id}/splash.jpg`,
      passive: fullData.passive
        ? {
            name: fullData.passive.name,
            description: fullData.passive.description,
            path: `/assets/champions/${id}/passive.png`,
          }
        : null,
      spells: spellFiles,
    })
  }

  return champions
}

async function downloadItems(version, itemData) {
  console.log('\n📦 Items (Data Dragon)...')
  const items = []

  for (const [itemId, item] of Object.entries(itemData.data)) {
    if (!item.image?.full || itemId === '0') continue

    const safeName = item.name.replace(/[<>:"/\\|?*]/g, '_')
    const iconDest = path.join(ASSETS, 'items', `${itemId}.png`)
    await downloadFile(
      `${DDRAGON_CDN}/${version}/img/item/${item.image.full}`,
      iconDest,
    )

    items.push({
      id: itemId,
      name: item.name,
      description: item.description,
      gold: item.gold,
      stats: item.stats,
      tags: item.tags,
      into: item.into,
      from: item.from,
      icon: `/assets/items/${itemId}.png`,
    })
  }

  await fs.writeFile(
    path.join(DATA_DIR, 'items.json'),
    JSON.stringify(items, null, 2),
  )
  return items
}

async function downloadRunes(runesData) {
  console.log('\n📦 Runas (Data Dragon)...')
  const runes = []

  for (const tree of runesData) {
    const treeIcon = path.join(ASSETS, 'runes', `tree_${tree.id}.png`)
    await downloadFile(`${DDRAGON_CDN}/img/${tree.icon}`, treeIcon)

    const treeEntry = {
      id: tree.id,
      key: tree.key,
      name: tree.name,
      icon: `/assets/runes/tree_${tree.id}.png`,
      slots: [],
    }

    for (const slot of tree.slots) {
      const slotRunes = []
      for (const rune of slot.runes) {
        const runeDest = path.join(ASSETS, 'runes', `${rune.id}.png`)
        await downloadFile(`${DDRAGON_CDN}/img/${rune.icon}`, runeDest)
        slotRunes.push({
          id: rune.id,
          key: rune.key,
          name: rune.name,
          shortDesc: rune.shortDesc,
          longDesc: rune.longDesc,
          icon: `/assets/runes/${rune.id}.png`,
        })
      }
      treeEntry.slots.push(slotRunes)
    }
    runes.push(treeEntry)
  }

  return runes
}

async function downloadSummonerSpells(version, summonerData) {
  console.log('\n📦 Summoner Spells (Data Dragon)...')
  const spells = []

  for (const spell of Object.values(summonerData.data)) {
    const dest = path.join(ASSETS, 'summoner_spells', `${spell.id}.png`)
    await downloadFile(
      `${DDRAGON_CDN}/${version}/img/spell/${spell.image.full}`,
      dest,
    )
    spells.push({
      id: spell.id,
      name: spell.name,
      description: spell.description,
      cooldown: spell.cooldown,
      icon: `/assets/summoner_spells/${spell.id}.png`,
    })
  }

  return spells
}

async function copyMapImage() {
  console.log('\n📦 Mapa principal (grieta)...')
  await fs.mkdir(path.join(ASSETS, 'minimap'), { recursive: true })

  const pngDest = path.join(ASSETS, 'minimap', 'grieta.png')
  const webpDest = path.join(ASSETS, 'minimap', 'grieta.webp')

  const pngCandidates = [
    path.join(ROOT, 'mover', 'grieta_v3.png'),
    path.join(ROOT, 'mover', 'grieta.png'),
  ]

  for (const src of pngCandidates) {
    try {
      await fs.access(src)
      await fs.copyFile(src, pngDest)
      console.log(`  ✓ grieta.png (desde ${path.relative(ROOT, src)})`)
      return true
    } catch {
      /* try next */
    }
  }

  const webpCandidates = [path.join(ROOT, 'mover', 'grieta_v2.webp')]

  for (const src of webpCandidates) {
    try {
      await fs.access(src)
      await fs.copyFile(src, webpDest)
      console.log(`  ✓ grieta.webp (desde ${path.relative(ROOT, src)})`)
      return true
    } catch {
      /* try next */
    }
  }

  console.warn('  ⚠ mover/grieta_v3.png no encontrado; usa map_full como respaldo')
  try {
    await fs.access(path.join(ASSETS, 'minimap', 'map_full.png'))
    await fs.copyFile(path.join(ASSETS, 'minimap', 'map_full.png'), pngDest)
    console.log('  ✓ grieta.png (copia de map_full.png)')
    return true
  } catch {
    return false
  }
}

async function copyShareImage() {
  const dest = path.join(ROOT, 'public', 'og-image.png')
  const candidates = [
    path.join(ROOT, 'mover', 'Conclave Cromatico.png'),
    path.join(ROOT, 'mover', 'conclave-cromatico.png'),
  ]

  for (const src of candidates) {
    try {
      await fs.access(src)
      await fs.copyFile(src, dest)
      console.log(`  ✓ og-image.png (desde ${path.relative(ROOT, src)})`)
      return
    } catch {
      /* try next */
    }
  }

  try {
    await fs.access(dest)
    console.log('  · og-image.png (existente en public/)')
  } catch {
    console.warn('  ⚠ mover/Conclave Cromatico.png no encontrado')
  }
}

async function copyAppIcon() {
  const dest = path.join(ROOT, 'public', 'app-icon.png')
  const candidates = [
    path.join(ROOT, 'mover', 'icon_v2.png'),
    path.join(ROOT, 'mover', 'icon.png'),
  ]

  for (const src of candidates) {
    try {
      await fs.access(src)
      await fs.copyFile(src, dest)
      console.log(`  ✓ app-icon.png (desde ${path.relative(ROOT, src)})`)
      return
    } catch {
      /* try next */
    }
  }

  console.warn('  ⚠ mover/icon_v2.png no encontrado')
}

async function copyBootIcon() {
  await copyAppIcon()
  const src = path.join(ROOT, 'mover', 'League_of_Legends_icon.svg')
  const dest = path.join(ROOT, 'public', 'lol-icon.svg')
  try {
    await fs.access(src)
    await fs.copyFile(src, dest)
    console.log('  ✓ lol-icon.svg (icono boot legacy)')
  } catch {
    /* opcional */
  }
}

async function copyMoverMinions() {
  console.log('  Minions (mover/)...')
  const pairs = [
    { src: 'blue.webp', dest: 'blue.webp' },
    { src: 'red.webp', dest: 'red.webp' },
  ]
  const destDir = path.join(ASSETS, 'minimap', 'minions')
  await fs.mkdir(destDir, { recursive: true })

  for (const { src, dest } of pairs) {
    const from = path.join(ROOT, 'mover', src)
    const to = path.join(destDir, dest)
    try {
      await fs.access(from)
      await fs.copyFile(from, to)
      console.log(`  ✓ ${dest} (desde mover/${src})`)
    } catch {
      console.warn(`  ⚠ mover/${src} no encontrado`)
    }
  }
}

async function downloadMinimapAssets() {
  console.log('\n📦 Minimap & Pings (CommunityDragon)...')

  const pingFiles = [
    { name: 'danger', file: 'caution.png' },
    { name: 'missing', file: 'mia_new.png' },
    { name: 'assist', file: 'assist.png' },
    { name: 'onmyway', file: 'on_my_way_new.png' },
    { name: 'vision', file: 'need_ward.png' },
    { name: 'enemyvision', file: 'area_is_warded_small_red_new.png' },
    { name: 'push', file: 'push.png' },
    { name: 'allin', file: 'all_in.png' },
    { name: 'getback', file: 'get_back_small.png' },
  ]

  const pings = []
  for (const { name, file } of pingFiles) {
    const dest = path.join(ASSETS, 'minimap', 'pings', `${name}.png`)
    const url = `${CDRAGON}/game/assets/ux/minimap/pings/${file}`
    await downloadFile(url, dest)
    try {
      await fs.access(dest)
      pings.push({ name, path: `/assets/minimap/pings/${name}.png` })
    } catch {
      /* not available */
    }
  }

  const iconFiles = [
    'dragon.png',
    'baron.png',
    'riftherald.png',
    'tower.png',
    'inhibitor.png',
    'grub.png',
    'dragon_elder.png',
    'atakhan_r.png',
    'atakhan_v.png',
    'jungle_camp_1.png',
    'nexus.png',
  ]

  const icons = []
  for (const file of iconFiles) {
    const name = file.replace('.png', '')
    const dest = path.join(ASSETS, 'minimap', 'icons', file)
    await downloadFile(
      `${CDRAGON}/game/assets/ux/minimap/icons/${file}`,
      dest,
    )
    try {
      await fs.access(dest)
      icons.push({ name, path: `/assets/minimap/icons/${file}` })
    } catch {
      /* skip */
    }
  }

  const mapFiles = [
    { name: 'map_full', file: '2dlevelminimap_npe_1.png' },
    { name: 'map_zoom', file: '2dlevelminimap_base_baron1.png' },
    { name: 'map_atakhan', file: '2dlevelminimap_atakhan_top_sticker.png' },
  ]

  const maps = []
  for (const { name, file } of mapFiles) {
    const dest = path.join(ASSETS, 'minimap', `${name}.png`)
    await downloadFile(
      `${CDRAGON}/game/assets/maps/info/map11/${file}`,
      dest,
    )
    try {
      await fs.access(dest)
      maps.push({ name, path: `/assets/minimap/${name}.png` })
    } catch {
      /* skip */
    }
  }

  await copyMoverMinions()

  return { pings, icons, maps }
}

async function downloadObjectives() {
  console.log('\n📦 Objetivos (CommunityDragon)...')

  const objectives = [
    { name: 'elder_dragon', file: 'dragon_elder.png' },
    { name: 'baron', file: 'baron.png' },
    { name: 'herald', file: 'riftherald.png' },
    { name: 'dragon', file: 'dragon.png' },
    { name: 'grubs', file: 'grub.png' },
    { name: 'atakhan_r', file: 'atakhan_r.png' },
    { name: 'atakhan_v', file: 'atakhan_v.png' },
  ]

  const result = []
  const base = `${CDRAGON}/game/assets/ux/minimap/icons`
  for (const obj of objectives) {
    const dest = path.join(ASSETS, 'objectives', `${obj.name}.png`)
    await downloadFile(`${base}/${obj.file}`, dest)
    try {
      await fs.access(dest)
      result.push({ name: obj.name, path: `/assets/objectives/${obj.name}.png` })
    } catch {
      /* skip */
    }
  }

  return result
}

async function downloadRoleIcons() {
  console.log('\n📦 Roles / líneas (CommunityDragon)...')

  const base =
    `${CDRAGON}/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions`

  const roles = [
    { id: 'top', file: 'icon-position-top.png', label: 'Top' },
    { id: 'jungle', file: 'icon-position-jungle.png', label: 'Jungle' },
    { id: 'mid', file: 'icon-position-middle.png', label: 'Mid' },
    { id: 'adc', file: 'icon-position-bottom.png', label: 'ADC' },
    { id: 'support', file: 'icon-position-utility.png', label: 'Support' },
  ]

  const result = []
  for (const role of roles) {
    const dest = path.join(ASSETS, 'roles', `${role.id}.png`)
    await downloadFile(`${base}/${role.file}`, dest)
    try {
      await fs.access(dest)
      result.push({ id: role.id, label: role.label, path: `/assets/roles/${role.id}.png` })
    } catch {
      /* skip */
    }
  }

  return result
}

async function downloadWards() {
  console.log('\n📦 Wards (CommunityDragon)...')
  const wards = [
    { name: 'green_ward', file: 'minimap_ward_green_full.png' },
    { name: 'control_ward', file: 'minimap_ward_pink_friendly.png' },
    { name: 'blue_ward', file: 'minimap_ward_blue_full.png' },
    { name: 'enemy_ward', file: 'minimap_ward_green_enemy_new.png' },
  ]

  const result = []
  const base = `${CDRAGON}/game/assets/ux/minimap/icons`
  for (const { name, file } of wards) {
    const dest = path.join(ASSETS, 'wards', `${name}.png`)
    await downloadFile(`${base}/${file}`, dest)
    try {
      await fs.access(dest)
      result.push({ name, path: `/assets/wards/${name}.png` })
    } catch {
      /* skip */
    }
  }
  return result
}

async function main() {
  console.log('🏁 Descargando assets oficiales de LoL\n')
  console.log(`   Data Dragon + CommunityDragon`)
  console.log(`   Splashes completas: ${FULL_SPLASHES ? 'SÍ' : 'NO (usa --full-splashes)'}\n`)

  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.mkdir(path.join(DATA_DIR, 'ddragon'), { recursive: true })

  const version = await getLatestVersion()
  console.log(`📌 Patch Data Dragon: ${version}\n`)

  const ddragon = await downloadDdragonJson(version)

  const championFull = {}
  console.log('\n📦 Campeones detallados (Data Dragon)...')
  for (const champ of Object.values(ddragon.champion.data)) {
    try {
      const data = await fetchJson(
        `${DDRAGON_CDN}/${version}/data/${LANG}/champion/${champ.id}.json`,
      )
      championFull[champ.id] = data.data[champ.id]
    } catch {
      championFull[champ.id] = champ
    }
  }

  const [champions, items, runes, summonerSpells, minimap, objectives, wards, roles] =
    await Promise.all([
      downloadChampionAssets(version, ddragon.champion, championFull),
      downloadItems(version, ddragon.item),
      downloadRunes(ddragon.runesReforged),
      downloadSummonerSpells(version, ddragon.summoner),
      downloadMinimapAssets(),
      downloadObjectives(),
      downloadWards(),
      downloadRoleIcons(),
    ])

  await copyMapImage()
  await copyBootIcon()
  await copyShareImage()

  const manifest = {
    version,
    cdragon: 'latest',
    language: LANG,
    downloadedAt: new Date().toISOString(),
    sources: {
      dataDragon: DDRAGON_CDN,
      communityDragon: CDRAGON,
    },
    champions,
    items,
    runes,
    summonerSpells,
    minimap,
    objectives,
    wards,
    roles,
  }

  await fs.writeFile(
    path.join(DATA_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
  )

  console.log('\n✅ Descarga completada')
  console.log(`   Nuevos:    ${stats.downloaded}`)
  console.log(`   Existentes: ${stats.skipped}`)
  console.log(`   Fallidos:  ${stats.failed}`)
  console.log(`   Campeones: ${champions.length}`)
  console.log(`   Items:     ${items.length}`)
  console.log(`\n   Manifest: public/data/manifest.json`)
}

main().catch((err) => {
  console.error('❌ Error:', err)
  process.exit(1)
})
