import type { DataStore } from './store'
import { emptySnapshot, type HistoryPoint, type LifeArea, type Skill, type Snapshot, type XpEvent } from './types'

const KEY = 'heavenly-dragon:v1'

export class LocalStore implements DataStore {
  private read(): Snapshot {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) return JSON.parse(raw) as Snapshot
    } catch {
      // повреждённые данные — начинаем с чистого листа
    }
    const fresh = emptySnapshot()
    this.write(fresh)
    return fresh
  }

  private write(s: Snapshot): void {
    localStorage.setItem(KEY, JSON.stringify(s))
  }

  private mutate(fn: (s: Snapshot) => void): Promise<void> {
    const s = this.read()
    fn(s)
    this.write(s)
    return Promise.resolve()
  }

  load(): Promise<Snapshot> {
    return Promise.resolve(this.read())
  }

  saveSkill(skill: Skill): Promise<void> {
    return this.mutate((s) => {
      const i = s.skills.findIndex((x) => x.id === skill.id)
      if (i >= 0) s.skills[i] = skill
      else s.skills.push(skill)
    })
  }

  deleteSkill(id: string): Promise<void> {
    return this.mutate((s) => {
      s.skills = s.skills.filter((x) => x.id !== id)
      s.skillHistory = s.skillHistory.filter((h) => h.refId !== id)
    })
  }

  saveArea(area: LifeArea): Promise<void> {
    return this.mutate((s) => {
      const i = s.areas.findIndex((x) => x.id === area.id)
      if (i >= 0) s.areas[i] = area
      else s.areas.push(area)
    })
  }

  addSkillHistory(point: HistoryPoint): Promise<void> {
    return this.mutate((s) => void s.skillHistory.push(point))
  }

  addAreaHistory(point: HistoryPoint): Promise<void> {
    return this.mutate((s) => void s.areaHistory.push(point))
  }

  addXp(event: XpEvent): Promise<void> {
    return this.mutate((s) => void s.xpEvents.push(event))
  }

  setDragonName(name: string): Promise<void> {
    return this.mutate((s) => {
      s.profile.dragonName = name
    })
  }

  replaceAll(snapshot: Snapshot): Promise<void> {
    this.write(snapshot)
    return Promise.resolve()
  }
}
