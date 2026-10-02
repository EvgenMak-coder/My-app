import { averageTitan, titanXp } from '../game/titans'
import { areaXp, skillXp } from '../game/xp'
import type { DataStore } from './store'
import { clamp100, newId, type LifeArea, type Skill, type SkillCategory, type Snapshot } from './types'

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
