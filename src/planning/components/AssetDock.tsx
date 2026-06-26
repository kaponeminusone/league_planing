import { useMemo } from 'react'
import { usePlanning } from '../PlanningContext'
import {
  encodeEnemyDrag,
  encodeMinionDrag,
  ENEMY_DRAG_MIME,
  MINION_DRAG_MIME,
} from '../drag'
import { roleIconPath } from '../roles'
import { MINION_BLUE_ICON, MINION_RED_ICON, APP_ICON_SRC } from '../types'

const GROUPS = [
  { key: 'ping', label: 'P' },
  { key: 'ward', label: 'W' },
  { key: 'objective', label: 'O' },
] as const

export function AssetDock() {
  const {
    quickAssets,
    selectedAsset,
    setSelectedAsset,
    setTool,
    clearPlacement,
    manifest,
    enemyTeam,
    setEnemyPoolModalOpen,
    setEnemyPoolActiveSlot,
  } = usePlanning()

  const champsById = useMemo(
    () => new Map(manifest.champions.map((c) => [c.id, c])),
    [manifest.champions],
  )

  const openEnemyPool = (slotIndex = 0) => {
    setEnemyPoolActiveSlot(slotIndex)
    setEnemyPoolModalOpen(true)
  }

  return (
    <div
      className="float asset-dock"
      onContextMenu={(e) => {
        e.preventDefault()
        clearPlacement()
      }}
    >
      <div className="asset-dock__row">
        {GROUPS.map((g) => {
          const items = quickAssets.filter((a) => a.category === g.key)
          if (!items.length) return null
          return (
            <div key={g.key} className="asset-dock__group">
              <span className="asset-dock__tag">{g.label}</span>
              {items.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  className={`asset-dock__item ${selectedAsset?.id === asset.id ? 'asset-dock__item--on' : ''}`}
                  title={`${asset.label}\nClic: uno · Shift/Ctrl: varios · Clic der: cancelar`}
                  onClick={() => {
                    setSelectedAsset(asset)
                    setTool('place')
                  }}
                >
                  <img src={asset.path} alt={asset.label} loading="lazy" draggable={false} />
                </button>
              ))}
            </div>
          )
        })}

        <div className="asset-dock__group asset-dock__group--enemy">
        <span className="asset-dock__tag asset-dock__tag--enemy">E</span>
        {enemyTeam.map((slot, index) => {
          const champ = slot.championId ? champsById.get(slot.championId) : null
          return (
            <button
              key={slot.id}
              type="button"
              className={`asset-dock__enemy ${champ ? 'asset-dock__enemy--filled' : 'asset-dock__enemy--empty'}`}
              title={
                champ
                  ? `${slot.label} — ${champ.name} (${slot.role})\nArrastra al mapa · Clic: configurar`
                  : `${slot.label} (${slot.role})\nClic para elegir campeón`
              }
              draggable={Boolean(champ)}
              onClick={() => openEnemyPool(index)}
              onDragStart={(e) => {
                if (!champ) return
                e.dataTransfer.setData(
                  ENEMY_DRAG_MIME,
                  encodeEnemyDrag({
                    slotId: slot.id,
                    slotLabel: slot.label,
                    memberRole: slot.role,
                    championId: champ.id,
                    championName: champ.name,
                    championIcon: champ.icon,
                  }),
                )
                e.dataTransfer.effectAllowed = 'copy'
                const img = e.currentTarget.querySelector('img')
                if (img instanceof HTMLImageElement) {
                  e.dataTransfer.setDragImage(img, 15, 15)
                }
              }}
            >
              {champ ? (
                <img src={champ.icon} alt={champ.name} draggable={false} />
              ) : (
                <img src={roleIconPath(manifest, slot.role)} alt={slot.role} draggable={false} />
              )}
              <span className="asset-dock__enemy-role" aria-hidden>
                {slot.role === 'Support' ? 'Sup' : slot.role.slice(0, 3)}
              </span>
            </button>
          )
        })}
        <button
          type="button"
          className="asset-dock__gear"
          title="Configurar equipo enemigo"
          onClick={() => openEnemyPool(0)}
        >
          ⚙
        </button>
        <button
          type="button"
          className="asset-dock__minion asset-dock__minion--blue"
          title="Minion cuerpo a cuerpo azul — arrastra al mapa"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(
              MINION_DRAG_MIME,
              encodeMinionDrag({ side: 'blue', icon: MINION_BLUE_ICON, label: 'Minion azul' }),
            )
            e.dataTransfer.effectAllowed = 'copy'
          }}
        >
          <img src={MINION_BLUE_ICON} alt="Minion azul" draggable={false} />
        </button>
        <button
          type="button"
          className="asset-dock__minion asset-dock__minion--red"
          title="Minion cuerpo a cuerpo rojo — arrastra al mapa"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(
              MINION_DRAG_MIME,
              encodeMinionDrag({ side: 'red', icon: MINION_RED_ICON, label: 'Minion rojo' }),
            )
            e.dataTransfer.effectAllowed = 'copy'
          }}
        >
          <img src={MINION_RED_ICON} alt="Minion rojo" draggable={false} />
        </button>
      </div>
      </div>

      <img
        className="asset-dock__brand"
        src={APP_ICON_SRC}
        alt=""
        aria-hidden
        draggable={false}
      />
    </div>
  )
}
