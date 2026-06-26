import { usePlanning } from '../PlanningContext'
import { ColorWheelPicker } from './ColorWheelPicker'
import type { Tool } from '../types'

const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: 'pan', label: 'Mover', icon: '✥' },
  { id: 'draw', label: 'Lápiz', icon: '✎' },
  { id: 'arrow', label: 'Flecha', icon: '➜' },
  { id: 'place', label: 'Colocar', icon: '⊕' },
  { id: 'erase', label: 'Borrar', icon: '✕' },
]

export function Toolbar() {
  const {
    tool,
    setTool,
    drawColor,
    setDrawColor,
    timerSeconds,
    setTimerSeconds,
    undo,
    redo,
    canUndo,
    canRedo,
  } = usePlanning()

  return (
    <div className="float tool-stack" title="Herramientas">
      <button
        type="button"
        className="icon-btn icon-btn--tool"
        title="Deshacer (Ctrl+Z)"
        disabled={!canUndo}
        onClick={undo}
      >
        ↶
      </button>
      <button
        type="button"
        className="icon-btn icon-btn--tool"
        title="Rehacer (Ctrl+Shift+Z)"
        disabled={!canRedo}
        onClick={redo}
      >
        ↷
      </button>
      <div className="tool-stack__sep" />
      {TOOLS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`icon-btn icon-btn--tool ${tool === t.id ? 'icon-btn--on' : ''}`}
          title={t.label}
          onClick={() => setTool(t.id)}
        >
          {t.icon}
        </button>
      ))}
      <div className="tool-stack__sep" />
      <ColorWheelPicker color={drawColor} onChange={setDrawColor} />
      <input
        type="number"
        className="tool-stack__timer"
        min={0}
        step={30}
        value={timerSeconds}
        onChange={(e) => setTimerSeconds(Number(e.target.value))}
        title="Timer ping (s)"
      />
    </div>
  )
}
