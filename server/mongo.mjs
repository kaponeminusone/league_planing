import { MongoClient, ServerApiVersion } from 'mongodb'

const DB_NAME = process.env.MONGODB_DB || 'league_planning'
const ROOM_ID = process.env.MONGODB_ROOM_ID || 'default'
const COLLECTION = 'rooms'
const DEFAULT_HOST = 'cluster0.ukwu6uu.mongodb.net'

/** @type {import('mongodb').MongoClient | null} */
let client = null
/** @type {import('mongodb').Collection | null} */
let collection = null
let status = 'disabled'
let lastError = null
let uriSource = null

function maskUri(uri) {
  return uri.replace(/:([^:@/]+)@/, ':****@')
}

/**
 * URI completa (MONGODB_URI) o construida con user/pass/host (recomendado en Render).
 * @see https://render.com/docs/connect-to-mongodb-atlas
 */
export function resolveMongoUri() {
  const direct = process.env.MONGODB_URI?.trim()
  if (direct) {
    uriSource = 'MONGODB_URI'
    return direct
  }

  const user = process.env.MONGODB_USER?.trim()
  const pass = process.env.MONGODB_PASSWORD
  const host = process.env.MONGODB_HOST?.trim() || DEFAULT_HOST

  if (user && pass) {
    uriSource = 'MONGODB_USER/PASSWORD'
    const encodedUser = encodeURIComponent(user)
    const encodedPass = encodeURIComponent(pass)
    return `mongodb+srv://${encodedUser}:${encodedPass}@${host}/?retryWrites=true&w=majority&appName=Cluster0`
  }

  uriSource = null
  return null
}

export function getMongoStatus() {
  return status
}

export function getMongoDiagnostics() {
  return {
    status,
    db: DB_NAME,
    roomId: ROOM_ID,
    uriSource,
    lastError,
    hint:
      status === 'error' && lastError && /ssl|tls|alert internal/i.test(lastError)
        ? 'Atlas Network Access: añade 0.0.0.0/0 o las IPs de salida de Render. Ver render.com/docs/connect-to-mongodb-atlas'
        : null,
  }
}

export function isPersistenceEnabled() {
  return status === 'connected'
}

export async function connectMongo() {
  const uri = resolveMongoUri()
  if (!uri) {
    console.log(
      'MongoDB: desactivado (define MONGODB_URI o MONGODB_USER + MONGODB_PASSWORD en Render)',
    )
    status = 'disabled'
    lastError = null
    return false
  }

  console.log(`MongoDB: conectando (${uriSource}, db=${DB_NAME}, user=${maskUri(uri).split('://')[1]?.split(':')[0] ?? '?'})…`)

  try {
    client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: false,
        deprecationErrors: true,
      },
      serverSelectionTimeoutMS: 20000,
      connectTimeoutMS: 20000,
      autoSelectFamily: false,
    })
    await client.connect()
    await client.db('admin').command({ ping: 1 })
    collection = client.db(DB_NAME).collection(COLLECTION)
    status = 'connected'
    lastError = null
    console.log(`MongoDB: conectado (${DB_NAME}/${COLLECTION}, sala "${ROOM_ID}")`)
    return true
  } catch (err) {
    status = 'error'
    lastError = err.message || String(err)
    console.error('MongoDB: no se pudo conectar — modo solo memoria:', lastError)

    if (/ssl|tls|alert internal/i.test(lastError)) {
      console.error(`
MongoDB TLS en Render — casi siempre es Atlas → Network Access:
  1. Atlas → Security → Network Access → Add IP Address
  2. "Allow Access from Anywhere" (0.0.0.0/0) — Render no tiene IP fija en plan free
     o añade las outbound IPs de tu servicio: render.com/docs/outbound-ip-addresses
  3. Espera 1–2 min y redeploy
Guía: render.com/docs/connect-to-mongodb-atlas
`)
    } else if (/auth|authentication/i.test(lastError)) {
      console.error(
        'MongoDB auth: revisa usuario/contraseña. En Render usa MONGODB_USER + MONGODB_PASSWORD (evita caracteres sin codificar en la URI).',
      )
    }

    if (client) {
      await client.close().catch(() => {})
      client = null
    }
    return false
  }
}

/** @typedef {{ jugadas: object[]; activeId: string | null; team: object[]; lastEditBy: string | null; lastEditAt: string | null; lastEditAction: string | null }} RoomState */

/** @returns {Promise<RoomState | null>} */
export async function loadRoom() {
  if (!collection) return null

  try {
    const doc = await collection.findOne({ _id: ROOM_ID })
    if (!doc) return null

    return {
      jugadas: Array.isArray(doc.jugadas) ? doc.jugadas : [],
      activeId: doc.activeId ?? null,
      team: Array.isArray(doc.team) ? doc.team : [],
      lastEditBy: doc.lastEditBy ?? null,
      lastEditAt: doc.lastEditAt ?? null,
      lastEditAction: doc.lastEditAction ?? null,
    }
  } catch (err) {
    console.error('MongoDB: error al cargar sala:', err.message)
    return null
  }
}

/** @param {RoomState} room */
export async function saveRoom(room) {
  if (!collection) return

  try {
    await collection.updateOne(
      { _id: ROOM_ID },
      {
        $set: {
          jugadas: room.jugadas,
          activeId: room.activeId,
          team: room.team,
          lastEditBy: room.lastEditBy,
          lastEditAt: room.lastEditAt,
          lastEditAction: room.lastEditAction,
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    )
  } catch (err) {
    console.error('MongoDB: error al guardar sala:', err.message)
  }
}

export async function closeMongo() {
  if (!client) return
  try {
    await client.close()
    console.log('MongoDB: conexión cerrada')
  } catch {
    /* ignore */
  } finally {
    client = null
    collection = null
    if (status === 'connected') status = 'disabled'
  }
}
