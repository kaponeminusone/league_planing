/**
 * Servidor WebSocket para sincronizar jugadas entre clientes.
 * Sala única por defecto — ideal para un equipo en LAN o con túnel.
 *
 * Uso: npm run sync-server
 */

import { createServer } from 'http'
import { existsSync } from 'fs'
import { readFile, stat } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { WebSocketServer } from 'ws'
import { loadLocalEnv } from '../scripts/load-local-env.mjs'
import {
  closeMongo,
  connectMongo,
  getMongoStatus,
  isPersistenceEnabled,
  loadRoom,
  saveRoom,
} from './mongo.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
loadLocalEnv()
const PORT = Number(process.env.PORT ?? process.env.SYNC_PORT ?? 3001)
const HOST = process.env.HOST ?? '0.0.0.0'
const DIST_PATH = process.env.DIST_PATH
  ? path.resolve(process.env.DIST_PATH)
  : null

function siteBaseFromRequest(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost'
  const protoHeader = req.headers['x-forwarded-proto']
  const proto =
    typeof protoHeader === 'string'
      ? protoHeader.split(',')[0].trim()
      : host.includes('localhost') || host.startsWith('127.0.0.1')
        ? 'http'
        : 'https'
  return `${proto}://${host}`
}

function injectSocialMeta(html, req) {
  const base = siteBaseFromRequest(req)
  return html.replaceAll('__OG_URL__', base).replaceAll('__OG_IMAGE__', `${base}/og-image.png`)
}

function sendHtml(res, buf, req) {
  let body = buf.toString('utf-8')
  if (body.includes('__OG_URL__') || body.includes('__OG_IMAGE__')) {
    body = injectSocialMeta(body, req)
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(body)
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

/** @type {{ jugadas: object[]; activeId: string | null; team: object[]; lastEditBy: string | null; lastEditAt: string | null; lastEditAction: string | null }} */
const room = {
  jugadas: [],
  activeId: null,
  team: [],
  lastEditBy: null,
  lastEditAt: null,
  lastEditAction: null,
}

let persistTimer = null

function schedulePersist() {
  if (!isPersistenceEnabled()) return
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    void saveRoom(room)
  }, 400)
}

/** @type {Map<import('ws').WebSocket, { clientId: string; userName: string; activeId: string | null }>} */
const clients = new Map()

/** @type {Map<string, { clientId: string; userName: string; activeId: string | null; x: number; y: number; at: number }>} */
const cursors = new Map()

function presence() {
  return [...clients.values()].map((c) => ({
    clientId: c.clientId,
    userName: c.userName,
    activeId: c.activeId ?? null,
  }))
}

function liveCursors() {
  const now = Date.now()
  for (const [id, c] of cursors) {
    if (now - c.at > 12_000) cursors.delete(id)
  }
  return [...cursors.values()]
}

function broadcast(msg, except) {
  const data = JSON.stringify(msg)
  for (const [ws] of clients) {
    if (ws !== except && ws.readyState === 1) ws.send(data)
  }
}

function broadcastAll(msg) {
  broadcast(msg, null)
}

function touch(by, action) {
  room.lastEditBy = by
  room.lastEditAt = new Date().toISOString()
  room.lastEditAction = action
}

function sendInit(ws) {
  ws.send(
    JSON.stringify({
      type: 'init',
      state: {
        jugadas: room.jugadas,
        activeId: room.activeId,
        team: room.team,
        lastEditBy: room.lastEditBy,
        lastEditAt: room.lastEditAt,
        lastEditAction: room.lastEditAction,
      },
      users: presence(),
    }),
  )
}

