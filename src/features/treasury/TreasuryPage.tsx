import { useEffect, useState, type FormEvent } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { Bar, DataGate, formatDate, Panel } from '../../components/ui'
import {
  addTransaction,
  cancelSubscription,
  createCredit,
  createSalary,
  createSubscription,
  growCredit,
  payCredit,
  receiveSalary,
  resumeSubscription,
  updateCredit,
  updateSubscription,
  type SubscriptionInput,
} from '../../data/actions'
import { useAction } from '../../data/hooks'
import type { Credit, Salary, Snapshot, Subscription, Transaction } from '../../data/types'
import {
  categoryOf,
  chargeDate,
  chargeIn,
  dayKey,
  dayTitle,
  daysUntil,
  EXPENSE_CATEGORIES,
  expenseShares,
  formatMoney,
  INCOME_CATEGORIES,
  isCharged,
  monthKey,
  monthRange,
  monthTitle,
  nextPayday,
  paidPercent,
  shiftMonth,
  SUBSCRIPTION_CATEGORY,
} from '../../game/treasury'

const today = (): string => dayKey(new Date())

// списания подписок живут в свитке рядом с обычными записями, но удаляются только вместе с подпиской
const CHARGE_PREFIX = 'sub:'

/** Уже прошедшие списания подписок за месяц — в виде расходов. */
function chargesOf(subscriptions: Subscription[], month: string): Transaction[] {
  const now = today()
  return subscriptions.flatMap((s) => {
    const date = chargeIn(s, month)
    if (!date || !isCharged(date, now)) return []
    return [
      {
        id: CHARGE_PREFIX + s.id,
        kind: 'expense' as const,
        amount: s.amount,
        category: SUBSCRIPTION_CATEGORY.key,
        note: s.name,
        at: new Date(`${date}T12:00:00`).toISOString(),
      },
    ]
  })
}

const sum = (list: Transaction[], kind: Transaction['kind']): number =>
  list.filter((t) => t.kind === kind).reduce((total, t) => total + t.amount, 0)

// ---------- жалованье ----------

function SalaryRow({ salary }: { salary: Salary }) {
  const now = new Date()
  const next = nextPayday(salary.day, now)
  const left = daysUntil(next, now)
  const receive = useAction((store, s: Salary) => receiveSalary(store, s))
  const remove = useAction((store, id: string) => store.deleteSalary(id))

  return (
    <li className="row wrap">
      <span className="grow">
        {salary.name}
        <small className="muted">
          {' '}
          {salary.day}-го числа · {left === 0 ? 'сегодня' : `через ${left} дн.`}
        </small>
      </span>
      <span className="money">{formatMoney(salary.amount)}</span>
      <button className="small" disabled={receive.isPending} onClick={() => receive.mutate(salary)}>
        Получено
      </button>
      <button
        className="small danger"
        aria-label={`Удалить выплату «${salary.name}»`}
        onClick={() => confirm(`Удалить выплату «${salary.name}»?`) && remove.mutate(salary.id)}
      >
        ×
      </button>
    </li>
  )
}

function SalaryPanel({ salaries }: { salaries: Salary[] }) {
  const [name, setName] = useState('')
  const [day, setDay] = useState('5')
  const [amount, setAmount] = useState('')
  const create = useAction((store, s: { name: string; day: number; amount: number }) =>
    createSalary(store, s.name, s.day, s.amount),
  )
  const monthly = salaries.reduce((total, s) => total + s.amount, 0)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !(Number(amount) > 0)) return
    create.mutate(
      { name, day: Number(day), amount: Number(amount) },
      {
        onSuccess: () => {
          setName('')
          setAmount('')
        },
      },
    )
  }

  return (
    <Panel title="俸 Жалованье">
      <p className="muted">В месяц по плану: {formatMoney(monthly)}. «Получено» записывает доход сегодняшним числом.</p>
      {salaries.length > 0 && (
        <ul className="list">
          {[...salaries].sort((a, b) => a.day - b.day).map((s) => (
            <SalaryRow key={s.id} salary={s} />
          ))}
        </ul>
      )}
      <form className="row wrap" onSubmit={submit}>
        <input className="grow" type="text" placeholder="Название выплаты" value={name} onChange={(e) => setName(e.target.value)} />
        <input type="number" min={1} max={31} value={day} aria-label="Число месяца" onChange={(e) => setDay(e.target.value)} />
        <input className="amount" type="number" min={0} placeholder="Сумма" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button type="submit" disabled={create.isPending || !name.trim() || !(Number(amount) > 0)}>
          Добавить
        </button>
      </form>
    </Panel>
  )
}

