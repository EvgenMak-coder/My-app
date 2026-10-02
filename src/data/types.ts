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

export type XpSource = 'skill' | 'area' | 'deed'

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
}

/** Формат, который пишет scripts/import_excel.py */
export interface Seed {
  areas: { key: string; name: string; value: number }[]
  skills: { category: SkillCategory; name: string; value: number }[]
}

export const DEFAULT_AREAS: { key: string; name: string }[] = [
  { key: 'spirit', name: 'Дух' },
  { key: 'health', name: 'Здоровье' },
  { key: 'money', name: 'Деньги' },
  { key: 'sport', name: 'Спорт' },
  { key: 'happiness', name: 'Счастье' },
]

export const newId = (): string => crypto.randomUUID()

export const clamp100 = (v: number): number => Math.min(100, Math.max(0, Math.round(v)))

export function emptySnapshot(): Snapshot {
  return {
    version: 1,
    profile: { dragonName: 'Небесный дракон' },
    areas: DEFAULT_AREAS.map((a, i) => ({ id: newId(), key: a.key, name: a.name, value: 0, position: i })),
    skills: [],
    areaHistory: [],
    skillHistory: [],
    xpEvents: [],
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
  return {
    version: 1,
    profile: { dragonName: 'Небесный дракон' },
    areas,
    skills,
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
  if (obj.version === 1) return obj as unknown as Snapshot
  return snapshotFromSeed(obj as unknown as Seed)
}
