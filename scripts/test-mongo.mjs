/**
 * Prueba la conexión a MongoDB Atlas.
 * Lee credenciales desde local/.env (no se sube al repo).
 *
 *   1. Edita local/.env con USUARIO y CONTRASEÑA de Atlas
 *   2. npm run test:mongo
 */

import { MongoClient, ServerApiVersion } from 'mongodb'
import { loadLocalEnv, localEnvExists, localEnvPath } from '../server/load-local-env.mjs'

function maskUri(uri) {
  try {
    const u = new URL(uri.replace('mongodb+srv://', 'https://').replace('mongodb://', 'http://'))
    const user = u.username || '(sin usuario)'
    return uri.replace(`${u.username}:${u.password}`, `${user}:****`)
  } catch {
    return uri.replace(/:([^:@/]+)@/, ':****@')
  }
}

function parseUserFromUri(uri) {
  try {
    const u = new URL(uri.replace('mongodb+srv://', 'https://').replace('mongodb://', 'http://'))
    return u.username || null
  } catch {
    const m = uri.match(/mongodb(\+srv)?:\/\/([^:]+):/)
    return m?.[2] ?? null
  }
}

function explainError(err) {
  const msg = String(err.message || err)
  if (msg.includes('authentication failed') || msg.includes('bad auth')) {
    return [
      'Autenticación fallida — usuario o contraseña incorrectos.',
      'En Atlas: Security → Database Access → revisa el usuario o crea uno nuevo.',
      'Si reseteas la contraseña, actualiza local/.env con la nueva.',
    ].join('\n  ')
  }
  if (msg.includes('ENOTFOUND') || msg.includes('querySrv')) {
    return 'No se resolvió el host del cluster. Revisa que la URI sea la de Atlas (cluster0.ukwu6uu...).'
  }
  if (msg.includes('IP') || msg.includes('not authorized') || msg.includes('whitelist')) {
    return [
      'Posible bloqueo de red (IP whitelist).',
      'En Atlas: Security → Network Access → Add IP → Allow Access from Anywhere (0.0.0.0/0).',
    ].join('\n  ')
  }
  return msg
}

function placeholderWarning(uri) {
  if (/USUARIO|CONTRASEÑA|PASSWORD|<db_username>|<db_password>/i.test(uri)) {
    return 'placeholders'
  }
  // usuario tipo email sin codificar: user@dominio:pass@cluster...
  if (/mongodb(\+srv)?:\/\/[^/]+@[^/]+:[^/]+@/i.test(uri)) {
    return 'email-at'
  }
  return null
}

async function main() {
  const loaded = loadLocalEnv()

  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB || 'league_planning'

  console.log('\n=== Prueba MongoDB Atlas ===\n')

  if (!localEnvExists()) {
    console.log('Falta local/.env')
    console.log('Copia local/.env.example → local/.env y rellena USUARIO y CONTRASEÑA.\n')
    process.exit(1)
  }

  if (loaded.length) {
    console.log('Variables cargadas desde:', loaded.join(', '))
  }

  if (!uri) {
    console.log('MONGODB_URI vacía en local/.env\n')
    process.exit(1)
  }

  const placeholder = placeholderWarning(uri)
  if (placeholder === 'placeholders') {
    console.log('Aún hay placeholders en local/.env')
    console.log('Edita local/.env y sustituye USUARIO y CONTRASEÑA por los de Atlas.')
    console.log(`Archivo: ${localEnvPath()}\n`)
    process.exit(1)
  }
  if (placeholder === 'email-at') {
    console.log('El usuario parece un email con @ sin codificar.')
    console.log('En la URI, el @ del email debe ser %40. Ejemplo:')
    console.log('  usuario@mail.com  →  usuario%40mail.com')
    console.log(`Archivo: ${localEnvPath()}\n`)
    process.exit(1)
  }

  const user = parseUserFromUri(uri)
  console.log('URI (enmascarada):', maskUri(uri))
  if (user) console.log('Usuario detectado en la URI:', user)
  console.log('Base de datos:', dbName)
  console.log('')

  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
    serverSelectionTimeoutMS: 10000,
  })

  try {
    console.log('Conectando...')
    await client.connect()
    await client.db('admin').command({ ping: 1 })
    console.log('OK — Ping exitoso.\n')

    const db = client.db(dbName)
    const collections = await db.listCollections().toArray()
    console.log(`Colecciones en "${dbName}":`, collections.length ? collections.map((c) => c.name).join(', ') : '(ninguna aún)')

    const room = await db.collection('rooms').findOne({ _id: 'default' })
    if (room) {
      const jugadas = Array.isArray(room.jugadas) ? room.jugadas.length : 0
      const team = Array.isArray(room.team) ? room.team.length : 0
      console.log(`Sala "default": ${jugadas} jugada(s), ${team} miembro(s) de equipo`)
      if (room.updatedAt) console.log('Última actualización:', room.updatedAt)
    } else {
      console.log('Sala "default": aún no existe (se creará al guardar la primera jugada)')
    }

    console.log('\nConexión correcta. Copia MONGODB_URI de local/.env a Render.\n')
    process.exit(0)
  } catch (err) {
    console.error('\nERROR de conexión:\n  ', explainError(err), '\n')
    if (user) console.log('Usuario probado:', user)
    process.exit(1)
  } finally {
    await client.close().catch(() => {})
  }
}

main()
