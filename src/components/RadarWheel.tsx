import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts'
import type { LifeArea } from '../data/types'

export function RadarWheel({ areas }: { areas: LifeArea[] }) {
  const data = areas.map((a) => ({ name: a.name, value: a.value }))
  return (
    <div className="chart">
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="60%">
          <PolarGrid stroke="var(--line)" />
          <PolarAngleAxis dataKey="name" tick={{ fill: 'var(--text)', fontSize: 13 }} />
          <PolarRadiusAxis domain={[0, 100]} tickCount={5} tick={false} axisLine={false} />
          <Radar dataKey="value" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.3} strokeWidth={2} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
