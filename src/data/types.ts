import { GOAL_LEVELS } from '../game/goals'

export type SkillCategory = 'hard' | 'soft' | 'hobby'

export interface Skill {
  id: string
  category: SkillCategory
  name: string
  value: number
  position: number
}

export interface LifeArea {
  id: string
  key: string
  name: string
  value: number
  position: number
}

export interface HistoryPoint {
  id: string
  /** id навыка или сферы */
  refId: string
  value: number
  at: string
}

/** Показатель тренировок; его облик и героя задаёт game/titans.ts по key */
export interface Titan {
  id: string
  key: string
  name: string
  value: number
  position: number
}

export interface Workout {
  id: string
  titanId: string
  type: string
  result: string
  /** на сколько пунктов вырос показатель */
  gain: number
  at: string
}

export interface Credit {
  id: string
  name: string
  /** сколько было взято */
  total: number
  /** сколько осталось выплатить */
  remaining: number
  position: number
}

/** Регулярная выплата: приходит каждый месяц в указанное число */
export interface Salary {
  id: string
  name: string
  day: number
  amount: number
}

export interface Transaction {
  id: string
  kind: 'income' | 'expense'
  /** сумма в рублях, всегда положительная */
  amount: number
  /** ключ категории из game/treasury.ts */
  category: string
  note: string
  at: string
}

export interface Goal {
  id: string
  title: string
  /** уровень важности: 0 — звёздный (самый жёсткий) … 4 — речной; см. game/goals.ts */
  level: number
  progress: number
  /** цвет жидкости в сосуде */
  color: string
  /** опыт за завершение уже выдан — повторно после возврата из архива не начисляется */
  rewarded: boolean
  createdAt: string
  /** когда завершена; null — цель в работе, иначе в архиве */
  doneAt: string | null
  position: number
}

export type XpSource = 'skill' | 'area' | 'deed' | 'titan' | 'goal'

export interface XpEvent {
  id: string
  source: XpSource
  amount: number
  note: string
  at: string
}

export interface Profile {
  dragonName: string
}

export interface Snapshot {
  version: 1
  profile: Profile
  areas: LifeArea[]
  skills: Skill[]
  areaHistory: HistoryPoint[]
  skillHistory: HistoryPoint[]
  xpEvents: XpEvent[]
  titans: Titan[]
  titanHistory: HistoryPoint[]
  workouts: Workout[]
  goals: Goal[]
  credits: Credit[]
  salaries: Salary[]
  transactions: Transaction[]
}

/** Формат, который пишет scripts/import_excel.py */
export interface Seed {
  areas: { key: string; name: string; value: number }[]
  skills: { category: SkillCategory; name: string; value: number }[]
  titans?: { key: string; value: number }[]
  goals?: { title: string; level: number; progress: number }[]
  credits?: { name: string; total: number; remaining: number }[]
  salaries?: { name: string; day: number; amount: number }[]
}

export const DEFAULT_AREAS: { key: string; name: string }[] = [
  { key: 'spirit', name: 'Дух' },
  { key: 'health', name: 'Здоровье' },
  { key: 'money', name: 'Деньги' },
  { key: 'sport', name: 'Спорт' },
  { key: 'happiness', name: 'Счастье' },
]

export const DEFAULT_TITANS: { key: string; name: string }[] = [
  { key: 'strength', name: 'Сила' },
  { key: 'agility', name: 'Ловкость' },
  { key: 'endurance', name: 'Выносливость' },
  { key: 'burst', name: 'Взрывная выносливость' },
  { key: 'flexibility', name: 'Растяжка' },
]

export const newId = (): string => crypto.randomUUID()

export const clamp100 = (v: number): number => Math.min(100, Math.max(0, Math.round(v)))

export function defaultTitans(values: Record<string, number> = {}): Titan[] {
  return DEFAULT_TITANS.map((t, i) => ({
    id: newId(),
    key: t.key,
    name: t.name,
    value: clamp100(values[t.key] ?? 0),
    position: i,
  }))
}

/** Данные, сохранённые до появления тренировок, дополняются пустыми титанами и журналом. */
export function normalizeSnapshot(s: Snapshot): Snapshot {
  if (!Array.isArray(s.titans) || s.titans.length === 0) s.titans = defaultTitans()
  if (!Array.isArray(s.titanHistory)) s.titanHistory = []
  if (!Array.isArray(s.workouts)) s.workouts = []
  if (!Array.isArray(s.goals)) s.goals = []
  if (!Array.isArray(s.credits)) s.credits = []
  if (!Array.isArray(s.salaries)) s.salaries = []
  if (!Array.isArray(s.transactions)) s.transactions = []
  return s
}

export function emptySnapshot(): Snapshot {
  return {
    version: 1,
    profile: { dragonName: 'Небесный дракон' },
    areas: DEFAULT_AREAS.map((a, i) => ({ id: newId(), key: a.key, name: a.name, value: 0, position: i })),
    skills: [],
    areaHistory: [],
    skillHistory: [],
    xpEvents: [],
    titans: defaultTitans(),
    titanHistory: [],
    workouts: [],
    goals: [],
    credits: [],
    salaries: [],
    transactions: [],
  }
}

/** Свежий снимок из seed-файла: новые id, по одной начальной точке истории, без опыта. */
export function snapshotFromSeed(seed: Seed): Snapshot {
  const at = new Date().toISOString()
  const areas: LifeArea[] = seed.areas.map((a, i) => ({
    id: newId(),
    key: a.key,
    name: a.name,
    value: clamp100(a.value),
    position: i,
  }))
  const skills: Skill[] = seed.skills.map((s, i) => ({
    id: newId(),
    category: s.category,
    name: s.name,
    value: clamp100(s.value),
    position: i,
  }))
  const titans = defaultTitans(Object.fromEntries((seed.titans ?? []).map((t) => [t.key, t.value])))
  return {
    version: 1,
    profile: { dragonName: 'Небесный дракон' },
    areas,
    skills,
    titans,
    titanHistory: titans.map((t) => ({ id: newId(), refId: t.id, value: t.value, at })),
    workouts: [],
    goals: (seed.goals ?? []).map((g, i) => ({
      id: newId(),
      title: g.title,
      level: g.level,
      progress: clamp100(g.progress),
      color: GOAL_LEVELS[g.level]?.color ?? GOAL_LEVELS[3].color,
      rewarded: false,
      createdAt: at,
      doneAt: null,
      position: i,
    })),
    credits: (seed.credits ?? []).map((c, i) => ({ id: newId(), name: c.name, total: c.total, remaining: c.remaining, position: i })),
    salaries: (seed.salaries ?? []).map((s) => ({ id: newId(), name: s.name, day: s.day, amount: s.amount })),
    transactions: [],
    areaHistory: areas.map((a) => ({ id: newId(), refId: a.id, value: a.value, at })),
    skillHistory: skills.map((s) => ({ id: newId(), refId: s.id, value: s.value, at })),
    xpEvents: [],
  }
}

/** Принимает и резервную копию (Snapshot), и seed из Excel. */
export function parseImport(json: unknown): Snapshot {
  if (!json || typeof json !== 'object') throw new Error('Файл не похож на данные приложения')
  const obj = json as Record<string, unknown>
  if (!Array.isArray(obj.areas) || !Array.isArray(obj.skills)) {
    throw new Error('В файле нет списков areas и skills')
  }
  if (obj.version === 1) return normalizeSnapshot(obj as unknown as Snapshot)
  return snapshotFromSeed(obj as unknown as Seed)
}
