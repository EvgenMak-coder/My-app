import { useEffect, useState, type FormEvent } from 'react'
import { Dragon } from '../../components/Dragon'
import { RadarWheel } from '../../components/RadarWheel'
import { Bar, DataGate, Panel } from '../../components/ui'
import { changeArea, createCountdown } from '../../data/actions'
import { useAction } from '../../data/hooks'
import type { Countdown, LifeArea, Snapshot } from '../../data/types'
import { leftText, sortByNearness, timeLeft, wisdomFor } from '../../game/countdown'
import { dayKey } from '../../game/treasury'
import { stageProgress, totalXp } from '../../game/xp'

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

/** Текущее время, обновляется раз в минуту — чтобы отсчёт и дата не застывали на открытой странице. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

/** '31 декабря', а для другого года — '1 января 2027' */
function dateTitle(date: string, now: Date): string {
  const [year, month, day] = date.split('-').map(Number)
  const title = new Date(year, month - 1, day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  return year === now.getFullYear() ? title : `${title} ${year}`
}

/** 'Воскресенье, 4 октября 2026' */
function todayTitle(now: Date): string {
  const title = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
  return `${capitalize(title)} ${now.getFullYear()}`
}

function CountdownRow({ item, now, editing }: { item: Countdown; now: Date; editing: boolean }) {
  const remove = useAction((store, id: string) => store.deleteCountdown(id))
  const left = timeLeft(item.date, now)
  const lead = left.state === 'ahead' ? 'осталось' : left.state === 'today' ? 'этот день настал' : ''

  return (
    <li className={`countdown ${left.state}`}>
      <span className="grow">
        {item.title}
        <small className="muted">
          {dateTitle(item.date, now)}
          {lead && ` · ${lead}`}
        </small>
      </span>
      <span className="countdown-left">{leftText(left)}</span>
      {editing && (
        <button
          className="small danger"
          aria-label={`Убрать «${item.title}»`}
          disabled={remove.isPending}
          onClick={() => remove.mutate(item.id)}
        >
          ×
        </button>
      )}
    </li>
  )
}

/** Грядущие дни: отсчёт до каждого. Добавление и удаление спрятаны за неприметной кнопкой. */
function Countdowns({ items, now }: { items: Countdown[]; now: Date }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const create = useAction((store, c: { title: string; date: string }) => createCountdown(store, c.title, c.date))
  const sorted = sortByNearness(items, dayKey(now))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !date) return
    create.mutate(
      { title, date },
      {
        onSuccess: () => {
          setTitle('')
          setDate('')
        },
      },
    )
  }

  return (
    <Panel title="暦 Грядущее">
      {sorted.length === 0 ? (
        <p className="muted">Здесь идёт отсчёт до дней, которых ты ждёшь.</p>
      ) : (
        <ul className="list">
          {sorted.map((item) => (
            <CountdownRow key={item.id} item={item} now={now} editing={editing} />
          ))}
        </ul>
      )}
      {editing && (
        <form className="row wrap" onSubmit={submit}>
          <input
            className="grow"
            type="text"
            placeholder="Чего ждём? Новый год, отпуск…"
            value={title}
            aria-label="Название дня"
            onChange={(e) => setTitle(e.target.value)}
          />
          <input type="date" value={date} aria-label="Дата" onChange={(e) => setDate(e.target.value)} required />
          <button type="submit" disabled={create.isPending || !title.trim() || !date}>
            Добавить
          </button>
        </form>
      )}
      {create.error && <p className="error">{(create.error as Error).message}</p>}
      <button className="quiet" aria-expanded={editing} onClick={() => setEditing(!editing)}>
        {editing ? 'готово' : '＋ день'}
      </button>
    </Panel>
  )
}

function Home({ snapshot }: { snapshot: Snapshot }) {
  const now = useNow()
  const xp = totalXp(snapshot.xpEvents)
  const progress = stageProgress(xp)

  return (
    <>
      <section className="hero">
        <span className="kanji" aria-hidden="true">
          天龍之道
        </span>
        <Dragon level={progress.index} ratio={progress.ratio} label={`Дракон, стадия «${progress.stage.name}»`} />
        <h1>{snapshot.profile.dragonName}</h1>
        <p className="stage">
          Стадия {progress.index + 1} · {progress.stage.name}
        </p>
        <div style={{ width: 'min(100%, 520px)' }}>
          <Bar value={progress.ratio * 100} gold />
        </div>
        <p className="muted num">
          {progress.next
            ? `${xp} / ${progress.next.from} ци — до стадии «${progress.next.name}»`
            : `${xp} ци — вершина пути`}
        </p>
      </section>

      <section className="today">
        <p className="today-date">{todayTitle(now)}</p>
        <p className="today-wisdom">{wisdomFor(now)}</p>
      </section>

      <Countdowns items={snapshot.countdowns} now={now} />

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
