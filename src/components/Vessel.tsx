import { useId } from 'react'
import type { GoalLevel } from '../game/goals'

/** Контуры сосудов в поле 100×100 */
const SHAPES: Record<GoalLevel['key'], string> = {
  // звезда-шар
  star: 'M 50 10 A 40 40 0 1 1 49.9 10 Z',
  // облако
  heaven: 'M 24 76 C 6 76 4 52 21 48 C 20 28 46 19 57 34 C 68 24 88 33 84 50 C 98 55 95 76 78 76 Z',
  // гора с двумя вершинами
  mountain: 'M 5 90 L 34 30 L 48 50 L 64 12 L 95 90 Z',
  // тыква-горлянка
  earth:
    'M 50 8 C 43 8 41 16 44 22 C 32 26 30 42 40 48 C 18 55 15 90 50 92 C 85 90 82 55 60 48 C 70 42 68 26 56 22 C 59 16 57 8 50 8 Z',
  // капля
  river: 'M 50 6 C 50 6 20 46 20 64 C 20 82 34 94 50 94 C 66 94 80 82 80 64 C 80 46 50 6 50 6 Z',
}

/** Верх и низ внутренней полости — между ними ходит уровень жидкости */
const BOUNDS: Record<GoalLevel['key'], [number, number]> = {
  star: [10, 90],
  heaven: [24, 76],
  mountain: [12, 90],
  earth: [8, 92],
  river: [6, 94],
}

// две волны разной длины, сдвигаются по кругу — см. keyframes vessel-wave
const WAVE = 'M 0 0 Q 12.5 -5 25 0 T 50 0 T 75 0 T 100 0 T 125 0 T 150 0 T 175 0 T 200 0 V 120 H 0 Z'

/** Сосуд цели: контур по уровню важности, внутри жидкость до отметки progress (0–100). */
export function Vessel({ shape, progress, color }: { shape: GoalLevel['key']; progress: number; color: string }) {
  const id = useId()
  const [top, bottom] = BOUNDS[shape]
  const level = bottom - ((bottom - top) * Math.min(100, Math.max(0, progress))) / 100

  return (
    <svg className="vessel" viewBox="0 0 100 100" style={{ color }} aria-hidden="true">
      <defs>
        <clipPath id={id}>
          <path d={SHAPES[shape]} />
        </clipPath>
      </defs>

      {shape === 'star' && (
        <g className="vessel-rays">
          <path d="M 50 0 V 6 M 50 94 V 100 M 0 50 H 6 M 94 50 H 100 M 15 15 L 19 19 M 81 81 L 85 85 M 85 15 L 81 19 M 19 81 L 15 85" />
        </g>
      )}

      <path className="vessel-glass" d={SHAPES[shape]} />
      <g clipPath={`url(#${id})`}>
        <g className="vessel-level" style={{ transform: `translateY(${level}px)` }}>
          <path className="vessel-wave back" d={WAVE} />
          <path className="vessel-wave" d={WAVE} />
        </g>
      </g>
      <path className="vessel-rim" d={SHAPES[shape]} />
    </svg>
  )
}
