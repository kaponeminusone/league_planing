import { useCallback, useEffect, useRef, useState } from 'react'
import type { Jugada, TeamMember, Viewport } from '../types'
import {
  getWsUrl,
  loadClientId,
  loadUserName,
  saveUserName,
  type ClientMessage,
  type PeerCursor,
  type PresenceUser,
  type ServerMessage,
  type SyncStatus,
} from './types'

interface UseSyncOptions {
  jugadas: Jugada[]
  activeId: string
  team: TeamMember[]
  onRemoteJugada: (jugada: Jugada) => void
  onRemoteJugadas: (jugadas: Jugada[], activeId: string | null) => void
  onRemoteActive: (activeId: string) => void
  onRemoteTeam: (team: TeamMember[]) => void
  onRemoteViewport: (jugadaId: string, viewport: Viewport) => void
}

const CURSOR_STALE_MS = 12_000

function freshCursors(list: PeerCursor[]): PeerCursor[] {
  const now = Date.now()
  return list.filter((c) => now - c.at < CURSOR_STALE_MS)
}

function isSelfMessage(msg: ServerMessage, selfId: string) {
  return 'clientId' in msg && msg.clientId === selfId
}

export function useSync(options: UseSyncOptions) {
  const [status, setStatus] = useState<SyncStatus>('connecting')
  const [userName, setUserNameState] = useState(loadUserName)
  const [users, setUsers] = useState<PresenceUser[]>([])
  const [peerCursors, setPeerCursors] = useState<PeerCursor[]>([])
  const [lastEditBy, setLastEditBy] = useState<string | null>(null)
  const [lastEditAction, setLastEditAction] = useState<string | null>(null)
  const [liveActivity, setLiveActivity] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const clientIdRef = useRef(loadClientId())
  const bootstrappedRef = useRef(false)
  const activityTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const viewportTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingViewport = useRef<{ jugadaId: string; viewport: Viewport } | null>(null)

  const optionsRef = useRef(options)
  optionsRef.current = options

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  }, [])

  const setUserName = useCallback(
    (name: string) => {
      const trimmed = name.slice(0, 32) || 'user'
      setUserNameState(trimmed)
      saveUserName(trimmed)
      send({ type: 'set-user', userName: trimmed })
    },
    [send],
  )

  const handleServerMessage = useCallback((msg: ServerMessage) => {
    const opts = optionsRef.current
    const selfId = clientIdRef.current

    if (isSelfMessage(msg, selfId)) return

    switch (msg.type) {
      case 'init': {
        const s = msg.state
        if (s.jugadas.length) opts.onRemoteJugadas(s.jugadas, s.activeId)
        if (s.team.length) opts.onRemoteTeam(s.team)
        setLastEditBy(s.lastEditBy)
        setLastEditAction(s.lastEditAction)
        setUsers(msg.users)
        break
      }
      case 'presence':
        setUsers(msg.users)
        break
      case 'cursors':
        setPeerCursors(freshCursors(msg.cursors.filter((c) => c.clientId !== selfId)))
        break
      case 'viewport':
        opts.onRemoteViewport(msg.jugadaId, msg.viewport)
        setLiveActivity(`${msg.by} movió el mapa`)
        break
      case 'jugada':
        opts.onRemoteJugada(msg.jugada)
        setLastEditBy(msg.by)
        setLastEditAction(msg.action ?? 'editó la jugada')
        setLiveActivity(`${msg.by}: ${msg.action ?? 'editó'}`)
        break
      case 'jugadas':
        opts.onRemoteJugadas(msg.jugadas, msg.activeId)
        setLastEditBy(msg.by)
        setLastEditAction(msg.action ?? 'actualizó el playbook')
        setLiveActivity(`${msg.by}: ${msg.action ?? 'actualizó el playbook'}`)
        break
      case 'active':
        opts.onRemoteActive(msg.activeId)
        setLastEditBy(msg.by)
        setLastEditAction('cambió de jugada')
        setLiveActivity(`${msg.by} cambió de jugada`)
        break
      case 'team':
        opts.onRemoteTeam(msg.team)
        setLastEditBy(msg.by)
        setLastEditAction('actualizó pools')
        setLiveActivity(`${msg.by} actualizó el equipo`)
        break
      case 'activity':
        setLiveActivity(`${msg.userName}: ${msg.action}`)
        break
    }

    if (activityTimer.current) clearTimeout(activityTimer.current)
    activityTimer.current = setTimeout(() => setLiveActivity(null), 4000)
  }, [])

  useEffect(() => {
    const tick = setInterval(() => {
      setPeerCursors((prev) => freshCursors(prev))
    }, 4000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    let retry: ReturnType<typeof setTimeout>
    let closed = false

    const connect = () => {
      if (closed) return
      setStatus('connecting')
      const ws = new WebSocket(getWsUrl())
      wsRef.current = ws

      ws.onopen = () => {
        setStatus('connected')
        const opts = optionsRef.current
        const msg: ClientMessage = {
          type: 'join',
          clientId: clientIdRef.current,
          userName: loadUserName(),
          activeId: opts.activeId,
        }
        if (!bootstrappedRef.current) {
          msg.state = { jugadas: opts.jugadas, activeId: opts.activeId, team: opts.team }
          bootstrappedRef.current = true
        }
        ws.send(JSON.stringify(msg))
      }

      ws.onmessage = (ev) => {
        try {
          handleServerMessage(JSON.parse(ev.data) as ServerMessage)
        } catch {
          /* ignore */
        }
      }

      ws.onerror = () => setStatus('error')
      ws.onclose = () => {
        setStatus('disconnected')
        setPeerCursors([])
        if (!closed) retry = setTimeout(connect, 1500)
      }
    }

    connect()

    return () => {
      closed = true
      clearTimeout(retry)
      if (viewportTimer.current) clearTimeout(viewportTimer.current)
      wsRef.current?.close()
    }
  }, [handleServerMessage])

  const broadcastPatch = useCallback(
    (jugada: Jugada, action?: string) => {
      send({ type: 'patch-jugada', jugada, action })
    },
    [send],
  )

  const broadcastJugadas = useCallback(
    (list: Jugada[], id: string, action?: string) => {
      send({ type: 'set-jugadas', jugadas: list, activeId: id, action })
    },
    [send],
  )

  const broadcastActive = useCallback(
    (id: string) => {
      send({ type: 'set-active', activeId: id })
    },
    [send],
  )

  const broadcastTeam = useCallback(
    (t: TeamMember[]) => {
      send({ type: 'set-team', team: t })
    },
    [send],
  )

  const broadcastCursor = useCallback(
    (activeId: string, x: number, y: number) => {
      send({
        type: 'cursor',
        activeId,
        x: Math.min(1, Math.max(0, x)),
        y: Math.min(1, Math.max(0, y)),
      })
    },
    [send],
  )

  const broadcastViewport = useCallback(
    (jugadaId: string, viewport: Viewport) => {
      pendingViewport.current = { jugadaId, viewport }
      if (viewportTimer.current) return
      viewportTimer.current = setTimeout(() => {
        viewportTimer.current = null
        const pending = pendingViewport.current
        if (!pending) return
        send({ type: 'viewport', jugadaId: pending.jugadaId, viewport: pending.viewport })
        pendingViewport.current = null
      }, 50)
    },
    [send],
  )

  return {
    status,
    userName,
    setUserName,
    users,
    peerCursors,
    clientId: clientIdRef.current,
    lastEditBy,
    lastEditAction,
    liveActivity,
    broadcastPatch,
    broadcastJugadas,
    broadcastActive,
    broadcastTeam,
    broadcastCursor,
    broadcastViewport,
  }
}