// ---------- кредиты ----------

function CreditRow({ credit }: { credit: Credit }) {
  const [amount, setAmount] = useState('')
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(credit.name)
  const [total, setTotal] = useState(String(credit.total))
  const [remaining, setRemaining] = useState(String(credit.remaining))
  const pay = useAction((store, sum: number) => payCredit(store, credit, sum))
  const grow = useAction((store, sum: number) => growCredit(store, credit, sum))
  const edit = useAction((store, c: { name: string; total: number; remaining: number }) =>
    updateCredit(store, credit, c.name, c.total, c.remaining),
  )
  const remove = useAction((store, id: string) => store.deleteCredit(id))
  const paid = paidPercent(credit.total, credit.remaining)
  const sum = Number(amount)
  const busy = pay.isPending || grow.isPending
  const clear = { onSuccess: () => setAmount('') }

  const openEditor = () => {
    setName(credit.name)
    setTotal(String(credit.total))
    setRemaining(String(credit.remaining))
    setEditing(true)
  }

  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    edit.mutate(
      { name, total: Number(total) || 0, remaining: Number(remaining) || 0 },
      { onSuccess: () => setEditing(false) },
    )
  }

  return (
    <li className="credit">
      <div className="row wrap">
        <span className="grow">
          {credit.name}
          <small className="muted">
            {' '}
            из {formatMoney(credit.total)} · погашено {paid}%
          </small>
        </span>
        <span className={credit.remaining > 0 ? 'money' : 'money income'}>
          {credit.remaining > 0 ? formatMoney(credit.remaining) : 'Оковы сброшены'}
        </span>
      </div>
      <Bar value={paid} gold />

      {editing ? (
        // точная правка: когда проще вписать цифры из банка, чем считать разницу
        <form className="row wrap" onSubmit={save}>
          <input className="grow" type="text" value={name} aria-label="Название" onChange={(e) => setName(e.target.value)} />
          <label>
            <span className="muted">всего </span>
            <input className="amount" type="number" min={0} value={total} onChange={(e) => setTotal(e.target.value)} />
          </label>
          <label>
            <span className="muted">осталось </span>
            <input className="amount" type="number" min={0} value={remaining} onChange={(e) => setRemaining(e.target.value)} />
          </label>
          <button className="small" type="submit" disabled={edit.isPending || !name.trim()}>
            Сохранить
          </button>
          <button className="small ghost" type="button" onClick={() => setEditing(false)}>
            Отмена
          </button>
        </form>
      ) : (
        <div className="row wrap">
          <input
            className="amount grow"
            type="number"
            min={0}
            placeholder="Сумма"
            value={amount}
            aria-label={`Сумма по «${credit.name}»`}
            onChange={(e) => setAmount(e.target.value)}
          />
          {credit.remaining > 0 && (
            <button className="small" disabled={busy || !(sum > 0)} onClick={() => pay.mutate(sum, clear)}>
              Погасить
            </button>
          )}
          <button
            className="small ghost"
            title="Проценты или новая трата по кредитке"
            disabled={busy || !(sum > 0)}
            onClick={() => grow.mutate(sum, clear)}
          >
            + Долг
          </button>
          <button className="small ghost" aria-label={`Изменить кредит «${credit.name}»`} onClick={openEditor}>
            ✎
          </button>
          <button
            className="small danger"
            aria-label={`Удалить кредит «${credit.name}»`}
            onClick={() => confirm(`Удалить кредит «${credit.name}»?`) && remove.mutate(credit.id)}
          >
            ×
          </button>
        </div>
      )}
    </li>
  )
}

