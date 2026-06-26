import type { DrawingStroke, Jugada, MapMarker } from './types'

export const MAX_HISTORY = 50

export interface JugadaContentSnapshot {
  markers: MapMarker[]
  strokes: DrawingStroke[]
}

export interface JugadaHistory {
  past: JugadaContentSnapshot[]
  future: JugadaContentSnapshot[]
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
