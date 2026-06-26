import { MAP_SRC } from './types'

export const BOOT_STORAGE_KEY = 'lol-planning-boot-v1'
export { APP_ICON_SRC } from './types'

export const MIN_SPLASH_MS = 750
export const EXIT_MS = 1000

export function isBootCached(): boolean {
  try {
    return sessionStorage.getItem(BOOT_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function markBootCached(): void {
  try {
    sessionStorage.setItem(BOOT_STORAGE_KEY, '1')
  } catch {
    /* ignore */
  }
}

/** Quita el splash estático de index.html cuando React toma el control. */
export function takeOverBootShell(): void {
  document.getElementById('boot-splash')?.remove()
}

/** Revela la app tras la animación de salida del boot. */
export function dismissBootShell(): void {
  document.documentElement.classList.remove('boot-pending')
  document.documentElement.classList.add('boot-done')
  document.getElementById('boot-splash')?.remove()
}

export function preloadMapImage(src = MAP_SRC): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = () => reject(new Error(`Failed to load ${src}`))
    img.src = src
  })
}