function CreditPanel({ credits }: { credits: Credit[] }) {
  const [name, setName] = useState('')
  const [total, setTotal] = useState('')
  const [remaining, setRemaining] = useState('')
  const create = useAction((store, c: { name: string; total: number; remaining: number }) =>
    createCredit(store, c.name, c.total, c.remaining, credits.length),
  )
  const [tab, setTab] = useState<'active' | 'archive'>('active')
  const debt = credits.reduce((s, c) => s + c.remaining, 0)
  const whole = credits.reduce((s, c) => s + c.total, 0)
  // погашенный полностью кредит сам уходит в архив; «+ Долг» или правка возвращают его обратно
  const sorted = [...credits].sort((a, b) => a.position - b.position)
  const active = sorted.filter((c) => c.remaining > 0)
  const archived = sorted.filter((c) => c.remaining <= 0)
  const shown = tab === 'active' ? active : archived

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !(Number(total) > 0)) return
    create.mutate(
      { name, total: Number(total), remaining: remaining === '' ? Number(total) : Number(remaining) },
      {
        onSuccess: () => {
          setName('')
          setTotal('')
          setRemaining('')
        },
      },
    )
  }

  return (
    <Panel title="鎖 Оковы — кредиты">
      <p className="muted">
        Осталось {formatMoney(debt)} из {formatMoney(whole)} · погашено {paidPercent(whole, debt)}%
      </p>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'active'} onClick={() => setTab('active')}>
          Действующие · {active.length}
        </button>
        <button role="tab" aria-selected={tab === 'archive'} onClick={() => setTab('archive')}>
          Архив · {archived.length}
        </button>
      </div>
      {shown.length > 0 ? (
        <ul className="list">
          {shown.map((c) => (
            <CreditRow key={c.id} credit={c} />
          ))}
        </ul>
      ) : (
        <p className="muted">
          {tab === 'active' ? 'Долгов нет — все оковы сброшены.' : 'Архив пуст. Сюда уходят кредиты, погашенные полностью.'}
        </p>
      )}
      {tab === 'archive' && archived.length > 0 && (
        <p className="muted">Сброшено оков на {formatMoney(archived.reduce((s, c) => s + c.total, 0))}.</p>
      )}
      <form className="row wrap" onSubmit={submit}>
        <input className="grow" type="text" placeholder="Новый кредит" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="amount" type="number" min={0} placeholder="Всего" value={total} onChange={(e) => setTotal(e.target.value)} />
        <input className="amount" type="number" min={0} placeholder="Осталось" value={remaining} onChange={(e) => setRemaining(e.target.value)} />
        <button type="submit" disabled={create.isPending || !name.trim() || !(Number(total) > 0)}>
          Добавить
        </button>
      </form>
    </Panel>
  )
}

// ---------- подписки ----------

interface SubscriptionDraft {
  name: string
  amount: string
  day: string
}

function SubscriptionFields({ value, onChange }: { value: SubscriptionDraft; onChange: (next: SubscriptionDraft) => void }) {
  return (
    <>
      <input
        className="grow"
        type="text"
        placeholder="Название подписки"
        value={value.name}
        aria-label="Название подписки"
        onChange={(e) => onChange({ ...value, name: e.target.value })}
      />
      <input
        className="amount"
        type="number"
        min={0}
        placeholder="Сумма"
        value={value.amount}
        aria-label="Сумма в месяц"
        onChange={(e) => onChange({ ...value, amount: e.target.value })}
      />
      <label className="day-field">
        <span className="muted">число</span>
        <input
          type="number"
          min={1}
          max={31}
          value={value.day}
          aria-label="Число месяца, когда списывается"
          onChange={(e) => onChange({ ...value, day: e.target.value })}
        />
      </label>
    </>
  )
}

const toInput = (v: SubscriptionDraft): SubscriptionInput => ({
  name: v.name,
  amount: Number(v.amount),
  day: Number(v.day),
})

const draftValid = (v: SubscriptionDraft): boolean =>
  !!v.name.trim() && Number(v.amount) > 0 && Number(v.day) >= 1 && Number(v.day) <= 31

