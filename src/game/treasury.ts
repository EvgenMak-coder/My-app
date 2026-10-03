export interface MoneyCategory {
  key: string
  name: string
  glyph: string
  color: string
}

export const EXPENSE_CATEGORIES: MoneyCategory[] = [
  { key: 'medicine', name: 'Медицина', glyph: '医', color: '#e8212f' },
  { key: 'games', name: 'Игры', glyph: '遊', color: '#a259ff' },
  { key: 'tech', name: 'Техника', glyph: '機', color: '#3f9dff' },
  { key: 'food', name: 'Еда', glyph: '食', color: '#ff7a1a' },
  { key: 'home', name: 'Квартира', glyph: '家', color: '#e6b422' },
  { key: 'other', name: 'Прочее', glyph: '他', color: '#8f887c' },
]

export const INCOME_CATEGORIES: MoneyCategory[] = [
  { key: 'salary', name: 'Жалованье', glyph: '俸', color: '#2fae7a' },
  { key: 'other', name: 'Прочее', glyph: '他', color: '#8f887c' },
]

export const categoryOf = (kind: 'income' | 'expense', key: string): MoneyCategory => {
  const list = kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  return list.find((c) => c.key === key) ?? list[list.length - 1]
}

const money = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })
export const formatMoney = (amount: number): string => `${money.format(amount)} ₽`

/** 'ГГГГ-ММ' по местному времени — ключ месяца для записи */
export function monthKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function shiftMonth(key: string, delta: number): string {
  const [year, month] = key.split('-').map(Number)
  return monthKey(new Date(year, month - 1 + delta, 1))
}

export function monthTitle(key: string): string {
  const [year, month] = key.split('-').map(Number)
  const title = new Date(year, month - 1, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
  return title.charAt(0).toUpperCase() + title.slice(1)
}

/**
 * Месяцы для выбора: от самого раннего (первая запись, но не позже чем 3 месяца назад)
 * до самого позднего (последняя запись, но не раньше чем через 6 месяцев) — с запасом на планирование вперёд.
 */
export function monthRange(current: string, used: string[]): string[] {
  let first = shiftMonth(current, -3)
  let last = shiftMonth(current, 6)
  for (const key of used) {
    if (key < first) first = key
    if (key > last) last = key
  }
  const months: string[] = []
  for (let key = first; key <= last; key = shiftMonth(key, 1)) months.push(key)
  return months
}

/** Ближайшая выплата: в этом месяце, если её день ещё не прошёл, иначе в следующем. */
export function nextPayday(day: number, from: Date): Date {
  const clamp = (year: number, month: number) => Math.min(day, new Date(year, month + 1, 0).getDate())
  const year = from.getFullYear()
  const month = from.getMonth()
  if (from.getDate() <= clamp(year, month)) return new Date(year, month, clamp(year, month))
  return new Date(year, month + 1, clamp(year, month + 1))
}

export function daysUntil(target: Date, from: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime()
  return Math.round((b - a) / 86_400_000)
}

/** 'ГГГГ-ММ-ДД' по местному времени */
export function dayKey(date: Date): string {
  return `${monthKey(date)}-${String(date.getDate()).padStart(2, '0')}`
}

/** '15 октября' из 'ГГГГ-ММ-ДД' */
export function dayTitle(key: string): string {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

/** То, что нужно знать о подписке для расчёта списаний */
export interface Recurring {
  day: number
  /** первый день, с которого подписка считается, 'ГГГГ-ММ-ДД' */
  startedAt: string
  /** последний день действия; null — действует */
  endedAt: string | null
}

/** День списания в месяце: 31-е число в коротком месяце — его последний день. */
export function chargeDate(day: number, month: string): string {
  const [year, m] = month.split('-').map(Number)
  const last = new Date(year, m, 0).getDate()
  return `${month}-${String(Math.min(Math.max(1, day), last)).padStart(2, '0')}`
}

/** Дата списания в этом месяце или null, если в тот день подписка не действовала. */
export function chargeIn(sub: Recurring, month: string): string | null {
  const date = chargeDate(sub.day, month)
  if (date < sub.startedAt) return null
  if (sub.endedAt && date > sub.endedAt) return null
  return date
}

/** Списание попадает в общий счёт только с того дня, когда оно произошло. */
export const isCharged = (date: string, today: string): boolean => date <= today

export interface Share {
  category: MoneyCategory
  amount: number
  /** доля от всех расходов, в процентах */
  percent: number
}

/** Расходы по категориям, от самой крупной; категории без трат не попадают. */
export function expenseShares(transactions: { kind: string; category: string; amount: number }[]): Share[] {
  const totals = new Map<string, number>()
  let sum = 0
  for (const t of transactions) {
    if (t.kind !== 'expense') continue
    const key = categoryOf('expense', t.category).key
    totals.set(key, (totals.get(key) ?? 0) + t.amount)
    sum += t.amount
  }
  return EXPENSE_CATEGORIES.filter((c) => totals.has(c.key))
    .map((c) => ({ category: c, amount: totals.get(c.key)!, percent: sum ? (totals.get(c.key)! / sum) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount)
}

/** Какая часть кредита уже погашена, 0–100 */
export const paidPercent = (total: number, remaining: number): number =>
  total > 0 ? Math.min(100, Math.max(0, Math.round((1 - remaining / total) * 100))) : 100
