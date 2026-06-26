/**
 * Inicializa la base league_planning (separada de park-net, admin, etc.)
 * Crea la colección rooms con documento vacío si no existe.
 *
 *   npm run init:mongo
 */

import { MongoClient, ServerApiVersion } from 'mongodb'
import { loadLocalEnv, localEnvExists } from '../server/load-local-env.mjs'

async function main() {
  loadLocalEnv()

  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB || 'league_planning'
  const roomId = process.env.MONGODB_ROOM_ID || 'default'

  if (!localEnvExists() || !uri) {
    console.error('Configura local/.env primero.')
    process.exit(1)
  }

  const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
  })

  try {
    await client.connect()
    await client.db('admin').command({ ping: 1 })

    const { databases } = await client.db('admin').admin().listDatabases()
    const names = databases.map((d) => d.name).sort()
    console.log('\nBases en el cluster:', names.join(', '))

    const db = client.db(dbName)
    const col = db.collection('rooms')

    const existing = await col.findOne({ _id: roomId })
    if (existing) {
      const jugadas = Array.isArray(existing.jugadas) ? existing.jugadas.length : 0
      console.log(`\n"${dbName}.rooms" ya existe (sala "${roomId}": ${jugadas} jugadas).`)
      console.log('Nada que hacer.\n')
      return
    }

    const now = new Date()
    await col.insertOne({
      _id: roomId,
      jugadas: [],
      activeId: null,
      team: [],
      lastEditBy: null,
      lastEditAt: null,
      lastEditAction: null,
      createdAt: now,
      updatedAt: now,
    })

    const after = await client.db('admin').admin().listDatabases()
    const nowHas = after.databases.some((d) => d.name === dbName)

    console.log(`\nInicializado:`)
    console.log(`  Base de datos: ${dbName}${nowHas ? ' (nueva en el cluster)' : ''}`)
    console.log(`  Colección: rooms`)
    console.log(`  Documento: _id "${roomId}" (sala vacía)`)
    console.log('\nListo. Al usar la app, las jugadas se guardarán ahí.\n')
  } catch (err) {
    console.error('\nError:', err.message, '\n')
    process.exit(1)
  } finally {
    await client.close()
  }
}

main()
