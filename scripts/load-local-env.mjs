import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

/** Rutas de .env en orden de prioridad (la última no sobrescribe vars ya definidas). */
const ENV_FILES = [
  path.join(ROOT, 'local', '.env'),
  path.join(ROOT, '.env'),
]

function parseLine(line) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return null
  const eq = trimmed.indexOf('=')
  if (eq <= 0) return null
  const key = trimmed.slice(0, eq).trim()
  let val = trimmed.slice(eq + 1).trim()
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1)
  }
  return { key, val }
}

/** Carga local/.env (y .env raíz si existe). local/.env siempre gana sobre el entorno previo. */
export function loadLocalEnv() {
  const loaded = []

  for (let i = 0; i < ENV_FILES.length; i++) {
    const envPath = ENV_FILES[i]
    if (!fs.existsSync(envPath)) continue

    const override = i === 0 // local/.env manda sobre vars del shell

    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
      const parsed = parseLine(line)
      if (!parsed) continue
      if (override || process.env[parsed.key] === undefined) {
        process.env[parsed.key] = parsed.val
      }
    }
    loaded.push(path.relative(ROOT, envPath))
  }

  return loaded
}

export function localEnvPath() {
  return path.join(ROOT, 'local', '.env')
}

export function localEnvExists() {
  return fs.existsSync(localEnvPath())
}
