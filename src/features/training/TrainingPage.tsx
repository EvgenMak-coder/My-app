import { lazy, Suspense, useState, type FormEvent } from 'react'
import { Bar, DataGate, formatDate, Panel } from '../../components/ui'
import { logWorkout, type WorkoutInput } from '../../data/actions'
import { useAction } from '../../data/hooks'
import type { Snapshot, Titan } from '../../data/types'
import { averageTitan, MATERIALS, materialProgress, TITAN_HEROES, XP_PER_TITAN_POINT } from '../../game/titans'

// three.js весит заметно — грузим витрину только на этой странице
const TitanCarousel = lazy(() => import('../../components/TitanCarousel'))

const heroOf = (titan: Titan): string => TITAN_HEROES[titan.key]?.hero ?? titan.name

/** Подпись под витриной: кто выбран, из чего отлит и сколько до следующего материала. */
function TitanInfo({ titan }: { titan: Titan }) {
  const progress = materialProgress(titan.value)
  const info = TITAN_HEROES[titan.key]
  const span = progress.next ? progress.next.from - progress.material.from : 100 - progress.material.from
  const inStage = span ? ((titan.value - progress.material.from) / span) * 100 : 100

  return (
    <div className={`titan-info ${progress.material.key}`}>
      <h2>{heroOf(titan)}</h2>
      <p className="muted">
        {info ? `${info.title} · ` : ''}
        {titan.name}
      </p>
      <div className="row">
        <span className="titan-material">{progress.material.name}</span>
        <span className="grow" />
        <span className="titan-value num">{titan.value}</span>
      </div>
      <Bar value={inStage} />
      <p className="muted num">
        {progress.next ? `до «${progress.next.name}» — ${progress.left}` : 'Вершина: нефритовый титан'}
      </p>
      <ol className="titan-steps" aria-label="Материалы">
        {MATERIALS.map((m, i) => (
          <li key={m.key} className={`${m.key} ${i <= progress.index ? 'reached' : ''}`} title={`${m.name} — с ${m.from}`} />
        ))}
      </ol>
    </div>
  )
}

const today = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Тренировка записывается тому титану, который сейчас стоит в центре витрины. */
function WorkoutForm({ snapshot, titan }: { snapshot: Snapshot; titan: Titan }) {
  const [date, setDate] = useState(today)
  const [type, setType] = useState('')
  const [result, setResult] = useState('')
  const [gain, setGain] = useState('1')
  const log = useAction((store, input: WorkoutInput) => logWorkout(store, snapshot, input))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!type.trim()) return
    log.mutate(
      // полдень, чтобы дата не съехала на соседний день из-за часового пояса
      { titanId: titan.id, type, result, gain: Number(gain) || 0, at: new Date(`${date}T12:00:00`).toISOString() },
      {
        onSuccess: () => {
          setType('')
          setResult('')
        },
      },
    )
  }

  return (
    <form className="workout-form" onSubmit={submit}>
      <p className="wide workout-target">
        <span className="muted">Тренировка для титана: </span>
        <b>
          {heroOf(titan)} · {titan.name}
        </b>
      </p>
      <label>
        <span className="muted">Дата</span>
        <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <label>
        <span className="muted">Прибавка</span>
        <input type="number" min={0} max={20} value={gain} onChange={(e) => setGain(e.target.value)} />
      </label>
      <label className="wide">
        <span className="muted">Тип</span>
        <input type="text" placeholder="Бассейн, турник, бег…" value={type} onChange={(e) => setType(e.target.value)} />
      </label>
      <label className="wide">
        <span className="muted">Результат</span>
        <input type="text" placeholder="1 км за 25 минут" value={result} onChange={(e) => setResult(e.target.value)} />
      </label>
      <button className="wide" type="submit" disabled={log.isPending || !type.trim()}>
        Записать
      </button>
      {log.error && <p className="error wide">{(log.error as Error).message}</p>}
    </form>
  )
}

function Training({ snapshot }: { snapshot: Snapshot }) {
  const titans = [...snapshot.titans].sort((a, b) => a.position - b.position)
  const [chosen, setChosen] = useState(0)
  const index = Math.min(chosen, titans.length - 1)
  const titan = titans[index]
  const names = new Map(snapshot.titans.map((t) => [t.id, TITAN_HEROES[t.key]?.hero ?? t.name]))
  const journal = [...snapshot.workouts].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30)

  return (
    <>
      <h1>Тренировки</h1>
      <p className="muted">
        Средний показатель — {averageTitan(titans)}: он же сфера «Спорт» в Колесе жизни. Статуэтка титана отлита из его
        материала и меняет его каждые 20 пунктов.
      </p>

      <section className="titan-stage">
        <Suspense fallback={<div className="carousel loading muted">Статуэтки выходят из тени…</div>}>
          <TitanCarousel
            statues={titans.map((t) => ({ key: t.key, material: materialProgress(t.value).material.key }))}
            index={index}
            onIndex={setChosen}
            label={`Статуэтки титанов, выбран ${heroOf(titan)}`}
          />
        </Suspense>
        <p className="muted carousel-hint">Листай вправо и влево — титан в центре выбран.</p>
        <TitanInfo titan={titan} />
        <div className="titan-picker" role="tablist" aria-label="Титаны">
          {titans.map((t, i) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={i === index}
              className={materialProgress(t.value).material.key}
              onClick={() => setChosen(i)}
            >
              <span aria-hidden="true">{TITAN_HEROES[t.key]?.glyph ?? '武'}</span>
              <small>{heroOf(t)}</small>
              <b className="num">{t.value}</b>
            </button>
          ))}
        </div>
      </section>

      <Panel title="Журнал тренировок">
        <WorkoutForm snapshot={snapshot} titan={titan} />
        <p className="muted">
          Прибавка — на сколько пунктов вырос показатель; каждый пункт даёт {XP_PER_TITAN_POINT} ци. Ноль — тренировка
          просто попадёт в журнал.
        </p>
        {journal.length === 0 ? (
          <p className="muted">Журнал пуст — запиши первую тренировку.</p>
        ) : (
          <ul className="list">
            {journal.map((w) => (
              <li key={w.id} className="row wrap">
                <span className="muted num">{formatDate(w.at)}</span>
                <span className="grow">
                  {w.type}
                  {w.result && <span className="muted"> — {w.result}</span>}
                </span>
                <span className="muted">{names.get(w.titanId) ?? '—'}</span>
                <span className="num">{w.gain > 0 ? `+${w.gain}` : '·'}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}

export function TrainingPage() {
  return <DataGate>{(snapshot) => <Training snapshot={snapshot} />}</DataGate>
}
