import type { Credit, Goal, HistoryPoint, LifeArea, Skill, Salary, Snapshot, Subscription, Titan, Transaction, Workout, XpEvent } from './types'

/** Примитивы хранения. Игровая логика (опыт, история) живёт в actions.ts. */
export interface DataStore {
  load(): Promise<Snapshot>
  saveSkill(skill: Skill): Promise<void>
  deleteSkill(id: string): Promise<void>
  saveArea(area: LifeArea): Promise<void>
  addSkillHistory(point: HistoryPoint): Promise<void>
  addAreaHistory(point: HistoryPoint): Promise<void>
  addXp(event: XpEvent): Promise<void>
  saveTitan(titan: Titan): Promise<void>
  addTitanHistory(point: HistoryPoint): Promise<void>
  addWorkout(workout: Workout): Promise<void>
  saveGoal(goal: Goal): Promise<void>
  deleteGoal(id: string): Promise<void>
  saveCredit(credit: Credit): Promise<void>
  deleteCredit(id: string): Promise<void>
  saveSalary(salary: Salary): Promise<void>
  deleteSalary(id: string): Promise<void>
  addTransaction(transaction: Transaction): Promise<void>
  deleteTransaction(id: string): Promise<void>
  saveSubscription(subscription: Subscription): Promise<void>
  deleteSubscription(id: string): Promise<void>
  setDragonName(name: string): Promise<void>
  /** Полностью заменяет все данные пользователя. */
  replaceAll(snapshot: Snapshot): Promise<void>
}
