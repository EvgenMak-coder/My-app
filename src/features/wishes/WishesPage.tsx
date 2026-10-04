import { useState, type FormEvent } from 'react'
import { DataGate, Panel, formatDate } from '../../components/ui'
import { WishCoin } from '../../components/WishCoin'
import { createWish, setWishLevel, toggleWish } from '../../data/actions'
import { useAction } from '../../data/hooks'
import type { Snapshot, Wish } from '../../data/types'
import { dayKey, formatMoney } from '../../game/treasury'
import { daysTo, dueText, sortWishes, WISH_LEVELS, wishLevel, wishTotal } from '../../game/wishes'

/** '15 мая', а для другого года — '15 мая 2027' */
function dateTitle(date: string, today: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const title = new Date(year, month - 1, day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  return String(year) === today.slice(0, 4) ? title : `${title} ${year}`
}

/** Выбор металла монеты: насколько сильно хочется. */
function CoinPick({ level, onPick, disabled = false }: { level: number; onPick: (level: number) => void; disabled?: boolean }) {
  return (
    <div className="coin-pick" role="radiogroup" aria-label="Насколько хочется">
      {WISH_LEVELS.map((l, i) => (
        <button
          key={l.key}
          type="button"
          role="radio"
          aria-checked={i === level}
          aria-label={`${l.name} — ${l.hint}`}
          title={`${l.name} — ${l.hint}`}
          disabled={disabled}
          onClick={() => onPick(i)}
        >
          <WishCoin level={i} />
        </button>
      ))}
      <small className="muted">
        {wishLevel(level).name} · {wishLevel(level).hint}
      </small>
    </div>
  )
}

function WishRow({ wish, today, editing }: { wish: Wish; today: string; editing: boolean }) {
  const toggle = useAction((store, w: Wish) => toggleWish(store, w))
  const remove = useAction((store, id: string) => store.deleteWish(id))
  const relevel = useAction((store, level: number) => setWishLevel(store, wish, level))
  const done = !!wish.doneAt
  const late = !done && !!wish.date && daysTo(wish.date, today) < 0

  return (
    <li className={`wish${done ? ' done' : ''}${late ? ' late' : ''}`}>
      <button
        className="wish-check"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Вернуть «${wish.title}» в желания` : `Исполнено: «${wish.title}»`}
        disabled={toggle.isPending}
        onClick={() => toggle.mutate(wish)}
      >
        <WishCoin level={wish.level} done={done} />
      </button>
      <div className="grow">
        {wish.title}
        <small className="muted">
          {done
            ? `исполнено ${formatDate(wish.doneAt!)}`
            : wish.date
              ? `к ${dateTitle(wish.date, today)} · ${dueText(wish.date, today)}`
              : 'без срока'}
        </small>
      </div>
      {wish.price > 0 && <span className="money">{formatMoney(wish.price)}</span>}
      {editing && (
        <button
          className="small danger"
          aria-label={`Убрать «${wish.title}»`}
          disabled={remove.isPending}
          onClick={() => remove.mutate(wish.id)}
        >
          ×
        </button>
      )}
      {editing && <CoinPick level={wish.level} disabled={relevel.isPending} onPick={(level) => relevel.mutate(level)} />}
    </li>
  )
}

function AddWish() {
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [level, setLevel] = useState(0)
  const [dated, setDated] = useState(false)
  const [date, setDate] = useState('')
  const create = useAction((store, w: { title: string; level: number; price: number; date: string | null }) => createWish(store, w))
  const ready = !!title.trim() && (!dated || !!date)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!ready) return
    create.mutate(
      { title, level, price: Number(price) || 0, date: dated ? date : null },
      {
        onSuccess: () => {
          setTitle('')
          setPrice('')
          setDate('')
        },
      },
    )
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="row wrap">
        <input
          className="grow"
          type="text"
          placeholder="Чего хочется? Поездка в Китай…"
          value={title}
          aria-label="Желание"
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="amount"
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="Цена, ₽"
          value={price}
          aria-label="Цена в рублях"
          onChange={(e) => setPrice(e.target.value)}
        />
      </div>
      <CoinPick level={level} onPick={setLevel} />
      <div className="row wrap">
        <div className="tabs" role="radiogroup" aria-label="Срок">
          <button type="button" role="radio" aria-checked={!dated} onClick={() => setDated(false)}>
            Без срока
          </button>
          <button type="button" role="radio" aria-checked={dated} onClick={() => setDated(true)}>
            К дате
          </button>
        </div>
        {dated && <input type="date" value={date} aria-label="К какому дню" onChange={(e) => setDate(e.target.value)} />}
        <button type="submit" disabled={create.isPending || !ready}>
          Добавить
        </button>
      </div>
      {create.error && <p className="error">{(create.error as Error).message}</p>}
    </form>
  )
}

function Wishes({ snapshot }: { snapshot: Snapshot }) {
  const [tab, setTab] = useState<'active' | 'archive'>('active')
  const [editing, setEditing] = useState(false)
  const today = dayKey(new Date())
  const active = sortWishes(snapshot.wishes.filter((w) => !w.doneAt))
  const archived = snapshot.wishes.filter((w) => w.doneAt).sort((a, b) => b.doneAt!.localeCompare(a.doneAt!))
  const shown = tab === 'active' ? active : archived
  const total = wishTotal(shown)

  return (
    <>
      <h1>Желания</h1>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'active'} onClick={() => setTab('active')}>
          Желаю · {active.length}
        </button>
        <button role="tab" aria-selected={tab === 'archive'} onClick={() => setTab('archive')}>
          Исполнено · {archived.length}
        </button>
      </div>

      <Panel title={tab === 'active' ? '願 Список желаний' : '成 Исполненное'}>
        {shown.length === 0 ? (
          <p className="muted">
            {tab === 'active'
              ? 'Здесь живёт то, чего хочется: поездки, вещи, мечты. Нажми на монету — и желание уйдёт в исполненные.'
              : 'Пока пусто. Сюда уходят желания, у которых нажата монета.'}
          </p>
        ) : (
          <>
            {total > 0 && (
              <p className="muted">
                {tab === 'active' ? 'Всего желаний на' : 'Исполнено на'} <b className="wish-total">{formatMoney(total)}</b>
              </p>
            )}
            <ul className="list">
              {shown.map((w) => (
                <WishRow key={w.id} wish={w} today={today} editing={editing} />
              ))}
            </ul>
          </>
        )}
        {editing && tab === 'active' && <AddWish />}
        <button className="quiet" aria-expanded={editing} onClick={() => setEditing(!editing)}>
          {editing ? 'готово' : tab === 'active' ? '＋ желание' : 'править'}
        </button>
      </Panel>
    </>
  )
}

export function WishesPage() {
  return <DataGate>{(snapshot) => <Wishes snapshot={snapshot} />}</DataGate>
}