function SubscriptionRow({ sub, month }: { sub: Subscription; month: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<SubscriptionDraft>({ name: '', amount: '', day: '' })
  const edit = useAction((store, input: SubscriptionInput) => updateSubscription(store, sub, input))
  const cancel = useAction((store, s: Subscription) => cancelSubscription(store, s))
  const now = new Date()
  const isCurrent = month === monthKey(now)
  const date = chargeIn(sub, month)
  const charged = !!date && isCharged(date, today())

  let status = 'в этом месяце ещё не действовала'
  if (date && charged) {
    status = `списано ${dayTitle(date)}`
    // в текущем месяце подсказываем, к какому числу деньги понадобятся снова
    if (isCurrent) status += ` · следующее ${dayTitle(chargeDate(sub.day, shiftMonth(month, 1)))}`
  } else if (date) {
    const [y, m, d] = date.split('-').map(Number)
    const left = daysUntil(new Date(y, m - 1, d), now)
    status = `спишется ${dayTitle(date)}`
    if (isCurrent) status += left === 1 ? ' · завтра' : ` · через ${left} дн.`
  }

  const openEditor = () => {
    setDraft({ name: sub.name, amount: String(sub.amount), day: String(sub.day) })
    setEditing(true)
  }

  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!draftValid(draft)) return
    edit.mutate(toInput(draft), { onSuccess: () => setEditing(false) })
  }

  if (editing) {
    return (
      <li>
        <form className="row wrap" onSubmit={save}>
          <SubscriptionFields value={draft} onChange={setDraft} />
          <button className="small" type="submit" disabled={edit.isPending || !draftValid(draft)}>
            Сохранить
          </button>
          <button className="small ghost" type="button" onClick={() => setEditing(false)}>
            Отмена
          </button>
        </form>
      </li>
    )
  }

  return (
    <li className={`row wrap subscription${charged ? ' charged' : ''}`}>
      <span className="grow">
        {sub.name}
        <small className="muted">{status}</small>
      </span>
      <span className="money">{formatMoney(sub.amount)}</span>
      <button className="small ghost" aria-label={`Изменить подписку «${sub.name}»`} onClick={openEditor}>
        ✎
      </button>
      <button
        className="small danger"
        aria-label={`Отменить подписку «${sub.name}»`}
        disabled={cancel.isPending}
        onClick={() =>
          confirm(`Отменить подписку «${sub.name}»? Уже прошедшие списания останутся в статистике.`) && cancel.mutate(sub)
        }
      >
        ×
      </button>
    </li>
  )
}

function ArchivedSubscriptionRow({ sub }: { sub: Subscription }) {
  const resume = useAction((store, s: Subscription) => resumeSubscription(store, s))
  const remove = useAction((store, id: string) => store.deleteSubscription(id))
  return (
    <li className="row wrap subscription">
      <span className="grow">
        {sub.name}
        <small className="muted">
          {sub.day}-го числа · действовала до {sub.endedAt ? dayTitle(sub.endedAt) : '—'}
        </small>
      </span>
      <span className="money">{formatMoney(sub.amount)}</span>
      <button className="small" disabled={resume.isPending} onClick={() => resume.mutate(sub)}>
        Вернуть
      </button>
      <button
        className="small danger"
        aria-label={`Удалить подписку «${sub.name}» совсем`}
        onClick={() =>
          confirm(`Удалить «${sub.name}» совсем? Её прошлые списания исчезнут из статистики.`) && remove.mutate(sub.id)
        }
      >
        ×
      </button>
    </li>
  )
}

const EMPTY_DRAFT: SubscriptionDraft = { name: '', amount: '', day: '1' }

