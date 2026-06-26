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
  defaultEnemyTeam,
  defaultTeam,
  jugadaForSync,
  mergeRemoteJugada,
  MINION_BLUE_ICON,
  MINION_RED_ICON,
  normalizeEnemyTeam,
  normalizeTeam,
  normalizeJugada,
  sideForRole,
  type DrawingStroke,
  type EnemySlot,
  type Jugada,
  type MapMarker,
  type MapPoint,
  type MapTextBox,
  type QuickAsset,
  type TeamMember,
  type Tool,
  type Viewport,
} from './types'
import { focusViewportOnPoint } from './markerUtils'
import { buildPingWheelOptions, type PingWheelOption } from './pingWheel'
import { loadClientId } from './sync/types'
import {
  applyPersonalEntry,
  createPersonalHistory,
  pushPersonalUndo,
  type PersonalHistory,
  type PersonalUndoEntry,
} from './history'
import {
  loadActiveJugadaId,
  loadEnemyTeam,
  loadJugadas,
  loadTeam,
  saveActiveJugadaId,
  saveEnemyTeam,
  saveJugadas,
  saveTeam,
} from './storage'

interface PlanningContextValue {
  manifest: Manifest
  jugadas: Jugada[]
  activeJugada: Jugada
  team: TeamMember[]
  enemyTeam: EnemySlot[]
  tool: Tool
  setTool: (t: Tool) => void
  selectedAsset: QuickAsset | null
  setSelectedAsset: (a: QuickAsset | null) => void
  clearPlacement: () => void
  quickAssets: QuickAsset[]
  poolModalOpen: boolean
  setPoolModalOpen: (v: boolean) => void
  enemyPoolModalOpen: boolean
  setEnemyPoolModalOpen: (v: boolean) => void
  enemyPoolActiveSlot: number
  setEnemyPoolActiveSlot: (i: number) => void
  updateEnemyTeam: (slots: EnemySlot[]) => void
  setViewport: (v: Viewport) => void
  mapDimensions: { w: number; h: number }
  setMapDimensions: (d: { w: number; h: number }) => void
  selectedMarkerId: string | null
  setSelectedMarkerId: (id: string | null) => void
  updateMarker: (id: string, patch: Partial<MapMarker>, immediate?: boolean) => void
  moveMarker: (id: string, position: MapPoint, immediate?: boolean) => void
  focusOnPlayer: (playerId: string) => void
  addMarker: (m: Omit<MapMarker, 'id'>) => void
  placePlayerMarker: (m: Omit<MapMarker, 'id' | 'category'>) => void
  placeEnemyMarker: (m: Omit<MapMarker, 'id' | 'category' | 'enemySlotId'> & { enemySlotId: string }) => void
  placeMinionMarker: (side: 'blue' | 'red', position: MapPoint) => void
  removeMarker: (id: string) => void
  addStroke: (s: Omit<DrawingStroke, 'id'>) => void
  removeStroke: (id: string) => void
  addTextBox: (box: Omit<MapTextBox, 'id'>) => void
  removeTextBox: (id: string) => void
  pingWheelOptions: PingWheelOption[]
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  recordMoveUndo: (id: string, from: MapPoint, to: MapPoint) => void
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
    return saved.length ? saved.map(normalizeJugada) : [createEmptyJugada('Jugada 1')]
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
  const [enemyTeam, setEnemyTeam] = useState<EnemySlot[]>(() =>
    normalizeEnemyTeam(loadEnemyTeam() ?? defaultEnemyTeam()),
  )
  const [tool, setTool] = useState<Tool>('pan')
  const [selectedAsset, setSelectedAsset] = useState<QuickAsset | null>(null)
  const [poolModalOpen, setPoolModalOpen] = useState(false)
  const [enemyPoolModalOpen, setEnemyPoolModalOpen] = useState(false)
  const [enemyPoolActiveSlot, setEnemyPoolActiveSlot] = useState(0)
  const [drawColor, setDrawColor] = useState('#f0e6d2')
  const [timerSeconds, setTimerSeconds] = useState(180)
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  const [mapDimensions, setMapDimensions] = useState({ w: 1, h: 1 })
  const [historyTick, setHistoryTick] = useState(0)
  const clientIdRef = useRef(loadClientId())
  const personalHistoryRef = useRef<Map<string, PersonalHistory>>(new Map())

  const patchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const patchThrottleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingPatchRef = useRef<{ jugada: Jugada; action: string } | null>(null)
  const lastPatchSentAt = useRef(0)
  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId

  const quickAssets = useMemo(() => buildQuickAssets(manifest), [manifest])
  const pingWheelOptions = useMemo(() => buildPingWheelOptions(manifest), [manifest])
  const activeJugada = jugadas.find((j) => j.id === activeId) ?? jugadas[0]

