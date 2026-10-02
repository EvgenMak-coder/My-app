import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DataGate, formatDate, Panel } from '../../components/ui'
import type { HistoryPoint, Snapshot } from '../../data/types'
import { RANKS, rankFor } from '../../game/ranks'
import { stageProgress, totalXp } from '../../game/xp'

const tooltipStyle = {
  background: 'var(--surface-solid)',
  border: '1px solid var(--line)',
  borderRadius: 3,
  color: 'var(--text)',
}

function TimeChart({ data, domain }: { data: { at: string; value: number }[]; domain?: [number, number] }) {
  if (data.length < 2) {
    return <p className="muted">Нужно хотя бы два изменения, чтобы нарисовать линию роста.</p>
  }
  return (
    <div className="chart">
      <ResponsiveContainer>
        <LineChart data={data.map((d) => ({ ...d, label: formatDate(d.at) }))} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'var(--text-dim)', fontSize: 12 }} stroke="var(--line)" />
          <YAxis domain={domain} tick={{ fill: 'var(--text-dim)', fontSize: 12 }} stroke="var(--line)" />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="value" name="Значение" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

const byTime = (a: { at: string }, b: { at: string }) => a.at.localeCompare(b.at)

function Stats({ snapshot }: { snapshot: Snapshot }) {
  const targets = [
    ...snapshot.areas.map((a) => ({ id: a.id, label: `Сфера: ${a.name}`, history: snapshot.areaHistory })),
    ...snapshot.titans.map((t) => ({ id: t.id, label: `Титан: ${t.name}`, history: snapshot.titanHistory })),
    ...[...snapshot.skills]
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
      .map((s) => ({ id: s.id, label: s.name, history: snapshot.skillHistory })),
  ]
  const [selected, setSelected] = useState(targets[0]?.id ?? '')
  const target = targets.find((t) => t.id === selected) ?? targets[0]
  const history: HistoryPoint[] = target ? target.history.filter((h) => h.refId === target.id).sort(byTime) : []

  const xp = totalXp(snapshot.xpEvents)
  let running = 0
  const xpLine = [...snapshot.xpEvents].sort(byTime).map((e) => ({ at: e.at, value: (running += e.amount) }))

  const average = snapshot.skills.length
    ? Math.round(snapshot.skills.reduce((sum, s) => sum + s.value, 0) / snapshot.skills.length)
    : 0
  const rankCounts = RANKS.map((r) => ({
    rank: r,
    count: snapshot.skills.filter((s) => rankFor(s.value).key === r.key).length,
  }))

  return (
    <>
      <h1>Статистика</h1>
      <div className="stat-tiles">
        <div className="tile">
          <b>{xp}</b>
          <span className="muted">ци всего</span>
        </div>
        <div className="tile">
          <b>{stageProgress(xp).stage.name}</b>
          <span className="muted">стадия</span>
        </div>
        <div className="tile">
          <b>{snapshot.skills.length}</b>
          <span className="muted">навыков</span>
        </div>
        <div className="tile">
          <b>{average}</b>
          <span className="muted">средний уровень</span>
        </div>
      </div>

      <Panel title="Навыки по рангам">
        <ul className="list">
          {rankCounts.map(({ rank, count }) => (
            <li key={rank.key} className="row">
              <span className={`badge ${rank.key}`}>{rank.name}</span>
              <span className="grow muted">{rank.plain}</span>
              <span className="num">{count}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Накопленный опыт">
        <TimeChart data={xpLine} />
      </Panel>

      <Panel title="История роста">
        {targets.length === 0 ? (
          <p className="muted">Нет данных.</p>
        ) : (
          <>
            <select value={target?.id} onChange={(e) => setSelected(e.target.value)} aria-label="Что показать">
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <TimeChart data={history} domain={[0, 100]} />
          </>
        )}
      </Panel>
    </>
  )
}

export function StatsPage() {
  return <DataGate>{(snapshot) => <Stats snapshot={snapshot} />}</DataGate>
}
