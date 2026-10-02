import { areaXp, skillXp } from '../game/xp'
import type { DataStore } from './store'
import { clamp100, newId, type LifeArea, type Skill, type SkillCategory } from './types'

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
