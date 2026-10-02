import { useEffect, useState, type FormEvent } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { Bar, DataGate, formatDate, Panel } from '../../components/ui'
import { addTransaction, createCredit, createSalary, payCredit, receiveSalary } from '../../data/actions'
import { useAction } from '../../data/hooks'
import type { Credit, Salary, Snapshot, Transaction } from '../../data/types'
import {
  categoryOf,
  daysUntil,
  EXPENSE_CATEGORIES,
  expenseShares,
  formatMoney,
  INCOME_CATEGORIES,
  monthKey,
  monthRange,
  monthTitle,
  nextPayday,
  paidPercent,
  shiftMonth,
} from '../../game/treasury'

const today = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
  const [payment, setPayment] = useState('')
  const pay = useAction((store, amount: number) => payCredit(store, credit, amount))
  const remove = useAction((store, id: string) => store.deleteCredit(id))
  const paid = paidPercent(credit.total, credit.remaining)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (Number(payment) > 0) pay.mutate(Number(payment), { onSuccess: () => setPayment('') })
  }

  return (
    <li className="credit">
      <div className="row wrap">
        <span className="grow">
          {credit.name}
          <small className="muted"> из {formatMoney(credit.total)}</small>
        </span>
        <span className="money">{credit.remaining > 0 ? formatMoney(credit.remaining) : 'Оковы сброшены'}</span>
      </div>
      <Bar value={paid} gold />
      <form className="row wrap" onSubmit={submit}>
        <span className="grow muted num">погашено {paid}%</span>
        {credit.remaining > 0 && (
          <>
            <input
              className="amount"
              type="number"
              min={0}
              placeholder="Платёж"
              value={payment}
              aria-label={`Платёж по «${credit.name}»`}
              onChange={(e) => setPayment(e.target.value)}
            />
            <button className="small" type="submit" disabled={pay.isPending || !(Number(payment) > 0)}>
              Внести
            </button>
          </>
        )}
        <button
          className="small danger"
          type="button"
          aria-label={`Удалить кредит «${credit.name}»`}
          onClick={() => confirm(`Удалить кредит «${credit.name}»?`) && remove.mutate(credit.id)}
        >
          ×
        </button>
      </form>
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
  const debt = credits.reduce((s, c) => s + c.remaining, 0)
  const whole = credits.reduce((s, c) => s + c.total, 0)

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
      {credits.length > 0 && (
        <ul className="list">
          {[...credits].sort((a, b) => a.position - b.position).map((c) => (
            <CreditRow key={c.id} credit={c} />
          ))}
        </ul>
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
  const entries = snapshot.transactions
    .filter((t) => monthKey(t.at) === month)
    .sort((a, b) => b.at.localeCompare(a.at))
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
                  <button
                    className="small danger"
                    aria-label="Удалить запись"
                    onClick={() => confirm('Удалить эту запись?') && remove.mutate(t.id)}
                  >
                    ×
                  </button>
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
    </>
  )
}

export function TreasuryPage() {
  return <DataGate>{(snapshot) => <Treasury snapshot={snapshot} />}</DataGate>
}
