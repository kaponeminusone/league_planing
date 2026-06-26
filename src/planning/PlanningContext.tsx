import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Manifest } from '../types'
import { useSync } from './sync/useSync'
import type { PresenceUser, PeerCursor, SyncStatus } from './sync/types'
import {
  createEmptyJugada,
  createId,
  defaultTeam,
  normalizeTeam,
  sideForRole,
  type DrawingStroke,
  type Jugada,
  type MapMarker,
  type MapPoint,
  type QuickAsset,
  type TeamMember,
  type Tool,
  type Viewport,
} from './types'
import { focusViewportOnPoint } from './markerUtils'
import {
  createEmptyHistory,
  popLastSnapshot,
  pushSnapshot,
  redoFromStack,
  snapshotContent,
  undoFromStack,
  type JugadaHistory,
} from './history'
import {
  loadActiveJugadaId,
  loadJugadas,
  loadTeam,
  saveActiveJugadaId,
  saveJugadas,
  saveTeam,
} from './storage'

interface PlanningContextValue {
  manifest: Manifest
  jugadas: Jugada[]
  activeJugada: Jugada
  team: TeamMember[]
  tool: Tool
  setTool: (t: Tool) => void
  selectedAsset: QuickAsset | null
  setSelectedAsset: (a: QuickAsset | null) => void
  clearPlacement: () => void
  quickAssets: QuickAsset[]
  poolModalOpen: boolean
  setPoolModalOpen: (v: boolean) => void
  setViewport: (v: Viewport) => void
  mapDimensions: { w: number; h: number }
  setMapDimensions: (d: { w: number; h: number }) => void
  selectedMarkerId: string | null
  setSelectedMarkerId: (id: string | null) => void
  updateMarker: (id: string, patch: Partial<MapMarker>, immediate?: boolean, recordHistory?: boolean) => void
  moveMarker: (id: string, position: MapPoint, immediate?: boolean, recordHistory?: boolean) => void
  focusOnPlayer: (playerId: string) => void
  addMarker: (m: Omit<MapMarker, 'id'>) => void
  placePlayerMarker: (m: Omit<MapMarker, 'id' | 'category'>) => void
  removeMarker: (id: string, recordHistory?: boolean) => void
  addStroke: (s: Omit<DrawingStroke, 'id'>) => void
  removeStroke: (id: string) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  pushHistory: () => void
  discardLastHistory: () => void
  switchJugada: (id: string) => void
  newJugada: () => void
  renameJugada: (name: string) => void
  deleteJugada: (id: string) => void
  duplicateJugada: () => void
  saveNow: () => void
  updateTeam: (team: TeamMember[]) => void
  drawColor: string
  setDrawColor: (c: string) => void
  timerSeconds: number
  setTimerSeconds: (n: number) => void
  syncStatus: SyncStatus
  userName: string
  setUserName: (n: string) => void
  connectedUsers: PresenceUser[]
  peerCursors: PeerCursor[]
  clientId: string
  broadcastCursor: (activeId: string, x: number, y: number) => void
  lastEditBy: string | null
  lastEditAction: string | null
  liveActivity: string | null
}

const PlanningContext = createContext<PlanningContextValue | null>(null)

function buildQuickAssets(manifest: Manifest): QuickAsset[] {
  const assets: QuickAsset[] = []

  for (const p of manifest.minimap.pings) {
    assets.push({ id: `ping-${p.name}`, label: p.name, path: p.path, category: 'ping' })
  }
  for (const w of manifest.wards) {
    assets.push({ id: `ward-${w.name}`, label: w.name, path: w.path, category: 'ward' })
  }
  for (const o of manifest.objectives) {
    assets.push({
      id: `obj-${o.name}`,
      label: o.name.replace(/_/g, ' '),
      path: o.path,
      category: 'objective',
    })
  }
  for (const c of manifest.champions.slice(0, 20)) {
    assets.push({
      id: `champ-${c.id}`,
      label: c.name,
      path: c.icon,
      category: 'champion',
    })
  }

  return assets
}

function persistJugadas(jugadas: Jugada[]): Jugada[] {
  saveJugadas(jugadas)
  return jugadas
}

function replaceJugada(jugadas: Jugada[], updated: Jugada): Jugada[] {
  return persistJugadas(jugadas.map((j) => (j.id === updated.id ? updated : j)))
}

