import {
  PING_WHEEL_ICON_RADIUS,
  PING_WHEEL_SIZE,
  segmentPosition,
  segmentWedgePath,
  type PingWheelOption,
} from '../pingWheel'

interface Props {
  centerX: number
  centerY: number
  options: PingWheelOption[]
  selectedIndex: number | null
}

export function PingWheel({ centerX, centerY, options, selectedIndex }: Props) {
  const half = PING_WHEEL_SIZE / 2
  const hubR = 38
  const outerR = half - 4

  return (
    <div
      className="ping-wheel"
      style={{
        left: centerX - half,
        top: centerY - half,
        width: PING_WHEEL_SIZE,
        height: PING_WHEEL_SIZE,
      }}
      aria-hidden
    >
      <div className="ping-wheel__backdrop" />

      <svg className="ping-wheel__svg" viewBox={`0 0 ${PING_WHEEL_SIZE} ${PING_WHEEL_SIZE}`}>
        {selectedIndex !== null && options[selectedIndex] && (
          <path
            className="ping-wheel__wedge"
            d={segmentWedgePath(half, half, hubR + 2, outerR, selectedIndex)}
          />
        )}
        <circle
          className="ping-wheel__ring"
          cx={half}
          cy={half}
          r={outerR}
          fill="none"
        />
      </svg>

      {options.map((opt, i) => {
        const pos = segmentPosition(i, half, PING_WHEEL_ICON_RADIUS)
        const isOn = selectedIndex === i
        return (
          <div
            key={opt.assetKey}
            className={`ping-wheel__slot ${isOn ? 'ping-wheel__slot--on' : ''}`}
            style={{ left: pos.x, top: pos.y }}
          >
            <div className="ping-wheel__slot-inner">
              {opt.path ? <img src={opt.path} alt={opt.label} draggable={false} /> : null}
            </div>
          </div>
        )
      })}

      <div className="ping-wheel__hub">
        <span className="ping-wheel__hub-label">PING</span>
        <span className="ping-wheel__hub-hint">Clic der. cancelar</span>
      </div>
    </div>
  )
}
