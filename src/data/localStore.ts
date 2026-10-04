import type { DataStore } from './store'
import {
  emptySnapshot,
  normalizeSnapshot,
  type Countdown,
  type Credit,
  type Goal,
  type HistoryPoint,
  type LifeArea,
  type Salary,
  type Skill,
  type Snapshot,
  type Subscription,
  type Titan,
  type Transaction,
  type Workout,
  type XpEvent,
} from './types'

const KEY = 'heavenly-dragon:v1'

export class LocalStore implements DataStore {
  protected read(): Snapshot {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) return normalizeSnapshot(JSON.parse(raw) as Snapshot)
    } catch {
      // повреждённые данные — начинаем с чистого листа
    }
    const fresh = emptySnapshot()
    this.write(fresh)
    return fresh
  }

  protected write(s: Snapshot): void {
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

  saveTitan(titan: Titan): Promise<void> {
    return this.mutate((s) => {
      const i = s.titans.findIndex((x) => x.id === titan.id)
      if (i >= 0) s.titans[i] = titan
      else s.titans.push(titan)
    })
  }

  addTitanHistory(point: HistoryPoint): Promise<void> {
    return this.mutate((s) => void s.titanHistory.push(point))
  }

  addWorkout(workout: Workout): Promise<void> {
    return this.mutate((s) => void s.workouts.push(workout))
  }

  saveGoal(goal: Goal): Promise<void> {
    return this.mutate((s) => {
      const i = s.goals.findIndex((x) => x.id === goal.id)
      if (i >= 0) s.goals[i] = goal
      else s.goals.push(goal)
    })
  }

  deleteGoal(id: string): Promise<void> {
    return this.mutate((s) => {
      s.goals = s.goals.filter((x) => x.id !== id)
    })
  }

  saveCredit(credit: Credit): Promise<void> {
    return this.mutate((s) => {
      const i = s.credits.findIndex((x) => x.id === credit.id)
      if (i >= 0) s.credits[i] = credit
      else s.credits.push(credit)
    })
  }

  deleteCredit(id: string): Promise<void> {
    return this.mutate((s) => {
      s.credits = s.credits.filter((x) => x.id !== id)
    })
  }

  saveSalary(salary: Salary): Promise<void> {
    return this.mutate((s) => {
      const i = s.salaries.findIndex((x) => x.id === salary.id)
      if (i >= 0) s.salaries[i] = salary
      else s.salaries.push(salary)
    })
  }

  deleteSalary(id: string): Promise<void> {
    return this.mutate((s) => {
      s.salaries = s.salaries.filter((x) => x.id !== id)
    })
  }

  addTransaction(transaction: Transaction): Promise<void> {
    return this.mutate((s) => void s.transactions.push(transaction))
  }

  deleteTransaction(id: string): Promise<void> {
    return this.mutate((s) => {
      s.transactions = s.transactions.filter((x) => x.id !== id)
    })
  }

  saveSubscription(subscription: Subscription): Promise<void> {
    return this.mutate((s) => {
      const i = s.subscriptions.findIndex((x) => x.id === subscription.id)
      if (i >= 0) s.subscriptions[i] = subscription
      else s.subscriptions.push(subscription)
    })
  }

  deleteSubscription(id: string): Promise<void> {
    return this.mutate((s) => {
      s.subscriptions = s.subscriptions.filter((x) => x.id !== id)
    })
  }

  saveCountdown(countdown: Countdown): Promise<void> {
    return this.mutate((s) => {
      const i = s.countdowns.findIndex((x) => x.id === countdown.id)
      if (i >= 0) s.countdowns[i] = countdown
      else s.countdowns.push(countdown)
    })
  }

  deleteCountdown(id: string): Promise<void> {
    return this.mutate((s) => {
      s.countdowns = s.countdowns.filter((x) => x.id !== id)
    })
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

/**
 * Хранилище в памяти поверх готового снимка. На нём действие проигрывается заранее,
 * чтобы экран обновился сразу, не дожидаясь ответа облака (см. useAction).
 */
export class MemoryStore extends LocalStore {
  constructor(public snapshot: Snapshot) {
    super()
  }

  protected read(): Snapshot {
    return this.snapshot
  }

  protected write(s: Snapshot): void {
    this.snapshot = s
  }
}
