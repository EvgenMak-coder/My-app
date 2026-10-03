import { levelOf } from '../game/goals'
import { averageTitan, titanXp } from '../game/titans'
import { chargeDate, dayKey, monthKey } from '../game/treasury'
import { areaXp, skillXp } from '../game/xp'
import type { DataStore } from './store'
import {
  clamp100,
  newId,
  type Credit,
  type Goal,
  type LifeArea,
  type Salary,
  type Skill,
  type SkillCategory,
  type Snapshot,
  type Subscription,
  type Transaction,
} from './types'

const now = (): string => new Date().toISOString()

export async function changeSkill(store: DataStore, skill: Skill, value: number): Promise<void> {
  const v = clamp100(value)
  if (v === skill.value) return
  const at = now()
  await store.saveSkill({ ...skill, value: v })
  await store.addSkillHistory({ id: newId(), refId: skill.id, value: v, at })
  const xp = skillXp(skill.value, v)
  if (xp > 0) {
    await store.addXp({ id: newId(), source: 'skill', amount: xp, note: `${skill.name}: ${skill.value} → ${v}`, at })
  }
}

export async function createSkill(
  store: DataStore,
  category: SkillCategory,
  name: string,
  value: number,
  position: number,
): Promise<void> {
  const skill: Skill = { id: newId(), category, name: name.trim(), value: clamp100(value), position }
  await store.saveSkill(skill)
  await store.addSkillHistory({ id: newId(), refId: skill.id, value: skill.value, at: now() })
}

export async function changeArea(store: DataStore, area: LifeArea, value: number): Promise<void> {
  const v = clamp100(value)
  if (v === area.value) return
  const at = now()
  await store.saveArea({ ...area, value: v })
  await store.addAreaHistory({ id: newId(), refId: area.id, value: v, at })
  const xp = areaXp(area.value, v)
  if (xp > 0) {
    await store.addXp({ id: newId(), source: 'area', amount: xp, note: `${area.name}: ${area.value} → ${v}`, at })
  }
}

export async function addDeed(store: DataStore, note: string, amount: number): Promise<void> {
  await store.addXp({ id: newId(), source: 'deed', amount, note: note.trim(), at: now() })
}

export interface WorkoutInput {
  titanId: string
  type: string
  result: string
  gain: number
  /** дата тренировки, ISO */
  at: string
}

/** Запись в журнал: поднимает показатель титана, даёт опыт и пересчитывает сферу «Спорт». */
export async function logWorkout(store: DataStore, snapshot: Snapshot, input: WorkoutInput): Promise<void> {
  const titan = snapshot.titans.find((t) => t.id === input.titanId)
  if (!titan) throw new Error('Титан не найден')
  const value = clamp100(titan.value + Math.max(0, Math.round(input.gain)))
  const gain = value - titan.value

  await store.addWorkout({
    id: newId(),
    titanId: titan.id,
    type: input.type.trim(),
    result: input.result.trim(),
    gain,
    at: input.at,
  })
  if (gain === 0) return

  const at = now()
  await store.saveTitan({ ...titan, value })
  await store.addTitanHistory({ id: newId(), refId: titan.id, value, at })
  await store.addXp({
    id: newId(),
    source: 'titan',
    amount: titanXp(titan.value, value),
    note: `${titan.name}: ${titan.value} → ${value}`,
    at,
  })

  // «Спорт» в Колесе жизни — среднее по титанам; опыт за него отдельно не даём, он уже начислен выше
  const sport = snapshot.areas.find((a) => a.key === 'sport')
  const average = averageTitan(snapshot.titans.map((t) => (t.id === titan.id ? { value } : t)))
  if (sport && sport.value !== average) {
    await store.saveArea({ ...sport, value: average })
    await store.addAreaHistory({ id: newId(), refId: sport.id, value: average, at })
  }
}

export async function createGoal(
  store: DataStore,
  title: string,
  level: number,
  color: string,
  position: number,
): Promise<void> {
  await store.saveGoal({
    id: newId(),
    title: title.trim(),
    level,
    progress: 0,
    color,
    rewarded: false,
    createdAt: now(),
    doneAt: null,
    position,
  })
}

export async function changeGoalProgress(store: DataStore, goal: Goal, progress: number): Promise<void> {
  const value = clamp100(progress)
  if (value !== goal.progress) await store.saveGoal({ ...goal, progress: value })
}

/** Цель уходит в архив; опыт за неё даётся один раз, сколько бы её ни возвращали. */
export async function completeGoal(store: DataStore, goal: Goal): Promise<void> {
  const at = now()
  await store.saveGoal({ ...goal, progress: 100, doneAt: at, rewarded: true })
  if (!goal.rewarded) {
    const level = levelOf(goal.level)
    await store.addXp({ id: newId(), source: 'goal', amount: level.reward, note: `Цель (${level.name.toLowerCase()} уровень): ${goal.title}`, at })
  }
}

