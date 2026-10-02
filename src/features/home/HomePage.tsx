import { useEffect, useState, type FormEvent } from 'react'
import { Dragon } from '../../components/Dragon'
import { RadarWheel } from '../../components/RadarWheel'
import { Bar, DataGate, formatDate, Panel } from '../../components/ui'
import { addDeed, changeArea } from '../../data/actions'
import { useAction } from '../../data/hooks'
import type { LifeArea, Snapshot } from '../../data/types'
import { STAGES, stageProgress, totalXp } from '../../game/xp'

const DEED_REWARDS = [10, 25, 50, 100]

function AreaRow({ area, locked = false }: { area: LifeArea; locked?: boolean }) {
  const [value, setValue] = useState(area.value)
  const change = useAction((store, v: number) => changeArea(store, area, v))

  useEffect(() => setValue(area.value), [area.value])

  const commit = () => {
    if (value !== area.value) change.mutate(value)
  }

  return (
    <li>
      <div className="row">
        <span className="grow">
          {area.name}
          {locked && <small className="muted"> · по титанам</small>}
        </span>
        <span className="num">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        aria-label={area.name}
        disabled={locked}
        onChange={(e) => setValue(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
    </li>
  )
}

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
      <input
        className="grow"
        type="text"
        placeholder="Что сделано?"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
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

function Home({ snapshot }: { snapshot: Snapshot }) {
  const xp = totalXp(snapshot.xpEvents)
  const progress = stageProgress(xp)
  // можно заглянуть в облик любой стадии; null — показываем настоящую
  const [preview, setPreview] = useState<number | null>(null)
  const previewing = preview !== null && preview !== progress.index
  const shown = previewing ? preview : progress.index
  const recent = [...snapshot.xpEvents].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5)

  return (
    <>
      <section className="hero">
          <span className="kanji" aria-hidden="true">
            天龍之道
          </span>
          <Dragon
            level={shown}
            ratio={previewing ? 0 : progress.ratio}
            label={`Дракон, стадия «${STAGES[shown].name}»`}
          />
          <h1>{snapshot.profile.dragonName}</h1>
          <p className="stage">
            {previewing ? 'Облик стадии' : 'Стадия'} {shown + 1} из {STAGES.length} · {STAGES[shown].name}
          </p>
          <p className="muted">{STAGES[shown].note}</p>
          <div style={{ width: 'min(100%, 520px)' }}>
            <Bar value={progress.ratio * 100} gold />
          </div>
          <p className="muted num">
            {progress.next
              ? `${xp} / ${progress.next.from} ци — до стадии «${progress.next.name}»`
              : `${xp} ци — вершина пути`}
          </p>
      </section>

      <Panel title="Путь дракона">
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

      <Panel title="Колесо жизни" className="wheel">
        <RadarWheel areas={snapshot.areas} />
        <ul className="list">
          {snapshot.areas.map((a) => (
            <AreaRow key={a.id} area={a} locked={a.key === 'sport'} />
          ))}
        </ul>
      </Panel>
    </>
  )
}

export function HomePage() {
  return <DataGate>{(snapshot) => <Home snapshot={snapshot} />}</DataGate>
}
