import { PlanningProvider } from './PlanningContext'
import { PlaybookLandmarks } from './components/PlaybookLandmarks'
import { TeamPoolBar } from './components/TeamPoolBar'
import { AssetDock } from './components/AssetDock'
import { MapCanvas } from './components/MapCanvas'
import { MapMinimap } from './components/MapMinimap'
import { Toolbar } from './components/Toolbar'
import { SyncPanel } from './components/SyncPanel'
import { ChampionPoolModal } from './components/ChampionPoolModal'
import { EnemyPoolModal } from './components/EnemyPoolModal'
import { PlanningBootLoader } from './components/PlanningBootLoader'
import { usePlanningBoot } from './usePlanningBoot'
import type { Manifest } from '../types'
import './planning.css'

export function PlanningView({ manifest }: { manifest: Manifest }) {
  const { phase, showLoader, isRevealed } = usePlanningBoot()

  return (
    <PlanningProvider manifest={manifest}>
      <div className={`planning ${isRevealed ? 'planning--ready' : ''}`}>
        <div className={`planning__stage ${isRevealed ? '' : 'planning__stage--booting'}`}>
          <MapCanvas />
          <MapMinimap />
          <TeamPoolBar />
          <PlaybookLandmarks />
          <SyncPanel />
          <Toolbar />
          <AssetDock />
        </div>
        {showLoader && <PlanningBootLoader phase={phase} />}
        <ChampionPoolModal />
        <EnemyPoolModal />
      </div>
    </PlanningProvider>
  )
}
