import { useEffect, useState, type FormEvent } from 'react'
import { Bar, DataGate, formatDate, Panel } from '../../components/ui'
import { logWorkout, type WorkoutInput } from '../../data/actions'
import { useAction } from '../../data/hooks'
import type { Snapshot, Titan } from '../../data/types'
import { averageTitan, MATERIALS, materialProgress, TITAN_HEROES, XP_PER_TITAN_POINT } from '../../game/titans'

const EXTENSIONS = ['jpg', 'png', 'webp']

/**
 * Картинка титана. Сначала ищем отдельное изображение стадии (<key>-<material>),
 * затем базовое (<key>) — его перекрашиваем под материал; если нет и его, рисуем знак.
 */
function TitanImage({ titanKey, material, alt }: { titanKey: string; material: string; alt: string }) {
  const base = `${import.meta.env.BASE_URL}titans/`
  const candidates = [
    ...EXTENSIONS.map((ext) => ({ src: `${base}${titanKey}-${material}.${ext}`, own: true })),
    ...EXTENSIONS.map((ext) => ({ src: `${base}${titanKey}.${ext}`, own: false })),
  ]
  const [index, setIndex] = useState(0)
  useEffect(() => setIndex(0), [titanKey, material])

  const current = candidates[index]
  if (!current) {
    return (
      <div className="titan-art empty" aria-label={alt} role="img">
        <span>{TITAN_HEROES[titanKey]?.glyph ?? '武'}</span>
      </div>
    )
  }
  return (
    <div className={`titan-art ${current.own ? 'own' : 'tinted'}`}>
      <img
        src={current.src}
        alt={alt}
        style={{ objectPosition: TITAN_HEROES[titanKey]?.focus }}
        onError={() => setIndex(index + 1)}
      />
    </div>
  )
}

function TitanCard({ titan }: { titan: Titan }) {
  const progress = materialProgress(titan.value)
  const info = TITAN_HEROES[titan.key]
  const span = progress.next ? progress.next.from - progress.material.from : 100 - progress.material.from
  const inStage = span ? ((titan.value - progress.material.from) / span) * 100 : 100

  return (
    <li className={`titan ${progress.material.key}`}>
      <TitanImage
        titanKey={titan.key}
        material={progress.material.key}
        alt={`${info?.hero ?? titan.name}, ${progress.material.name.toLowerCase()}`}
      />
      <div className="titan-body">
        <h3>{info?.hero ?? titan.name}</h3>
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
    </li>
  )
}

const today = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function WorkoutForm({ snapshot }: { snapshot: Snapshot }) {
  const [date, setDate] = useState(today)
  const [titanId, setTitanId] = useState(snapshot.titans[0]?.id ?? '')
  const [type, setType] = useState('')
  const [result, setResult] = useState('')
  const [gain, setGain] = useState('1')
  const log = useAction((store, input: WorkoutInput) => logWorkout(store, snapshot, input))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!type.trim() || !titanId) return
    log.mutate(
      // полдень, чтобы дата не съехала на соседний день из-за часового пояса
      { titanId, type, result, gain: Number(gain) || 0, at: new Date(`${date}T12:00:00`).toISOString() },
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
      <label>
        <span className="muted">Дата</span>
        <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <label>
        <span className="muted">Титан</span>
        <select value={titanId} onChange={(e) => setTitanId(e.target.value)}>
          {snapshot.titans.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label className="wide">
        <span className="muted">Тип</span>
        <input type="text" placeholder="Бассейн, турник, бег…" value={type} onChange={(e) => setType(e.target.value)} />
      </label>
      <label className="wide">
        <span className="muted">Результат</span>
        <input type="text" placeholder="1 км за 25 минут" value={result} onChange={(e) => setResult(e.target.value)} />
      </label>
      <label>
        <span className="muted">Прибавка</span>
        <input type="number" min={0} max={20} value={gain} onChange={(e) => setGain(e.target.value)} />
      </label>
      <button type="submit" disabled={log.isPending || !type.trim()}>
        Записать
      </button>
      {log.error && <p className="error">{(log.error as Error).message}</p>}
    </form>
  )
}

function Training({ snapshot }: { snapshot: Snapshot }) {
  const titans = [...snapshot.titans].sort((a, b) => a.position - b.position)
  const names = new Map(snapshot.titans.map((t) => [t.id, t.name]))
  const journal = [...snapshot.workouts].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30)

  return (
    <>
      <h1>Тренировки</h1>
      <p className="muted">
        Средний показатель — {averageTitan(titans)}: он же сфера «Спорт» в Колесе жизни. Титан меняет материал каждые 20
        пунктов.
      </p>

      <ul className="titans">
        {titans.map((t) => (
          <TitanCard key={t.id} titan={t} />
        ))}
      </ul>

      <Panel title="Журнал тренировок">
        <WorkoutForm snapshot={snapshot} />
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
