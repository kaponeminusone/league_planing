import { usePlanning } from '../PlanningContext'

export function PlaybookLandmarks() {
  const {
    jugadas,
    activeJugada,
    switchJugada,
    newJugada,
    renameJugada,
    deleteJugada,
    duplicateJugada,
    saveNow,
  } = usePlanning()

  return (
    <div className="float landmarks" title="Jugadas">
      {jugadas.map((j, i) => (
        <button
          key={j.id}
          type="button"
          className={`landmark ${j.id === activeJugada.id ? 'landmark--on' : ''}`}
          onClick={() => switchJugada(j.id)}
          title={j.name}
        >
          <span className="landmark__gem" aria-hidden />
          <span className="landmark__n">{i + 1}</span>
        </button>
      ))}
      <button type="button" className="landmark landmark--add" onClick={newJugada} title="Nueva jugada">
        +
      </button>
      <div className="landmark__sep" />
      <input
        className="landmark__name"
        value={activeJugada.name}
        onChange={(e) => renameJugada(e.target.value)}
        aria-label="Nombre jugada"
      />
      <button type="button" className="icon-btn" onClick={saveNow} title="Guardar">
        ↓
      </button>
      <button type="button" className="icon-btn" onClick={duplicateJugada} title="Duplicar">
        ⧉
      </button>
      <button
        type="button"
        className="icon-btn"
        onClick={() => deleteJugada(activeJugada.id)}
        disabled={jugadas.length <= 1}
        title="Eliminar"
      >
        ⌫
      </button>
    </div>
  )
}