export function PlanningProvider({
  manifest,
  children,
}: {
  manifest: Manifest
  children: ReactNode
}) {
  const [jugadas, setJugadas] = useState<Jugada[]>(() => {
    const saved = loadJugadas()
    return saved.length ? saved : [createEmptyJugada('Jugada 1')]
  })
  const [activeId, setActiveId] = useState(() => {
    const saved = loadActiveJugadaId()
    const list = loadJugadas()
    if (saved && list.some((j) => j.id === saved)) return saved
    return list[0]?.id ?? createEmptyJugada().id
  })
  const [team, setTeam] = useState<TeamMember[]>(() => {
    const saved = normalizeTeam(loadTeam() ?? defaultTeam())
    return saved.map((m) => ({
      ...m,
      side: m.side ?? sideForRole(m.role),
    }))
  })
  const [tool, setTool] = useState<Tool>('pan')
  const [selectedAsset, setSelectedAsset] = useState<QuickAsset | null>(null)
  const [poolModalOpen, setPoolModalOpen] = useState(false)
  const [drawColor, setDrawColor] = useState('#f0e6d2')
  const [timerSeconds, setTimerSeconds] = useState(180)
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  const [mapDimensions, setMapDimensions] = useState({ w: 1, h: 1 })
  const [historyTick, setHistoryTick] = useState(0)
  const historyRef = useRef<Map<string, JugadaHistory>>(new Map())

  const patchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const quickAssets = useMemo(() => buildQuickAssets(manifest), [manifest])
  const activeJugada = jugadas.find((j) => j.id === activeId) ?? jugadas[0]

  const onRemoteJugada = useCallback((jugada: Jugada) => {
    setJugadas((prev) => replaceJugada(prev, jugada))
    const stack = historyRef.current.get(jugada.id)
    if (stack) stack.future = []
    setHistoryTick((t) => t + 1)
  }, [])

  const onRemoteJugadas = useCallback((list: Jugada[], remoteActiveId: string | null) => {
    setJugadas(persistJugadas(list))
    if (remoteActiveId) {
      setActiveId(remoteActiveId)
      saveActiveJugadaId(remoteActiveId)
    }
  }, [])

  const onRemoteActive = useCallback((id: string) => {
    setActiveId(id)
    saveActiveJugadaId(id)
  }, [])

  const onRemoteTeam = useCallback((t: TeamMember[]) => {
    const normalized = normalizeTeam(t)
    setTeam(normalized)
    saveTeam(normalized)
  }, [])

  const onRemoteViewport = useCallback((jugadaId: string, viewport: Viewport) => {
    setJugadas((prev) => {
      const j = prev.find((x) => x.id === jugadaId)
      if (!j) return prev
      return replaceJugada(prev, { ...j, viewport })
    })
  }, [])

  const sync = useSync({
    jugadas,
    activeId,
    team,
    onRemoteJugada,
    onRemoteJugadas,
    onRemoteActive,
    onRemoteTeam,
    onRemoteViewport,
  })

  const schedulePatch = useCallback(
    (updated: Jugada, action: string, debounceMs = 0) => {
      if (patchTimer.current) clearTimeout(patchTimer.current)
      const send = () => sync.broadcastPatch(updated, action)
      if (debounceMs > 0) patchTimer.current = setTimeout(send, debounceMs)
      else send()
    },
    [sync],
  )

  const patchJugada = useCallback(
    (patch: Partial<Jugada>, syncAction?: string, debounceMs = 0) => {
      if (!activeJugada) return
      const updated: Jugada = {
        ...activeJugada,
        ...patch,
        updatedAt: new Date().toISOString(),
      }
      setJugadas((prev) => replaceJugada(prev, updated))
      if (syncAction) schedulePatch(updated, syncAction, debounceMs)
    },
    [activeJugada, schedulePatch],
  )

  const getHistory = useCallback(
    (jugadaId: string) => {
      let stack = historyRef.current.get(jugadaId)
      if (!stack) {
        stack = createEmptyHistory()
        historyRef.current.set(jugadaId, stack)
      }
      return stack
    },
    [],
  )

  const pushHistory = useCallback(() => {
    if (!activeJugada) return
    pushSnapshot(getHistory(activeJugada.id), snapshotContent(activeJugada))
    setHistoryTick((t) => t + 1)
  }, [activeJugada, getHistory])

  const discardLastHistory = useCallback(() => {
    if (!activeJugada) return
    popLastSnapshot(getHistory(activeJugada.id))
    setHistoryTick((t) => t + 1)
  }, [activeJugada, getHistory])

  const applyContent = useCallback(
    (markers: MapMarker[], strokes: DrawingStroke[], syncAction: string) => {
      patchJugada({ markers, strokes }, syncAction, 0)
    },
    [patchJugada],
  )

  const patchContent = useCallback(
    (
      patch: { markers?: MapMarker[]; strokes?: DrawingStroke[] },
      syncAction: string,
      debounceMs = 0,
      recordHistory = true,
    ) => {
      if (!activeJugada) return
      if (recordHistory) pushHistory()
      patchJugada(patch, syncAction, debounceMs)
    },
    [activeJugada, patchJugada, pushHistory],
  )

  const undo = useCallback(() => {
    if (!activeJugada) return
    const stack = getHistory(activeJugada.id)
    const prev = undoFromStack(stack, snapshotContent(activeJugada))
    if (!prev) return
    applyContent(prev.markers, prev.strokes, 'deshizo')
    setSelectedMarkerId(null)
    setHistoryTick((t) => t + 1)
  }, [activeJugada, applyContent, getHistory])

  const redo = useCallback(() => {
    if (!activeJugada) return
    const stack = getHistory(activeJugada.id)
    const next = redoFromStack(stack, snapshotContent(activeJugada))
    if (!next) return
    applyContent(next.markers, next.strokes, 'rehizo')
    setSelectedMarkerId(null)
    setHistoryTick((t) => t + 1)
  }, [activeJugada, applyContent, getHistory])

  const activeHistory = activeJugada ? getHistory(activeJugada.id) : createEmptyHistory()
  const canUndo = activeHistory.past.length > 0
  const canRedo = activeHistory.future.length > 0
  void historyTick

  const setViewport = useCallback(
    (v: Viewport) => {
      if (!activeJugada) return
      const updated: Jugada = { ...activeJugada, viewport: v }
      setJugadas((prev) => replaceJugada(prev, updated))
      sync.broadcastViewport(activeJugada.id, v)
    },
    [activeJugada, sync],
  )

  const addMarker = useCallback(
    (m: Omit<MapMarker, 'id'>) => {
      patchContent(
        { markers: [...activeJugada.markers, { ...m, id: createId() }] },
        `colocó ${m.label}`,
      )
    },
    [activeJugada, patchContent],
  )

  const placePlayerMarker = useCallback(
    (m: Omit<MapMarker, 'id' | 'category'>) => {
      const withoutPlayer = activeJugada.markers.filter((x) => x.playerId !== m.playerId)
      const marker: MapMarker = {
        ...m,
        id: createId(),
        category: 'player',
        label: `${m.playerName} — ${m.championName}`,
      }
      patchContent(
        { markers: [...withoutPlayer, marker] },
        `colocó a ${m.playerName} (${m.championName})`,
      )
    },
    [activeJugada, patchContent],
  )

  const removeMarker = useCallback(
    (id: string, recordHistory = true) => {
      patchContent(
        { markers: activeJugada.markers.filter((m) => m.id !== id) },
        'eliminó un marcador',
        0,
        recordHistory,
      )
      setSelectedMarkerId((cur) => (cur === id ? null : cur))
    },
    [activeJugada, patchContent],
  )

  const updateMarker = useCallback(
    (id: string, patch: Partial<MapMarker>, immediate = true, recordHistory = true) => {
      patchContent(
        {
          markers: activeJugada.markers.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        },
        'editó marcador',
        immediate ? 0 : 160,
        recordHistory,
      )
    },
    [activeJugada, patchContent],
  )

  const moveMarker = useCallback(
    (id: string, position: MapPoint, immediate = false, recordHistory = true) => {
      updateMarker(id, { position }, immediate, recordHistory)
    },
    [updateMarker],
  )

  const focusOnPlayer = useCallback(
    (playerId: string) => {
      const marker = activeJugada.markers.find((m) => m.playerId === playerId)
      if (!marker) return
      const stage = document.querySelector('.planning__stage') as HTMLElement | null
      if (!stage || mapDimensions.w <= 1) return
      setViewport(
        focusViewportOnPoint(
          marker.position,
          stage.clientWidth,
          stage.clientHeight,
          mapDimensions.w,
          mapDimensions.h,
        ),
      )
    },
    [activeJugada.markers, mapDimensions, setViewport],
  )

  const addStroke = useCallback(
    (s: Omit<DrawingStroke, 'id'>) => {
      patchContent(
        { strokes: [...activeJugada.strokes, { ...s, id: createId() }] },
        s.type === 'arrow' ? 'dibujó una flecha' : 'dibujó en el mapa',
      )
    },
    [activeJugada, patchContent],
  )

  const removeStroke = useCallback(
    (id: string) => {
      patchContent(
        { strokes: activeJugada.strokes.filter((s) => s.id !== id) },
        'borró un trazo',
      )
    },
    [activeJugada, patchContent],
  )

  const switchJugada = useCallback(
    (id: string) => {
      setActiveId(id)
      saveActiveJugadaId(id)
      sync.broadcastActive(id)
    },
    [sync],
  )

  const newJugada = useCallback(() => {
    const j = createEmptyJugada(`Jugada ${jugadas.length + 1}`)
    const list = persistJugadas([...jugadas, j])
    setJugadas(list)
    setActiveId(j.id)
    saveActiveJugadaId(j.id)
    sync.broadcastJugadas(list, j.id, 'creó una jugada')
  }, [jugadas, sync])

  const renameJugada = useCallback(
    (name: string) => patchJugada({ name }, 'renombró la jugada', 400),
    [patchJugada],
  )

  const deleteJugada = useCallback(
    (id: string) => {
      if (jugadas.length <= 1) return
      const list = persistJugadas(jugadas.filter((j) => j.id !== id))
      const nextId = list[0].id
      setJugadas(list)
      if (activeId === id) {
        setActiveId(nextId)
        saveActiveJugadaId(nextId)
      }
      sync.broadcastJugadas(list, activeId === id ? nextId : activeId, 'eliminó una jugada')
    },
    [jugadas, activeId, sync],
  )

  const duplicateJugada = useCallback(() => {
    const copy: Jugada = {
      ...structuredClone(activeJugada),
      id: createId(),
      name: `${activeJugada.name} (copia)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const list = persistJugadas([...jugadas, copy])
    setJugadas(list)
    setActiveId(copy.id)
    saveActiveJugadaId(copy.id)
    sync.broadcastJugadas(list, copy.id, 'duplicó una jugada')
  }, [activeJugada, jugadas, sync])

  const saveNow = useCallback(() => {
    patchJugada({}, 'guardó la jugada')
  }, [patchJugada])

  const clearPlacement = useCallback(() => {
    setSelectedAsset(null)
    setTool('pan')
  }, [])

  const updateTeam = useCallback(
    (t: TeamMember[]) => {
      setTeam(t)
      saveTeam(t)
      sync.broadcastTeam(t)
    },
    [sync],
  )

  useEffect(() => {
    if (tool === 'place' && !selectedAsset && quickAssets.length) {
      setSelectedAsset(quickAssets[0])
    }
  }, [tool, selectedAsset, quickAssets])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  const value: PlanningContextValue = {
    manifest,
    jugadas,
    activeJugada,
    team,
    tool,
    setTool,
    selectedAsset,
    setSelectedAsset,
    clearPlacement,
    quickAssets,
    poolModalOpen,
    setPoolModalOpen,
    setViewport,
    mapDimensions,
    setMapDimensions,
    selectedMarkerId,
    setSelectedMarkerId,
    updateMarker,
    moveMarker,
    focusOnPlayer,
    addMarker,
    placePlayerMarker,
    removeMarker,
    addStroke,
    removeStroke,
    undo,
    redo,
    canUndo,
    canRedo,
    pushHistory,
    discardLastHistory,
    switchJugada,
    newJugada,
    renameJugada,
    deleteJugada,
    duplicateJugada,
    saveNow,
    updateTeam,
    drawColor,
    setDrawColor,
    timerSeconds,
    setTimerSeconds,
    syncStatus: sync.status,
    userName: sync.userName,
    setUserName: sync.setUserName,
    connectedUsers: sync.users,
    peerCursors: sync.peerCursors,
    clientId: sync.clientId,
    broadcastCursor: sync.broadcastCursor,
    lastEditBy: sync.lastEditBy,
    lastEditAction: sync.lastEditAction,
    liveActivity: sync.liveActivity,
  }

  return <PlanningContext.Provider value={value}>{children}</PlanningContext.Provider>
}

export function usePlanning() {
  const ctx = useContext(PlanningContext)
  if (!ctx) throw new Error('usePlanning must be used within PlanningProvider')
  return ctx
}