  const onRemoteJugada = useCallback((jugada: Jugada) => {
    setJugadas((prev) => {
      const local = prev.find((j) => j.id === jugada.id)
      return replaceJugada(prev, mergeRemoteJugada(local, jugada))
    })
  }, [])

  const onRemoteJugadas = useCallback((list: Jugada[], remoteActiveId: string | null) => {
    setJugadas((prev) => {
      const localById = new Map(prev.map((j) => [j.id, j]))
      const merged = list.map((j) => mergeRemoteJugada(localById.get(j.id), normalizeJugada(j)))
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

  const getPersonalHistory = useCallback((jugadaId: string) => {
    const key = `${clientIdRef.current}:${jugadaId}`
    let stack = personalHistoryRef.current.get(key)
    if (!stack) {
      stack = createPersonalHistory()
      personalHistoryRef.current.set(key, stack)
    }
    return stack
  }, [])

  const recordUndo = useCallback(
    (entry: PersonalUndoEntry) => {
      pushPersonalUndo(getPersonalHistory(activeIdRef.current), entry)
      setHistoryTick((t) => t + 1)
    },
    [getPersonalHistory],
  )

  const patchContent = useCallback(
    (
      build: (current: Jugada) => Partial<Jugada>,
      syncAction: string,
      syncMode: 'instant' | 'debounce' | 'throttle' = 'instant',
      syncMs = 0,
    ) => {
      patchActiveJugada(build, syncAction, syncMode, syncMs)
    },
    [patchActiveJugada],
  )

  const recordMoveUndo = useCallback(
    (id: string, from: MapPoint, to: MapPoint) => {
      recordUndo({ kind: 'move-marker', id, from, to })
    },
    [recordUndo],
  )

  const undo = useCallback(() => {
    if (!activeJugada) return
    const stack = getPersonalHistory(activeJugada.id)
    const entry = stack.undo.pop()
    if (!entry) return
    stack.redo.push(entry)
    patchActiveJugada(
      (j) => applyPersonalEntry(j, entry, 'undo'),
      'deshizo',
      'instant',
    )
    setSelectedMarkerId(null)
    setHistoryTick((t) => t + 1)
  }, [activeJugada, getPersonalHistory, patchActiveJugada])

  const redo = useCallback(() => {
    if (!activeJugada) return
    const stack = getPersonalHistory(activeJugada.id)
    const entry = stack.redo.pop()
    if (!entry) return
    stack.undo.push(entry)
    patchActiveJugada(
      (j) => applyPersonalEntry(j, entry, 'redo'),
      'rehizo',
      'instant',
    )
    setSelectedMarkerId(null)
    setHistoryTick((t) => t + 1)
  }, [activeJugada, getPersonalHistory, patchActiveJugada])

  const personalStack = activeJugada ? getPersonalHistory(activeJugada.id) : createPersonalHistory()
  const canUndo = personalStack.undo.length > 0
  const canRedo = personalStack.redo.length > 0
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
      const marker: MapMarker = { ...m, id: createId(), authorId: clientIdRef.current }
      recordUndo({ kind: 'add-marker', marker })
      patchContent((j) => ({ markers: [...j.markers, marker] }), `colocó ${m.label}`)
    },
    [patchContent, recordUndo],
  )

  const placePlayerMarker = useCallback(
    (m: Omit<MapMarker, 'id' | 'category'>) => {
      const current = jugadas.find((j) => j.id === activeIdRef.current)
      if (!current) return
      const removed = current.markers.find((x) => x.playerId === m.playerId)
      if (removed) recordUndo({ kind: 'remove-marker', marker: removed })
      const marker: MapMarker = {
        ...m,
        id: createId(),
        category: 'player',
        label: `${m.playerName} — ${m.championName}`,
        authorId: clientIdRef.current,
      }
      recordUndo({ kind: 'add-marker', marker })
      patchContent((j) => {
        const withoutPlayer = j.markers.filter((x) => x.playerId !== m.playerId)
        return { markers: [...withoutPlayer, marker] }
      }, `colocó a ${m.playerName} (${m.championName})`)
    },
    [jugadas, patchContent, recordUndo],
  )

  const placeEnemyMarker = useCallback(
    (m: Omit<MapMarker, 'id' | 'category' | 'enemySlotId'> & { enemySlotId: string }) => {
      const current = jugadas.find((j) => j.id === activeIdRef.current)
      if (!current) return
      const removed = current.markers.find((x) => x.enemySlotId === m.enemySlotId)
      if (removed) recordUndo({ kind: 'remove-marker', marker: removed })
      const marker: MapMarker = {
        ...m,
        id: createId(),
        category: 'enemy',
        label: `${m.enemyLabel ?? 'Enemigo'} — ${m.championName}`,
        authorId: clientIdRef.current,
      }
      recordUndo({ kind: 'add-marker', marker })
      patchContent((j) => {
        const without = j.markers.filter((x) => x.enemySlotId !== m.enemySlotId)
        return { markers: [...without, marker] }
      }, `colocó enemigo (${m.championName})`)
    },
    [jugadas, patchContent, recordUndo],
  )

  const placeMinionMarker = useCallback(
    (side: 'blue' | 'red', position: MapPoint) => {
      const icon = side === 'blue' ? MINION_BLUE_ICON : MINION_RED_ICON
      const marker: MapMarker = {
        id: createId(),
        assetPath: icon,
        label: side === 'blue' ? 'Minion azul' : 'Minion rojo',
        position,
        category: 'minion',
        minionSide: side,
        authorId: clientIdRef.current,
      }
      recordUndo({ kind: 'add-marker', marker })
      patchContent((j) => ({ markers: [...j.markers, marker] }), `colocó minion ${side}`)
    },
    [patchContent, recordUndo],
  )

  const removeMarker = useCallback(
    (id: string) => {
      if (activeJugada) {
        const removed = activeJugada.markers.find((m) => m.id === id)
        if (removed) recordUndo({ kind: 'remove-marker', marker: removed })
      }
      patchContent((j) => ({ markers: j.markers.filter((m) => m.id !== id) }), 'eliminó un marcador')
      setSelectedMarkerId((cur) => (cur === id ? null : cur))
    },
    [activeJugada, patchContent, recordUndo],
  )

  const updateMarker = useCallback(
    (id: string, patch: Partial<MapMarker>, immediate = true) => {
      patchContent(
        (j) => ({
          markers: j.markers.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        }),
        'movió marcador',
        immediate ? 'instant' : 'throttle',
        40,
      )
    },
    [patchContent],
  )

  const moveMarker = useCallback(
    (id: string, position: MapPoint, immediate = false) => {
      updateMarker(id, { position }, immediate)
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
      const stroke: DrawingStroke = { ...s, id: createId(), authorId: clientIdRef.current }
      recordUndo({ kind: 'add-stroke', stroke })
      patchContent(
        (j) => ({ strokes: [...j.strokes, stroke] }),
        s.type === 'arrow' ? 'dibujó una flecha' : 'dibujó en el mapa',
      )
    },
    [patchContent, recordUndo],
  )

  const removeStroke = useCallback(
    (id: string) => {
      if (activeJugada) {
        const removed = activeJugada.strokes.find((s) => s.id === id)
        if (removed) recordUndo({ kind: 'remove-stroke', stroke: removed })
      }
      patchContent((j) => ({ strokes: j.strokes.filter((s) => s.id !== id) }), 'borró un trazo')
    },
    [activeJugada, patchContent, recordUndo],
  )

  const addTextBox = useCallback(
    (box: Omit<MapTextBox, 'id'>) => {
      const textBox: MapTextBox = { ...box, id: createId(), authorId: clientIdRef.current }
      recordUndo({ kind: 'add-text-box', textBox })
      patchContent((j) => ({ textBoxes: [...(j.textBoxes ?? []), textBox] }), 'añadió texto')
    },
    [patchContent, recordUndo],
  )

  const removeTextBox = useCallback(
    (id: string) => {
      if (activeJugada) {
        const removed = (activeJugada.textBoxes ?? []).find((t) => t.id === id)
        if (removed) recordUndo({ kind: 'remove-text-box', textBox: removed })
      }
      patchContent(
        (j) => ({ textBoxes: (j.textBoxes ?? []).filter((t) => t.id !== id) }),
        'eliminó texto',
      )
    },
    [activeJugada, patchContent, recordUndo],
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

  const updateEnemyTeam = useCallback((slots: EnemySlot[]) => {
    const normalized = normalizeEnemyTeam(slots)
    setEnemyTeam(normalized)
    saveEnemyTeam(normalized)
  }, [])

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
    enemyTeam,
    tool,
    setTool,
    selectedAsset,
    setSelectedAsset,
    clearPlacement,
    quickAssets,
    poolModalOpen,
    setPoolModalOpen,
    enemyPoolModalOpen,
    setEnemyPoolModalOpen,
    enemyPoolActiveSlot,
    setEnemyPoolActiveSlot,
    updateEnemyTeam,
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
    placeEnemyMarker,
    placeMinionMarker,
    removeMarker,
    addStroke,
    removeStroke,
    addTextBox,
    removeTextBox,
    pingWheelOptions,
    undo,
    redo,
    canUndo,
    canRedo,
    recordMoveUndo,
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