function SubscriptionPanel({ subscriptions, month }: { subscriptions: Subscription[]; month: string }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [tab, setTab] = useState<'active' | 'archive'>('active')
  const create = useAction((store, input: SubscriptionInput) => createSubscription(store, input))
  const now = today()
  const active = subscriptions.filter((s) => !s.endedAt).sort((a, b) => a.day - b.day)
  const archived = subscriptions
    .filter((s) => s.endedAt)
    .sort((a, b) => (b.endedAt ?? '').localeCompare(a.endedAt ?? ''))

  let charged = 0
  let pending = 0
  for (const s of subscriptions) {
    const date = chargeIn(s, month)
    if (!date) continue
    if (isCharged(date, now)) charged += s.amount
    else pending += s.amount
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!draftValid(draft)) return
    create.mutate(toInput(draft), { onSuccess: () => setDraft(EMPTY_DRAFT) })
  }

  return (
    <Panel title="契 Подписки">
      <p className="muted">
        {monthTitle(month)}: списано {formatMoney(charged)} · ещё спишется {formatMoney(pending)}. В расходы подписка попадает
        в день списания — отдельной долей <span style={{ color: SUBSCRIPTION_CATEGORY.color }}>«{SUBSCRIPTION_CATEGORY.name}»</span>.
      </p>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'active'} onClick={() => setTab('active')}>
          Действующие · {active.length}
        </button>
        <button role="tab" aria-selected={tab === 'archive'} onClick={() => setTab('archive')}>
          Архив · {archived.length}
        </button>
      </div>
      {tab === 'active' && active.length > 0 && (
        <ul className="list">
          {active.map((s) => (
            <SubscriptionRow key={s.id} sub={s} month={month} />
          ))}
        </ul>
      )}
      {tab === 'active' && active.length === 0 && (
        <p className="muted">Подписок нет. Добавь первую: название, сумма и число месяца, когда она списывается.</p>
      )}
      {tab === 'archive' && archived.length > 0 && (
        <ul className="list">
          {archived.map((s) => (
            <ArchivedSubscriptionRow key={s.id} sub={s} />
          ))}
        </ul>
      )}
      {tab === 'archive' && archived.length === 0 && <p className="muted">Архив пуст. Сюда уходят отменённые подписки.</p>}
      <form className="row wrap" onSubmit={submit}>
        <SubscriptionFields value={draft} onChange={setDraft} />
        <button type="submit" disabled={create.isPending || !draftValid(draft)}>
          Добавить
        </button>
      </form>
      {create.error && <p className="error">{(create.error as Error).message}</p>}
    </Panel>
  )
}

// ---------- запись дохода или расхода ----------

function EntryForm({ month }: { month: string }) {
  const [kind, setKind] = useState<Transaction['kind']>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('food')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today)
  const add = useAction((store, t: Omit<Transaction, 'id'>) => addTransaction(store, t))
  const categories = kind === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES

  // запись попадает в открытый месяц: в текущем — сегодняшним числом, в другом — первым числом (дату можно поправить)
  useEffect(() => setDate(month === monthKey(new Date()) ? today() : `${month}-01`), [month])

  const switchKind = (next: Transaction['kind']) => {
    setKind(next)
    setCategory(next === 'expense' ? 'food' : 'salary')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!(Number(amount) > 0)) return
    add.mutate(
      // полдень, чтобы дата не съехала на соседний день из-за часового пояса
      { kind, amount: Number(amount), category, note: note.trim(), at: new Date(`${date}T12:00:00`).toISOString() },
      {
        onSuccess: () => {
          setAmount('')
          setNote('')
        },
      },
    )
  }

  return (
    <Panel title="筆 Новая запись">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={kind === 'expense'} onClick={() => switchKind('expense')}>
          Расход
        </button>
        <button role="tab" aria-selected={kind === 'income'} onClick={() => switchKind('income')}>
          Доход
        </button>
      </div>
      <form className="stack" onSubmit={submit}>
        <div className="chips" role="radiogroup" aria-label="Категория">
          {categories.map((c) => (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={c.key === category}
              style={{ color: c.key === category ? c.color : undefined }}
              onClick={() => setCategory(c.key)}
            >
              {c.glyph} {c.name}
            </button>
          ))}
        </div>
        <div className="row wrap">
          <input className="amount" type="number" min={0} placeholder="Сумма" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input className="grow" type="text" placeholder="Заметка" value={note} onChange={(e) => setNote(e.target.value)} />
          <input type="date" value={date} aria-label="Дата" onChange={(e) => setDate(e.target.value)} required />
          <button type="submit" disabled={add.isPending || !(Number(amount) > 0)}>
            Записать
          </button>
        </div>
      </form>
    </Panel>
  )
}

// ---------- доли расходов ----------