function handleMessage(ws, raw) {
  let msg
  try {
    msg = JSON.parse(raw)
  } catch {
    return
  }

  const client = clients.get(ws)
  if (!client && msg.type !== 'join') return

  switch (msg.type) {
    case 'join': {
      const userName = String(msg.userName || 'user').slice(0, 32)
      const clientId = String(msg.clientId || crypto.randomUUID())
      const activeId = msg.activeId ?? msg.state?.activeId ?? room.activeId ?? null
      clients.set(ws, { clientId, userName, activeId })
      console.log(`+ ${userName} (${clientId.slice(0, 8)})`)

      let bootstrapped = false
      if (room.jugadas.length === 0 && msg.state?.jugadas?.length) {
        room.jugadas = msg.state.jugadas
        room.activeId = msg.state.activeId ?? msg.state.jugadas[0]?.id ?? null
        room.team = msg.state.team ?? []
        touch(userName, 'subió estado inicial')
        schedulePersist()
        bootstrapped = true
      }

      sendInit(ws)
      broadcastAll({ type: 'presence', users: presence() })

      if (bootstrapped) {
        const at = room.lastEditAt ?? new Date().toISOString()
        broadcastAll({
          type: 'jugadas',
          jugadas: room.jugadas,
          activeId: room.activeId,
          by: userName,
          at,
          action: 'sincronizó la sala',
          clientId: '__server__',
        })
        broadcastAll({
          type: 'team',
          team: room.team,
          by: userName,
          at,
          clientId: '__server__',
        })
      }
      break
    }

    case 'set-user': {
      if (!client) return
      client.userName = String(msg.userName || 'user').slice(0, 32)
      broadcastAll({ type: 'presence', users: presence() })
      break
    }

    case 'patch-jugada': {
      if (!client) return
      const jugada = msg.jugada
      if (!jugada?.id) return
      const idx = room.jugadas.findIndex((j) => j.id === jugada.id)
      if (idx >= 0) room.jugadas[idx] = jugada
      else room.jugadas.push(jugada)
      const action = msg.action ?? 'editó la jugada'
      touch(client.userName, action)
      schedulePersist()
      broadcast(
        {
          type: 'jugada',
          jugada,
          by: client.userName,
          at: room.lastEditAt,
          action,
          clientId: client.clientId,
        },
        ws,
      )
      break
    }

    case 'set-jugadas': {
      if (!client) return
      if (!Array.isArray(msg.jugadas)) return
      room.jugadas = msg.jugadas
      room.activeId = msg.activeId ?? room.activeId
      const action = msg.action ?? 'actualizó el playbook'
      touch(client.userName, action)
      schedulePersist()
      broadcast(
        {
          type: 'jugadas',
          jugadas: room.jugadas,
          activeId: room.activeId,
          by: client.userName,
          at: room.lastEditAt,
          action,
          clientId: client.clientId,
        },
        ws,
      )
      break
    }

    case 'set-active': {
      if (!client) return
      room.activeId = msg.activeId
      client.activeId = msg.activeId ?? null
      touch(client.userName, 'cambió de jugada')
      schedulePersist()
      broadcast(
        {
          type: 'active',
          activeId: room.activeId,
          by: client.userName,
          at: room.lastEditAt,
          clientId: client.clientId,
        },
        ws,
      )
      broadcastAll({ type: 'presence', users: presence() })
      break
    }

    case 'set-team': {
      if (!client) return
      if (!Array.isArray(msg.team)) return
      room.team = msg.team
      touch(client.userName, 'actualizó pools del equipo')
      schedulePersist()
      broadcast(
        {
          type: 'team',
          team: room.team,
          by: client.userName,
          at: room.lastEditAt,
          clientId: client.clientId,
        },
        ws,
      )
      break
    }

    case 'activity': {
      if (!client) return
      const action = String(msg.action || 'está editando').slice(0, 80)
      broadcastAll({
        type: 'activity',
        userName: client.userName,
        action,
        at: new Date().toISOString(),
        clientId: client.clientId,
      })
      break
    }

    case 'cursor': {
      if (!client) return
      const activeId = String(msg.activeId || '')
      const x = Number(msg.x)
      const y = Number(msg.y)
      if (!activeId || Number.isNaN(x) || Number.isNaN(y)) return
      client.activeId = activeId
      cursors.set(client.clientId, {
        clientId: client.clientId,
        userName: client.userName,
        activeId,
        x: Math.min(1, Math.max(0, x)),
        y: Math.min(1, Math.max(0, y)),
        at: Date.now(),
      })
      broadcast({ type: 'cursors', cursors: liveCursors() }, ws)
      break
    }

    case 'viewport': {
      if (!client) return
      const jugadaId = String(msg.jugadaId || '')
      const viewport = msg.viewport
      if (!jugadaId || !viewport) return
      const idx = room.jugadas.findIndex((j) => j.id === jugadaId)
      if (idx >= 0) {
        room.jugadas[idx] = { ...room.jugadas[idx], viewport }
        schedulePersist()
      }
      broadcast(
        {
          type: 'viewport',
          jugadaId,
          viewport,
          by: client.userName,
          clientId: client.clientId,
        },
        ws,
      )
      break
    }

    default:
      break
  }
}

