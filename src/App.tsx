import { lazy, Suspense, useEffect, useState } from 'react'
import type { Manifest, SectionId } from './types'
import { Section } from './components/Section'
import { isBootCached } from './planning/planningBoot'
import './App.css'

const PlanningView = lazy(() =>
  import('./planning/PlanningView').then((m) => ({ default: m.PlanningView })),
)

const ChampionsSection = lazy(() => import('./sections/ChampionsSection'))
const ItemsSection = lazy(() => import('./sections/ItemsSection'))
const RunesSection = lazy(() => import('./sections/RunesSection'))
const SummonerSpellsSection = lazy(() => import('./sections/SummonerSpellsSection'))
const MinimapSection = lazy(() => import('./sections/MinimapSection'))
const ObjectivesSection = lazy(() => import('./sections/ObjectivesSection'))
const WardsSection = lazy(() => import('./sections/WardsSection'))

type AppView = 'planning' | 'assets'

const NAV: { id: SectionId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'champions', label: 'Champions' },
  { id: 'items', label: 'Items' },
  { id: 'runes', label: 'Runes' },
  { id: 'summoners', label: 'Summoner Spells' },
  { id: 'minimap', label: 'Minimap' },
  { id: 'objectives', label: 'Objectives' },
  { id: 'wards', label: 'Wards' },
]

function PlanningSuspenseFallback() {
  return null
}

function SectionFallback() {
  return <div className="loading-block">Cargando módulo…</div>
}

function AssetBrowser({ manifest }: { manifest: Manifest }) {
  const [active, setActive] = useState<SectionId>('overview')

  const totalAssets =
    manifest.champions.length * 7 +
    manifest.items.length +
    manifest.runes.reduce((a, t) => a + t.slots.flat().length, 0) +
    manifest.summonerSpells.length +
    manifest.minimap.pings.length +
    manifest.minimap.icons.length +
    manifest.minimap.maps.length +
    manifest.objectives.length +
    manifest.wards.length

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand__mark" src="/app-icon.png" alt="" width={40} height={40} draggable={false} />
          <div>
            <strong>League Planning</strong>
            <p className="muted">Assets · Patch {manifest.version}</p>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={active === item.id ? 'nav__link active' : 'nav__link'}
              onClick={() => setActive(item.id)}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <footer className="sidebar__footer muted">
          <small>Data Dragon · CommunityDragon</small>
          <small>{new Date(manifest.downloadedAt).toLocaleString()}</small>
        </footer>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>League Planning — Assets</h1>
            <p className="muted">Vista previa de assets oficiales</p>
          </div>
          <div className="topbar__stats">
            <div className="stat">
              <span className="stat__value">{manifest.champions.length}</span>
              <span className="stat__label">Champions</span>
            </div>
            <div className="stat">
              <span className="stat__value">{manifest.items.length}</span>
              <span className="stat__label">Items</span>
            </div>
            <div className="stat">
              <span className="stat__value">{totalAssets}</span>
              <span className="stat__label">Total refs</span>
            </div>
          </div>
        </header>

        <Section id="overview" title="Overview" subtitle="Resumen de fuentes y estructura">
          <div className="overview-grid">
            <div className="wire-box">
              <h3>Fuentes</h3>
              <ul>
                <li><strong>Data Dragon</strong> — champions, items, runas, spells</li>
                <li><strong>CommunityDragon</strong> — minimap, pings, objetivos, wards</li>
              </ul>
            </div>
            <div className="wire-box">
              <h3>Estructura local</h3>
              <pre>{`assets/
  champions/{id}/
  items/
  runes/
  summoner_spells/
  minimap/
  objectives/
  wards/`}</pre>
            </div>
          </div>
        </Section>

        <Section id="champions" title="Champions" count={manifest.champions.length}>
          <Suspense fallback={<SectionFallback />}>
            <ChampionsSection champions={manifest.champions} />
          </Suspense>
        </Section>

        <Section id="items" title="Items" count={manifest.items.length}>
          <Suspense fallback={<SectionFallback />}>
            <ItemsSection items={manifest.items} />
          </Suspense>
        </Section>

        <Section id="runes" title="Runes">
          <Suspense fallback={<SectionFallback />}>
            <RunesSection runes={manifest.runes} />
          </Suspense>
        </Section>

        <Section id="summoners" title="Summoner Spells" count={manifest.summonerSpells.length}>
          <Suspense fallback={<SectionFallback />}>
            <SummonerSpellsSection spells={manifest.summonerSpells} />
          </Suspense>
        </Section>

        <Section id="minimap" title="Minimap">
          <Suspense fallback={<SectionFallback />}>
            <MinimapSection minimap={manifest.minimap} />
          </Suspense>
        </Section>

        <Section id="objectives" title="Objectives" count={manifest.objectives.length}>
          <Suspense fallback={<SectionFallback />}>
            <ObjectivesSection objectives={manifest.objectives} />
          </Suspense>
        </Section>

        <Section id="wards" title="Wards" count={manifest.wards.length}>
          <Suspense fallback={<SectionFallback />}>
            <WardsSection wards={manifest.wards} />
          </Suspense>
        </Section>
      </main>
    </div>
  )
}

export default function App() {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<AppView>('planning')

  useEffect(() => {
    fetch('/data/manifest.json')
      .then(async (r) => {
        const text = await r.text()
        if (!r.ok || text.trimStart().startsWith('<')) {
          throw new Error('Manifest no encontrado. Ejecuta: npm run download')
        }
        try {
          return JSON.parse(text) as Manifest
        } catch {
          throw new Error('Manifest inválido. Ejecuta: npm run download')
        }
      })
      .then(setManifest)
      .catch((e) => setError(e.message))
  }, [])

  if (error) {
    return (
      <div className="app app--error">
        <div className="error-panel">
          <h1>Assets no descargados</h1>
          <p>{error}</p>
          <pre>npm run download</pre>
        </div>
      </div>
    )
  }

  if (!manifest) {
    if (!isBootCached()) {
      return null
    }
    return (
      <div className="app app--loading">
        <div className="loading-block">Cargando manifest…</div>
      </div>
    )
  }

  return (
    <div className="ide">
      <header className="ide__titlebar">
        <img className="ide__logo" src="/app-icon.png" alt="" width={16} height={16} draggable={false} />
        <span className="ide__title">League Planning</span>
        <div className="ide__views">
          <button
            type="button"
            className={`ide__tab ${view === 'planning' ? 'ide__tab--on' : ''}`}
            onClick={() => setView('planning')}
          >
            Planificación
          </button>
          <button
            type="button"
            className={`ide__tab ${view === 'assets' ? 'ide__tab--on' : ''}`}
            onClick={() => setView('assets')}
          >
            Assets
          </button>
        </div>
        <span className="ide__patch">p{manifest.version}</span>
      </header>

      <div className={`ide__body ${view === 'assets' ? 'ide__body--scroll' : ''}`}>
        {view === 'planning' ? (
          <Suspense fallback={<PlanningSuspenseFallback />}>
            <PlanningView manifest={manifest} />
          </Suspense>
        ) : (
          <AssetBrowser manifest={manifest} />
        )}
      </div>
    </div>
  )
}