function SharesPanel({ transactions }: { transactions: Transaction[] }) {
  const shares = expenseShares(transactions)
  const total = shares.reduce((s, x) => s + x.amount, 0)

  return (
    <Panel title="分 Расходы по долям">
      {shares.length === 0 ? (
        <p className="muted">За этот месяц расходов нет.</p>
      ) : (
        <div className="shares">
          <div className="donut">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={shares.map((s) => ({ name: s.category.name, value: s.amount }))}
                  dataKey="value"
                  innerRadius="62%"
                  outerRadius="92%"
                  paddingAngle={2}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {shares.map((s) => (
                    <Cell key={s.category.key} fill={s.category.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <span className="muted">всего</span>
              <b>{formatMoney(total)}</b>
            </div>
          </div>
          <ul className="list grow">
            {shares.map((s) => (
              <li key={s.category.key}>
                <div className="row">
                  <span className="grow" style={{ color: s.category.color }}>
                    {s.category.glyph} {s.category.name}
                  </span>
                  <span className="muted num">{formatMoney(s.amount)}</span>
                  <b className="num share-percent">{Math.round(s.percent)}%</b>
                </div>
                <div className="bar">
                  <span style={{ width: `${s.percent}%`, background: s.category.color, boxShadow: `0 0 10px ${s.category.color}` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}

// ---------- страница ----------

function Treasury({ snapshot }: { snapshot: Snapshot }) {
  const current = monthKey(new Date())
  const [month, setMonth] = useState(current)
  const months = monthRange(current, [...snapshot.transactions.map((t) => monthKey(t.at)), month])
  const remove = useAction((store, id: string) => store.deleteTransaction(id))
  const entries = [
    ...snapshot.transactions.filter((t) => monthKey(t.at) === month),
    ...chargesOf(snapshot.subscriptions, month),
  ].sort((a, b) => b.at.localeCompare(a.at))
  const income = sum(entries, 'income')
  const expense = sum(entries, 'expense')
  const debt = snapshot.credits.reduce((s, c) => s + c.remaining, 0)

  return (
    <>
      <h1>Казна</h1>

      <div className="row month-switch">
        <button className="small ghost" aria-label="Предыдущий месяц" onClick={() => setMonth(shiftMonth(month, -1))}>
          ‹
        </button>
        <select className="grow month-select" value={month} aria-label="Месяц" onChange={(e) => setMonth(e.target.value)}>
          {months.map((key) => (
            <option key={key} value={key}>
              {monthTitle(key)}
              {key === current ? ' · сейчас' : ''}
            </option>
          ))}
        </select>
        <button className="small ghost" aria-label="Следующий месяц" onClick={() => setMonth(shiftMonth(month, 1))}>
          ›
        </button>
        {month !== current && (
          <button className="small" onClick={() => setMonth(current)}>
            К текущему
          </button>
        )}
      </div>

      <div className="stat-tiles">
        <div className="tile">
          <b>{formatMoney(income)}</b>
          <span className="muted">пришло за месяц</span>
        </div>
        <div className="tile">
          <b>{formatMoney(expense)}</b>
          <span className="muted">ушло за месяц</span>
        </div>
        <div className="tile">
          <b className={income - expense < 0 ? 'negative' : ''}>{formatMoney(income - expense)}</b>
          <span className="muted">остаток месяца</span>
        </div>
        <div className="tile">
          <b>{formatMoney(debt)}</b>
          <span className="muted">долг по кредитам</span>
        </div>
      </div>

      <EntryForm month={month} />
      <SharesPanel transactions={entries} />

      <Panel title="巻 Свиток месяца">
        {entries.length === 0 ? (
          <p className="muted">Записей за этот месяц нет.</p>
        ) : (
          <ul className="list">
            {entries.map((t) => {
              const category = categoryOf(t.kind, t.category)
              return (
                <li key={t.id} className="row wrap">
                  <span className="muted num">{formatDate(t.at)}</span>
                  <span className="grow">
                    <span style={{ color: category.color }}>
                      {category.glyph} {category.name}
                    </span>
                    {t.note && <span className="muted"> — {t.note}</span>}
                  </span>
                  <span className={`money ${t.kind}`}>
                    {t.kind === 'income' ? '+' : '−'}
                    {formatMoney(t.amount)}
                  </span>
                  {t.id.startsWith(CHARGE_PREFIX) ? (
                    <span className="auto-mark muted" title="Списание подписки — управляется в «Подписках» ниже" aria-hidden="true">
                      ↻
                    </span>
                  ) : (
                    <button
                      className="small danger"
                      aria-label="Удалить запись"
                      onClick={() => confirm('Удалить эту запись?') && remove.mutate(t.id)}
                    >
                      ×
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <div className="grid-2">
        <SalaryPanel salaries={snapshot.salaries} />
        <CreditPanel credits={snapshot.credits} />
      </div>

      <SubscriptionPanel subscriptions={snapshot.subscriptions} month={month} />
    </>
  )
}

export function TreasuryPage() {
  return <DataGate>{(snapshot) => <Treasury snapshot={snapshot} />}</DataGate>
}
