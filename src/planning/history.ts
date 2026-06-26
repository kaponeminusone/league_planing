import type { DrawingStroke, Jugada, MapMarker, MapPoint } from './types'

export const MAX_HISTORY = 50

export interface JugadaContentSnapshot {
  markers: MapMarker[]
  strokes: DrawingStroke[]
}

export interface JugadaHistory {
  past: JugadaContentSnapshot[]
  future: JugadaContentSnapshot[]
}

/** Acción local de un usuario — undo/redo solo afecta sus propias ediciones. */
export type PersonalUndoEntry =
  | { kind: 'add-marker'; marker: MapMarker }
  | { kind: 'add-stroke'; stroke: DrawingStroke }
  | { kind: 'remove-marker'; marker: MapMarker }
  | { kind: 'remove-stroke'; stroke: DrawingStroke }
  | { kind: 'move-marker'; id: string; from: MapPoint; to: MapPoint }

export interface PersonalHistory {
  undo: PersonalUndoEntry[]
  redo: PersonalUndoEntry[]
}

export function createPersonalHistory(): PersonalHistory {
  return { undo: [], redo: [] }
}

export function pushPersonalUndo(stack: PersonalHistory, entry: PersonalUndoEntry) {
  stack.undo.push(entry)
  if (stack.undo.length > MAX_HISTORY) stack.undo.shift()
  stack.redo = []
}

export function applyPersonalEntry(
  jugada: Jugada,
  entry: PersonalUndoEntry,
  direction: 'undo' | 'redo',
): Partial<Jugada> {
  const forward = direction === 'redo'

  switch (entry.kind) {
    case 'add-marker':
      return forward
        ? { markers: [...jugada.markers, entry.marker] }
        : { markers: jugada.markers.filter((m) => m.id !== entry.marker.id) }
    case 'add-stroke':
      return forward
        ? { strokes: [...jugada.strokes, entry.stroke] }
        : { strokes: jugada.strokes.filter((s) => s.id !== entry.stroke.id) }
    case 'remove-marker':
      return forward
        ? { markers: jugada.markers.filter((m) => m.id !== entry.marker.id) }
        : { markers: [...jugada.markers, entry.marker] }
    case 'remove-stroke':
      return forward
        ? { strokes: jugada.strokes.filter((s) => s.id !== entry.stroke.id) }
        : { strokes: [...jugada.strokes, entry.stroke] }
    case 'move-marker':
      return {
        markers: jugada.markers.map((m) =>
          m.id === entry.id
            ? { ...m, position: forward ? entry.to : entry.from }
            : m,
        ),
      }
    default:
      return {}
  }
}

export function snapshotContent(jugada: Jugada): JugadaContentSnapshot {
  return {
    markers: structuredClone(jugada.markers),
    strokes: structuredClone(jugada.strokes),
  }
}

export function createEmptyHistory(): JugadaHistory {
  return { past: [], future: [] }
}

export function pushSnapshot(stack: JugadaHistory, snapshot: JugadaContentSnapshot) {
  stack.past.push(snapshot)
  if (stack.past.length > MAX_HISTORY) stack.past.shift()
  stack.future = []
}

export function popLastSnapshot(stack: JugadaHistory): JugadaContentSnapshot | null {
  return stack.past.pop() ?? null
}

export function undoFromStack(
  stack: JugadaHistory,
  current: JugadaContentSnapshot,
): JugadaContentSnapshot | null {
  if (!stack.past.length) return null
  stack.future.push(structuredClone(current))
  return stack.past.pop() ?? null
}

export function redoFromStack(
  stack: JugadaHistory,
  current: JugadaContentSnapshot,
): JugadaContentSnapshot | null {
  if (!stack.future.length) return null
  stack.past.push(structuredClone(current))
  return stack.future.pop() ?? null
}
