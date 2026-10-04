import { useState, type FormEvent } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Dragon } from '../../components/Dragon'
import { DataGate, formatDate, Panel } from '../../components/ui'
import { addDeed } from '../../data/actions'
import { useAction } from '../../data/hooks'
import type { HistoryPoint, Snapshot } from '../../data/types'
import { RANKS, rankFor } from '../../game/ranks'
import { STAGES, stageProgress, totalXp } from '../../game/xp'

const DEED_REWARDS = [10, 25, 50, 100]

function DeedForm() {
  const [note, setNote] = useState('')
  const [amount, setAmount] = useState(DEED_REWARDS[0])
  const add = useAction((store, a: { note: string; amount: number }) => addDeed(store, a.note, a.amount))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!note.trim()) return
    add.mutate({ note, amount }, { onSuccess: () => setNote('') })
  }

  return (
    <form className="row wrap" onSubmit={submit}>
      <input className="grow" type="text" placeholder="Что сделано?" value={note} onChange={(e) => setNote(e.target.value)} />
      <select value={amount} onChange={(e) => setAmount(Number(e.target.value))} aria-label="Награда">
        {DEED_REWARDS.map((r) => (
          <option key={r} value={r}>
            +{r} ци
          </option>
        ))}
      </select>
      <button type="submit" disabled={add.isPending || !note.trim()}>
        Записать
      </button>
    </form>
  )
}

/** Все стадии дракона: нажатие показывает облик стадии. */
function DragonPath({ xp }: { xp: number }) {
  const progress = stageProgress(xp)
  // null — показываем настоящую стадию
  const [preview, setPreview] = useState<number | null>(null)
  const previewing = preview !== null && preview !== progress.index
  const shown = previewing ? preview : progress.index

  return (
    <Panel title="Путь дракона">
      <div className="path-preview">
        <Dragon level={shown} ratio={previewing ? 0 : progress.ratio} label={`Дракон, стадия «${STAGES[shown].name}»`} />
        <p className="stage">
          {previewing ? 'Облик стадии' : 'Сейчас — стадия'} {shown + 1} из {STAGES.length} · {STAGES[shown].name}
        </p>
        <p className="muted">{STAGES[shown].note}</p>
      </div>
      <p className="muted">Нажми на стадию, чтобы увидеть её облик. Дракон подрастает и внутри стадии.</p>
      <ol className="path">
        {STAGES.map((s, i) => (
          <li key={s.key}>
            <button
              className={i === progress.index ? 'current' : i < progress.index ? 'passed' : ''}
              aria-pressed={i === shown}
              onClick={() => setPreview(i === progress.index ? null : i)}
            >
              <span className="num">{i + 1}</span>
              <span className="grow">
                {s.name}
                <small>{s.note}</small>
              </span>
              <span className="num muted">{s.from} ци</span>
            </button>
          </li>
        ))}
      </ol>
    </Panel>
  )
}

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
  const recent = [...snapshot.xpEvents].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10)
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

      <DragonPath xp={xp} />

      <Panel title="Деяния">
        <DeedForm />
        {recent.length === 0 ? (
          <p className="muted">Пока пусто. Опыт (ци) приходит за рост навыков, сфер и записанные деяния.</p>
        ) : (
          <ul className="list">
            {recent.map((e) => (
              <li key={e.id} className="row">
                <span className="grow">{e.note || 'Деяние'}</span>
                <span className="muted">{formatDate(e.at)}</span>
                <span className="num">+{e.amount}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

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
