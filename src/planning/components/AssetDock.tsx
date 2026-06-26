import { usePlanning } from '../PlanningContext'

const GROUPS = [
  { key: 'ping', label: 'P' },
  { key: 'ward', label: 'W' },
  { key: 'objective', label: 'O' },
] as const

export function AssetDock() {
  const { quickAssets, selectedAsset, setSelectedAsset, setTool, clearPlacement } = usePlanning()

  return (
    <div
      className="float asset-dock"
      onContextMenu={(e) => {
        e.preventDefault()
        clearPlacement()
      }}
    >
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
    </div>
  )
}
