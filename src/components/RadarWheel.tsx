import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts'
import type { LifeArea } from '../data/types'

interface TickProps {
  x?: number
  y?: number
  cx?: number
  cy?: number
  payload?: { value: string }
}

export function RadarWheel({ areas }: { areas: LifeArea[] }) {
  const data = areas.map((a) => ({ name: a.name, value: a.value }))
  const valueOf = (name: string) => areas.find((a) => a.name === name)?.value ?? 0

  // подпись сферы: название и крупное значение, отодвинутые от вершины наружу
  const tick = ({ x = 0, y = 0, cx = 0, cy = 0, payload }: TickProps) => {
    const name = payload?.value ?? ''
    const dx = x - cx
    const dy = y - cy
    const d = Math.hypot(dx, dy) || 1
    const tx = x + (dx / d) * 22
    const ty = y + (dy / d) * 22
    return (
      <g className="wheel-label">
        <text x={tx} y={ty - 4} textAnchor="middle" className="name">
          {name}
        </text>
        <text x={tx} y={ty + 16} textAnchor="middle" className="value">
          {valueOf(name)}
        </text>
      </g>
    )
  }

  return (
    <div className="chart radar">
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="66%">
          <PolarGrid stroke="var(--accent)" strokeOpacity={0.22} />
          <PolarAngleAxis dataKey="name" tick={tick} />
          <PolarRadiusAxis domain={[0, 100]} tickCount={5} tick={false} axisLine={false} />
          <Radar
            dataKey="value"
            stroke="var(--accent-bright)"
            fill="var(--accent)"
            fillOpacity={0.28}
            strokeWidth={2}
            isAnimationActive={false}
            dot={{ r: 4, fill: 'var(--accent-bright)', stroke: 'none' }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
