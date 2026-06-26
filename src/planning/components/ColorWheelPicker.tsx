import { useCallback, useEffect, useRef, useState } from 'react'

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const raw = hex.replace('#', '')
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw.padEnd(6, '0').slice(0, 6)
  const r = parseInt(full.slice(0, 2), 16) / 255
  const g = parseInt(full.slice(2, 4), 16) / 255
  const b = parseInt(full.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : d / max
  return { h, s, v: max }
}

export function hsvToHex(h: number, s: number, v: number): string {
  const hh = ((h % 360) + 360) % 360
  const c = v * s
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (hh < 60) [r, g, b] = [c, x, 0]
  else if (hh < 120) [r, g, b] = [x, c, 0]
  else if (hh < 180) [r, g, b] = [0, c, x]
  else if (hh < 240) [r, g, b] = [0, x, c]
  else if (hh < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const toByte = (n: number) => Math.round((n + m) * 255)
    .toString(16)
    .padStart(2, '0')
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`
}

const PRESETS = ['#f0e6d2', '#ffffff', '#ff4d4d', '#4ade80', '#38bdf8', '#facc15', '#a78bfa']

interface ColorWheelPickerProps {
  color: string
  onChange: (hex: string) => void
}

export function ColorWheelPicker({ color, onChange }: ColorWheelPickerProps) {
  const [open, setOpen] = useState(false)
  const [hsv, setHsv] = useState(() => hexToHsv(color))
  const rootRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const svRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<'ring' | 'sv' | null>(null)

  useEffect(() => {
    setHsv(hexToHsv(color))
  }, [color])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const commit = useCallback(
    (patch: Partial<{ h: number; s: number; v: number }>) => {
      setHsv((prev) => {
        const next = { ...prev, ...patch }
        onChange(hsvToHex(next.h, next.s, next.v))
        return next
      })
    },
    [onChange],
  )

  const pickHue = useCallback(
    (clientX: number, clientY: number) => {
      const el = ringRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const angle = Math.atan2(clientY - cy, clientX - cx)
      const h = ((angle * 180) / Math.PI + 90 + 360) % 360
      commit({ h })
    },
    [commit],
  )

  const pickSv = useCallback(
    (clientX: number, clientY: number) => {
      const el = svRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const s = clamp((clientX - rect.left) / rect.width, 0, 1)
      const v = clamp(1 - (clientY - rect.top) / rect.height, 0, 1)
      commit({ s, v })
    },
    [commit],
  )

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (dragRef.current === 'ring') pickHue(e.clientX, e.clientY)
      if (dragRef.current === 'sv') pickSv(e.clientX, e.clientY)
    }
    const onUp = () => {
      dragRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [pickHue, pickSv])

  const hueDeg = hsv.h
  const svLeft = `${hsv.s * 100}%`
  const svTop = `${(1 - hsv.v) * 100}%`
  const ringHue = hsvToHex(hsv.h, 1, 1)
  const ringMarkerAngle = hueDeg - 90

  return (
    <div className="color-wheel" ref={rootRef}>
      <button
        type="button"
        className="color-wheel__trigger"
        style={{ background: color }}
        title="Color del trazo"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      />
      {open && (
        <div className="color-wheel__popover" onClick={(e) => e.stopPropagation()}>
          <div
            ref={ringRef}
            className="color-wheel__ring"
            onPointerDown={(e) => {
              dragRef.current = 'ring'
              pickHue(e.clientX, e.clientY)
            }}
          >
            <div
              className="color-wheel__ring-marker"
              style={{ transform: `rotate(${ringMarkerAngle}deg) translateY(-61px)` }}
            >
              <span style={{ background: ringHue }} />
            </div>
            <div className="color-wheel__sv-wrap">
              <div
                ref={svRef}
                className="color-wheel__sv"
                style={{ backgroundColor: ringHue }}
                onPointerDown={(e) => {
                  dragRef.current = 'sv'
                  pickSv(e.clientX, e.clientY)
                }}
              >
                <span
                  className="color-wheel__sv-marker"
                  style={{ left: svLeft, top: svTop, background: color }}
                />
              </div>
            </div>
          </div>
          <div className="color-wheel__footer">
            <span className="color-wheel__hex">{color}</span>
            <div className="color-wheel__presets">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`color-wheel__preset ${preset === color ? 'color-wheel__preset--on' : ''}`}
                  style={{ background: preset }}
                  title={preset}
                  onClick={() => commit(hexToHsv(preset))}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
