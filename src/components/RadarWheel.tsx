import type { LifeArea } from '../data/types'

const WIDTH = 400
const HEIGHT = 360
const CX = WIDTH / 2
const CY = HEIGHT / 2
const RADIUS = 118
const RINGS = [20, 40, 60, 80, 100]

/** Колесо жизни: паутинка сфер, значение 0–100 откладывается от центра. Нарисовано своим SVG, без библиотек. */
export function RadarWheel({ areas }: { areas: LifeArea[] }) {
  const count = Math.max(1, areas.length)
  // первая сфера — вверху, дальше по часовой стрелке
  const point = (i: number, value: number): [number, number] => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / count
    const r = (RADIUS * value) / 100
    return [CX + Math.cos(a) * r, CY + Math.sin(a) * r]
  }
  const ring = (value: number): string => areas.map((_, i) => point(i, value).join(',')).join(' ')

  return (
    <div className="chart radar">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Колесо жизни">
        <g className="wheel-grid">
          {RINGS.map((value) => (
            <polygon key={value} points={ring(value)} />
          ))}
          {areas.map((a, i) => {
            const [x, y] = point(i, 100)
            return <line key={a.id} x1={CX} y1={CY} x2={x} y2={y} />
          })}
        </g>
        <polygon className="wheel-shape" points={areas.map((a, i) => point(i, a.value).join(',')).join(' ')} />
        {areas.map((a, i) => {
          const [x, y] = point(i, a.value)
          return <circle key={a.id} className="wheel-dot" cx={x} cy={y} r={4} />
        })}
        {areas.map((a, i) => {
          // подпись сферы: название и крупное значение, отодвинутые от вершины наружу
          const [x, y] = point(i, 100 + (22 * 100) / RADIUS)
          return (
            <g key={a.id} className="wheel-label">
              <text x={x} y={y - 4} textAnchor="middle" className="name">
                {a.name}
              </text>
              <text x={x} y={y + 16} textAnchor="middle" className="value">
                {a.value}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
