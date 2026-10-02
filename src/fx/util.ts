export interface Palette {
  accent: string
  bright: string
  deep: string
}

/** '#rrggbb' + прозрачность → 'rgba(r,g,b,a)' */
export function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

export const rand = (min: number, max: number): number => min + Math.random() * (max - min)

export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v))

export const lerp = (a: number, b: number, k: number): number => a + (b - a) * k

/** Мягкое светящееся пятно; рисуется через drawImage — это намного дешевле градиента на каждую частицу. */
export function glowSprite(color: string, size = 64): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')!
  const r = size / 2
  const grad = g.createRadialGradient(r, r, 0, r, r, r)
  grad.addColorStop(0, rgba(color, 1))
  grad.addColorStop(0.4, rgba(color, 0.45))
  grad.addColorStop(1, rgba(color, 0))
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  return canvas
}

export const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