export async function restoreGoal(store: DataStore, goal: Goal): Promise<void> {
  await store.saveGoal({ ...goal, doneAt: null })
}

const rubles = (amount: number): number => Math.max(0, Math.round(amount))

export async function addTransaction(store: DataStore, entry: Omit<Transaction, 'id'>): Promise<void> {
  await store.addTransaction({ ...entry, id: newId(), amount: rubles(entry.amount) })
}

const dayOfMonth = (day: number): number => Math.min(31, Math.max(1, Math.round(day) || 1))

export async function createSalary(store: DataStore, name: string, day: number, amount: number): Promise<void> {
  await store.saveSalary({ id: newId(), name: name.trim(), day: dayOfMonth(day), amount: rubles(amount) })
}

/** Выплата пришла: записываем доход сегодняшним числом. */
export async function receiveSalary(store: DataStore, salary: Salary): Promise<void> {
  await store.addTransaction({
    id: newId(),
    kind: 'income',
    amount: salary.amount,
    category: 'salary',
    note: salary.name,
    at: now(),
  })
}

export async function createCredit(
  store: DataStore,
  name: string,
  total: number,
  remaining: number,
  position: number,
): Promise<void> {
  await store.saveCredit({
    id: newId(),
    name: name.trim(),
    total: rubles(total),
    remaining: Math.min(rubles(total), rubles(remaining)),
    position,
  })
}

/** Платёж уменьшает остаток долга; в расходы по категориям он не попадает. */
export async function payCredit(store: DataStore, credit: Credit, amount: number): Promise<void> {
  await store.saveCredit({ ...credit, remaining: Math.max(0, credit.remaining - rubles(amount)) })
}

/** Долг вырос: начислены проценты или потрачено ещё с кредитки. Если остаток перерос исходную сумму, поднимаем и её. */
export async function growCredit(store: DataStore, credit: Credit, amount: number): Promise<void> {
  const remaining = credit.remaining + rubles(amount)
  await store.saveCredit({ ...credit, remaining, total: Math.max(credit.total, remaining) })
}

/** Точная правка кредита — вписать цифры как в банке. */
export async function updateCredit(
  store: DataStore,
  credit: Credit,
  name: string,
  total: number,
  remaining: number,
): Promise<void> {
  const owed = rubles(remaining)
  await store.saveCredit({ ...credit, name: name.trim(), remaining: owed, total: Math.max(rubles(total), owed) })
}

export interface SubscriptionInput {
  name: string
  amount: number
  day: number
}

const monthStart = (date: Date): string => `${monthKey(date)}-01`

/** Подписка считается с начала текущего месяца: если её число уже прошло, списание этого месяца учтено. */
export async function createSubscription(store: DataStore, input: SubscriptionInput, today = new Date()): Promise<void> {
  await store.saveSubscription({
    id: newId(),
    name: input.name.trim(),
    amount: rubles(input.amount),
    day: dayOfMonth(input.day),
    startedAt: monthStart(today),
    endedAt: null,
  })
}

/**
 * Правка подписки. Новая цена действует с текущего месяца: если подписка тянется из прошлых месяцев,
 * старая запись закрывается их последним днём и уходит в архив, а дальше считается новая — прошлое не пересчитывается.
 */
export async function updateSubscription(
  store: DataStore,
  sub: Subscription,
  input: SubscriptionInput,
  today = new Date(),
): Promise<void> {
  const next: Subscription = {
    ...sub,
    name: input.name.trim(),
    amount: rubles(input.amount),
    day: dayOfMonth(input.day),
  }
  const start = monthStart(today)
  if (next.amount === sub.amount || sub.startedAt >= start) {
    await store.saveSubscription(next)
    return
  }
  const lastDayBefore = dayKey(new Date(today.getFullYear(), today.getMonth(), 0))
  await store.saveSubscription({ ...sub, endedAt: lastDayBefore })
  await store.saveSubscription({ ...next, id: newId(), startedAt: start })
}

/** Отмена: прошлые списания остаются в статистике, подписка уходит в архив. Ни разу не списанная просто удаляется. */
export async function cancelSubscription(store: DataStore, sub: Subscription, today = new Date()): Promise<void> {
  const firstCharge = chargeDate(sub.day, sub.startedAt.slice(0, 7))
  if (firstCharge > dayKey(today)) await store.deleteSubscription(sub.id)
  else await store.saveSubscription({ ...sub, endedAt: dayKey(today) })
}

/** Возврат из архива. Отменённая давно возвращается новой записью с этого месяца, чтобы не появились списания за пропущенное время. */
export async function resumeSubscription(store: DataStore, sub: Subscription, today = new Date()): Promise<void> {
  const start = monthStart(today)
  if (sub.endedAt && sub.endedAt >= start) await store.saveSubscription({ ...sub, endedAt: null })
  else await store.saveSubscription({ ...sub, id: newId(), startedAt: start, endedAt: null })
}
