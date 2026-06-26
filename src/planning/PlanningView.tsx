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
import type { Manifest } from '../types'
import './planning.css'

export function PlanningView({ manifest }: { manifest: Manifest }) {
  return (
    <PlanningProvider manifest={manifest}>
      <div className="planning">
        <div className="planning__stage">
          <MapCanvas />
          <MapMinimap />
          <TeamPoolBar />
          <PlaybookLandmarks />
          <SyncPanel />
          <Toolbar />
          <AssetDock />
        </div>
        <ChampionPoolModal />
        <EnemyPoolModal />
      </div>
    </PlanningProvider>
  )
}
