import { MongoClient, ServerApiVersion } from 'mongodb'

const URI = process.env.MONGODB_URI
const DB_NAME = process.env.MONGODB_DB || 'league_planning'
const ROOM_ID = process.env.MONGODB_ROOM_ID || 'default'
const COLLECTION = 'rooms'

/** @type {import('mongodb').MongoClient | null} */
let client = null
/** @type {import('mongodb').Collection | null} */
let collection = null
let status = 'disabled'

export function getMongoStatus() {
  return status
}

export function isPersistenceEnabled() {
  return status === 'connected'
}

export async function connectMongo() {
  if (!URI) {
    console.log('MongoDB: desactivado (define MONGODB_URI para persistencia)')
    status = 'disabled'
    return false
  }

  try {
    client = new MongoClient(URI, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    })
    await client.connect()
    await client.db('admin').command({ ping: 1 })
    collection = client.db(DB_NAME).collection(COLLECTION)
    status = 'connected'
    console.log(`MongoDB: conectado (${DB_NAME}/${COLLECTION}, sala "${ROOM_ID}")`)
    return true
  } catch (err) {
    status = 'error'
    console.error('MongoDB: no se pudo conectar — modo solo memoria:', err.message)
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
