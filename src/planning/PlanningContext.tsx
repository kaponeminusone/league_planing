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
  jugadaForSync,
  mergeRemoteJugada,
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
  const patchThrottleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingPatchRef = useRef<{ jugada: Jugada; action: string } | null>(null)
  const lastPatchSentAt = useRef(0)
  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId

  const quickAssets = useMemo(() => buildQuickAssets(manifest), [manifest])
  const activeJugada = jugadas.find((j) => j.id === activeId) ?? jugadas[0]

  const onRemoteJugada = useCallback((jugada: Jugada) => {
    setJugadas((prev) => {
      const local = prev.find((j) => j.id === jugada.id)
      return replaceJugada(prev, mergeRemoteJugada(local, jugada))
    })
    const stack = historyRef.current.get(jugada.id)
    if (stack) stack.future = []
    setHistoryTick((t) => t + 1)
  }, [])

  const onRemoteJugadas = useCallback((list: Jugada[], remoteActiveId: string | null) => {
    setJugadas((prev) => {
      const localById = new Map(prev.map((j) => [j.id, j]))
      const merged = list.map((j) => mergeRemoteJugada(localById.get(j.id), j))
      return persistJugadas(merged)
    })
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

  const sync = useSync({
    jugadas,
    activeId,
    team,
    onRemoteJugada,
    onRemoteJugadas,
    onRemoteActive,
    onRemoteTeam,
  })

  const flushPatch = useCallback(() => {
    const pending = pendingPatchRef.current
    if (!pending) return
    sync.broadcastPatch(jugadaForSync(pending.jugada), pending.action)
    pendingPatchRef.current = null
    lastPatchSentAt.current = Date.now()
    patchTimer.current = null
    patchThrottleTimer.current = null
  }, [sync])

  const schedulePatch = useCallback(
    (
      updated: Jugada,
      action: string,
      mode: 'instant' | 'debounce' | 'throttle' = 'instant',
      ms = 0,
    ) => {
      pendingPatchRef.current = { jugada: updated, action }

      if (mode === 'instant') {
        if (patchTimer.current) clearTimeout(patchTimer.current)
        if (patchThrottleTimer.current) clearTimeout(patchThrottleTimer.current)
        flushPatch()
        return
      }

      if (mode === 'debounce') {
        if (patchTimer.current) clearTimeout(patchTimer.current)
        patchTimer.current = setTimeout(flushPatch, ms || 400)
        return
      }

      const wait = ms || 50
      const elapsed = Date.now() - lastPatchSentAt.current
      if (elapsed >= wait) {
        flushPatch()
        return
      }
      if (patchThrottleTimer.current) return
      patchThrottleTimer.current = setTimeout(flushPatch, wait - elapsed)
    },
    [flushPatch],
  )

  const patchJugada = useCallback(
    (
      patch: Partial<Jugada>,
      syncAction?: string,
      syncMode: 'instant' | 'debounce' | 'throttle' = 'instant',
      syncMs = 0,
    ) => {
      setJugadas((prev) => {
        const current = prev.find((j) => j.id === activeIdRef.current)
        if (!current) return prev
        const updated: Jugada = {
          ...current,
          ...patch,
          updatedAt: new Date().toISOString(),
        }
        if (syncAction) schedulePatch(updated, syncAction, syncMode, syncMs)
        return replaceJugada(prev, updated)
      })
    },
    [schedulePatch],
  )

  const patchActiveJugada = useCallback(
    (
      build: (current: Jugada) => Partial<Jugada>,
      syncAction?: string,
      syncMode: 'instant' | 'debounce' | 'throttle' = 'instant',
      syncMs = 0,
    ) => {
      setJugadas((prev) => {
        const current = prev.find((j) => j.id === activeIdRef.current)
        if (!current) return prev
        const updated: Jugada = {
          ...current,
          ...build(current),
          updatedAt: new Date().toISOString(),
        }
        if (syncAction) schedulePatch(updated, syncAction, syncMode, syncMs)
        return replaceJugada(prev, updated)
      })
    },
    [schedulePatch],
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
      patchActiveJugada(() => ({ markers, strokes }), syncAction, 'instant')
    },
    [patchActiveJugada],
  )

  const patchContent = useCallback(
    (
      build: (current: Jugada) => Partial<Jugada>,
      syncAction: string,
      syncMode: 'instant' | 'debounce' | 'throttle' = 'instant',
      syncMs = 0,
      recordHistory = true,
    ) => {
      if (!activeJugada) return
      if (recordHistory) pushHistory()
      patchActiveJugada(build, syncAction, syncMode, syncMs)
    },
    [activeJugada, patchActiveJugada, pushHistory],
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

  const setViewport = useCallback((v: Viewport) => {
    setJugadas((prev) => {
      const current = prev.find((j) => j.id === activeIdRef.current)
      if (!current) return prev
      return replaceJugada(prev, { ...current, viewport: v })
    })
  }, [])

  const addMarker = useCallback(
    (m: Omit<MapMarker, 'id'>) => {
      patchContent(
        (j) => ({ markers: [...j.markers, { ...m, id: createId() }] }),
        `colocó ${m.label}`,
      )
    },
    [patchContent],
  )

  const placePlayerMarker = useCallback(
    (m: Omit<MapMarker, 'id' | 'category'>) => {
      patchContent((j) => {
        const withoutPlayer = j.markers.filter((x) => x.playerId !== m.playerId)
        const marker: MapMarker = {
          ...m,
          id: createId(),
          category: 'player',
          label: `${m.playerName} — ${m.championName}`,
        }
        return { markers: [...withoutPlayer, marker] }
      }, `colocó a ${m.playerName} (${m.championName})`)
    },
    [patchContent],
  )

  const removeMarker = useCallback(
    (id: string, recordHistory = true) => {
      patchContent(
        (j) => ({ markers: j.markers.filter((m) => m.id !== id) }),
        'eliminó un marcador',
        'instant',
        0,
        recordHistory,
      )
      setSelectedMarkerId((cur) => (cur === id ? null : cur))
    },
    [patchContent],
  )

  const updateMarker = useCallback(
    (id: string, patch: Partial<MapMarker>, immediate = true, recordHistory = true) => {
      patchContent(
        (j) => ({
          markers: j.markers.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        }),
        'movió marcador',
        immediate ? 'instant' : 'throttle',
        40,
        recordHistory,
      )
    },
    [patchContent],
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
        (j) => ({ strokes: [...j.strokes, { ...s, id: createId() }] }),
        s.type === 'arrow' ? 'dibujó una flecha' : 'dibujó en el mapa',
      )
    },
    [patchContent],
  )

  const removeStroke = useCallback(
    (id: string) => {
      patchContent(
        (j) => ({ strokes: j.strokes.filter((s) => s.id !== id) }),
        'borró un trazo',
      )
    },
    [patchContent],
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
    sync.broadcastJugadas(list.map(jugadaForSync), j.id, 'creó una jugada')
  }, [jugadas, sync])

  const renameJugada = useCallback(
    (name: string) => patchJugada({ name }, 'renombró la jugada', 'debounce', 400),
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
      sync.broadcastJugadas(list.map(jugadaForSync), activeId === id ? nextId : activeId, 'eliminó una jugada')
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
    sync.broadcastJugadas(list.map(jugadaForSync), copy.id, 'duplicó una jugada')
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