const httpServer = createServer((req, res) => {
  void handleHttp(req, res)
})

async function handleHttp(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host ?? 'localhost'}`)

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        ok: true,
        clients: clients.size,
        mongo: getMongoStatus(),
        jugadas: room.jugadas.length,
      }),
    )
    return
  }

  if (!DIST_PATH) {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('LoL Planning sync server — use WebSocket\n')
    return
  }

  let filePath = path.join(DIST_PATH, decodeURIComponent(url.pathname))
  if (url.pathname === '/') filePath = path.join(DIST_PATH, 'index.html')

  const resolved = path.resolve(filePath)
  if (!resolved.startsWith(DIST_PATH)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  try {
    let st = await stat(resolved)
    if (st.isDirectory()) filePath = path.join(resolved, 'index.html')
    else filePath = resolved

    if (!existsSync(filePath)) throw new Error('missing')

    const buf = await readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()
    if (ext === '.html') {
      sendHtml(res, buf, req)
      return
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' })
    res.end(buf)
  } catch {
    try {
      const buf = await readFile(path.join(DIST_PATH, 'index.html'))
      sendHtml(res, buf, req)
    } catch {
      res.writeHead(404)
      res.end('Not found')
    }
  }
}

const wss = new WebSocketServer({ server: httpServer })

wss.on('connection', (ws) => {
  ws.on('message', (data) => handleMessage(ws, data.toString()))
  ws.on('close', () => {
    const c = clients.get(ws)
    if (c) {
      console.log(`- ${c.userName}`)
      cursors.delete(c.clientId)
      broadcastAll({ type: 'cursors', cursors: liveCursors() })
    }
    clients.delete(ws)
    broadcastAll({ type: 'presence', users: presence() })
  })
})

async function start() {
  await connectMongo()
  const saved = await loadRoom()
  if (saved) {
    room.jugadas = saved.jugadas
    room.activeId = saved.activeId
    room.team = saved.team
    room.lastEditBy = saved.lastEditBy
    room.lastEditAt = saved.lastEditAt
    room.lastEditAction = saved.lastEditAction
    console.log(
      `MongoDB: sala restaurada (${saved.jugadas.length} jugadas, ${saved.team.length} miembros)`,
    )
  }

  httpServer.listen(PORT, HOST, () => {
    if (DIST_PATH) {
      console.log(`App + sync  http://${HOST}:${PORT}`)
      console.log(`WebSocket   ws://${HOST}:${PORT}`)
    } else {
      console.log(`Sync server  ws://${HOST}:${PORT}`)
    }
    console.log(`Sala compartida — jugadas en tiempo real.`)
  })
}

void start()

async function shutdown() {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
    if (isPersistenceEnabled()) await saveRoom(room)
  }
  await closeMongo()
  httpServer.close()
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown())
process.on('SIGINT', () => void shutdown())
