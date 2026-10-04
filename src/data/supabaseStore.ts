import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { DataStore } from './store'
import {
  DEFAULT_AREAS,
  defaultTitans,
  newId,
  type HistoryPoint,
  type LifeArea,
  type Skill,
  type SkillCategory,
  type Countdown,
  type Credit,
  type Goal,
  type Salary,
  type Snapshot,
  type Subscription,
  type Titan,
  type Transaction,
  type Wish,
  type Workout,
  type XpEvent,
  type XpSource,
} from './types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// VITE_STORAGE=local (режим `npm run dev:local`) — работать без облака даже при заданных ключах:
// так приложение можно смотреть и проверять без входа, на тестовых данных в браузере
const forceLocal = import.meta.env.VITE_STORAGE === 'local'

export const supabase: SupabaseClient | null = url && key && !forceLocal ? createClient(url, key) : null

interface Failure {
  message: string
  code?: string
}

interface Result<T> {
  data: T | null
  error: Failure | null
}

// таблицы ещё нет: приложение обновилось раньше, чем в Supabase выполнили свежую миграцию
const tableMissing = (error: Failure | null): boolean =>
  !!error && (error.code === 'PGRST205' || error.code === '42P01')

const NO_SUBSCRIPTIONS = 'В облаке ещё нет таблицы подписок — выполни в Supabase файл 0005_subscriptions.sql'
const NO_WISHES = 'В облаке ещё нет таблицы желаний — выполни в Supabase файл 0007_wishes.sql'
const NO_COUNTDOWNS = 'В облаке ещё нет таблицы грядущих дней — выполни в Supabase файл 0006_countdowns.sql'

function rows<T>(res: Result<T[]>): T[] {
  if (res.error) throw new Error(res.error.message)
  return res.data ?? []
}

function check(res: { error: Failure | null }): void {
  if (res.error) throw new Error(res.error.message)
}

interface SkillRow { id: string; category: SkillCategory; name: string; value: number; position: number }
interface AreaRow { id: string; key: string; name: string; value: number; position: number }
interface SkillHistoryRow { id: string; skill_id: string; value: number; at: string }
interface AreaHistoryRow { id: string; area_id: string; value: number; at: string }
interface TitanRow { id: string; key: string; name: string; value: number; position: number }
interface TitanHistoryRow { id: string; titan_id: string; value: number; at: string }
interface WorkoutRow { id: string; titan_id: string; type: string; result: string; gain: number; at: string }
interface GoalRow { id: string; title: string; level: number; progress: number; color: string; rewarded: boolean; created_at: string; done_at: string | null; position: number }
interface SubscriptionRow { id: string; name: string; amount: number; day: number; started_at: string; ended_at: string | null }
interface WishRow { id: string; title: string; price: number; date: string | null; created_at: string; done_at: string | null }
interface XpRow { id: string; source: XpSource; amount: number; note: string; at: string }

const subscriptionRow = (s: Subscription): SubscriptionRow => ({
  id: s.id,
  name: s.name,
  amount: s.amount,
  day: s.day,
  started_at: s.startedAt,
  ended_at: s.endedAt,
})

const wishRow = (w: Wish): WishRow => ({
  id: w.id,
  title: w.title,
  price: w.price,
  date: w.date,
  created_at: w.createdAt,
  done_at: w.doneAt,
})

// user_id в строках не передаём — в базе стоит default auth.uid(), а RLS не пускает к чужим данным
export class SupabaseStore implements DataStore {
  constructor(private db: SupabaseClient) {}

  async load(): Promise<Snapshot> {
    const [profile, areas, skills, areaHistory, skillHistory, xp, titans, titanHistory, workouts, goals, credits, salaries, transactions, subscriptions, countdowns, wishes] = await Promise.all([
      this.db.from('profile').select('dragon_name').maybeSingle(),
      this.db.from('life_areas').select('id,key,name,value,position').order('position'),
      this.db.from('skills').select('id,category,name,value,position').order('position'),
      this.db.from('life_area_history').select('id,area_id,value,at').order('at'),
      this.db.from('skill_history').select('id,skill_id,value,at').order('at'),
      this.db.from('xp_events').select('id,source,amount,note,at').order('at'),
      this.db.from('titans').select('id,key,name,value,position').order('position'),
      this.db.from('titan_history').select('id,titan_id,value,at').order('at'),
      this.db.from('workouts').select('id,titan_id,type,result,gain,at').order('at'),
      this.db.from('goals').select('id,title,level,progress,color,rewarded,created_at,done_at,position').order('position'),
      this.db.from('credits').select('id,name,total,remaining,position').order('position'),
      this.db.from('salaries').select('id,name,day,amount').order('day'),
      this.db.from('transactions').select('id,kind,amount,category,note,at').order('at'),
      this.db.from('subscriptions').select('id,name,amount,day,started_at,ended_at').order('day'),
      this.db.from('countdowns').select('id,title,date').order('date'),
      this.db.from('wishes').select('id,title,price,date,created_at,done_at').order('created_at'),
    ])
    if (profile.error) throw new Error(profile.error.message)

    let areaList: LifeArea[] = rows<AreaRow>(areas)
    if (areaList.length === 0) {
      areaList = DEFAULT_AREAS.map((a, i) => ({ id: newId(), key: a.key, name: a.name, value: 0, position: i }))
      check(await this.db.from('life_areas').insert(areaList))
    }

    let titanList: Titan[] = rows<TitanRow>(titans)
    if (titanList.length === 0) {
      titanList = defaultTitans()
      check(await this.db.from('titans').insert(titanList))
    }

    return {
      version: 1,
      profile: { dragonName: (profile.data?.dragon_name as string | undefined) ?? 'Небесный дракон' },
      areas: areaList,
      skills: rows<SkillRow>(skills),
      areaHistory: rows<AreaHistoryRow>(areaHistory).map((h) => ({ id: h.id, refId: h.area_id, value: h.value, at: h.at })),
      skillHistory: rows<SkillHistoryRow>(skillHistory).map((h) => ({ id: h.id, refId: h.skill_id, value: h.value, at: h.at })),
      xpEvents: rows<XpRow>(xp),
      titans: titanList,
      credits: rows<Credit>(credits),
      salaries: rows<Salary>(salaries),
      transactions: rows<Transaction>(transactions),
      countdowns: tableMissing(countdowns.error) ? [] : rows<Countdown>(countdowns),
      wishes: (tableMissing(wishes.error) ? [] : rows<WishRow>(wishes)).map((r) => ({
        id: r.id,
        title: r.title,
        price: r.price,
        date: r.date,
        createdAt: r.created_at,
        doneAt: r.done_at,
      })),
      // без таблицы подписок остальное приложение продолжает работать
      subscriptions: (tableMissing(subscriptions.error) ? [] : rows<SubscriptionRow>(subscriptions)).map((r) => ({
        id: r.id,
        name: r.name,
        amount: r.amount,
        day: r.day,
        startedAt: r.started_at,
        endedAt: r.ended_at,
      })),
      goals: rows<GoalRow>(goals).map((g) => ({ id: g.id, title: g.title, level: g.level, progress: g.progress, color: g.color, rewarded: g.rewarded, createdAt: g.created_at, doneAt: g.done_at, position: g.position })),
      titanHistory: rows<TitanHistoryRow>(titanHistory).map((h) => ({ id: h.id, refId: h.titan_id, value: h.value, at: h.at })),
      workouts: rows<WorkoutRow>(workouts).map((w) => ({ id: w.id, titanId: w.titan_id, type: w.type, result: w.result, gain: w.gain, at: w.at })),
    }
  }

  async saveSkill(skill: Skill): Promise<void> {
    check(await this.db.from('skills').upsert(skill))
  }

  async deleteSkill(id: string): Promise<void> {
    check(await this.db.from('skills').delete().eq('id', id))
  }

  async saveArea(area: LifeArea): Promise<void> {
    check(await this.db.from('life_areas').upsert(area))
  }

  async addSkillHistory(p: HistoryPoint): Promise<void> {
    check(await this.db.from('skill_history').insert({ id: p.id, skill_id: p.refId, value: p.value, at: p.at }))
  }

  async addAreaHistory(p: HistoryPoint): Promise<void> {
    check(await this.db.from('life_area_history').insert({ id: p.id, area_id: p.refId, value: p.value, at: p.at }))
  }

  async addXp(e: XpEvent): Promise<void> {
    check(await this.db.from('xp_events').insert(e))
  }

  async saveTitan(titan: Titan): Promise<void> {
    check(await this.db.from('titans').upsert(titan))
  }

  async addTitanHistory(p: HistoryPoint): Promise<void> {
    check(await this.db.from('titan_history').insert({ id: p.id, titan_id: p.refId, value: p.value, at: p.at }))
  }

  async addWorkout(w: Workout): Promise<void> {
    check(
      await this.db
        .from('workouts')
        .insert({ id: w.id, titan_id: w.titanId, type: w.type, result: w.result, gain: w.gain, at: w.at }),
    )
  }

  async saveGoal(g: Goal): Promise<void> {
    check(await this.db.from('goals').upsert({ id: g.id, title: g.title, level: g.level, progress: g.progress, color: g.color, rewarded: g.rewarded, created_at: g.createdAt, done_at: g.doneAt, position: g.position }))
  }

  async deleteGoal(id: string): Promise<void> {
    check(await this.db.from('goals').delete().eq('id', id))
  }

  async saveCredit(credit: Credit): Promise<void> {
    check(await this.db.from('credits').upsert(credit))
  }

  async deleteCredit(id: string): Promise<void> {
    check(await this.db.from('credits').delete().eq('id', id))
  }

  async saveSalary(salary: Salary): Promise<void> {
    check(await this.db.from('salaries').upsert(salary))
  }

  async deleteSalary(id: string): Promise<void> {
    check(await this.db.from('salaries').delete().eq('id', id))
  }

  async addTransaction(transaction: Transaction): Promise<void> {
    check(await this.db.from('transactions').insert(transaction))
  }

  async deleteTransaction(id: string): Promise<void> {
    check(await this.db.from('transactions').delete().eq('id', id))
  }

  async saveSubscription(subscription: Subscription): Promise<void> {
    const res = await this.db.from('subscriptions').upsert(subscriptionRow(subscription))
    if (tableMissing(res.error)) throw new Error(NO_SUBSCRIPTIONS)
    check(res)
  }

  async deleteSubscription(id: string): Promise<void> {
    check(await this.db.from('subscriptions').delete().eq('id', id))
  }

  async saveCountdown(countdown: Countdown): Promise<void> {
    const res = await this.db.from('countdowns').upsert(countdown)
    if (tableMissing(res.error)) throw new Error(NO_COUNTDOWNS)
    check(res)
  }

  async deleteCountdown(id: string): Promise<void> {
    check(await this.db.from('countdowns').delete().eq('id', id))
  }

  async saveWish(wish: Wish): Promise<void> {
    const res = await this.db.from('wishes').upsert(wishRow(wish))
    if (tableMissing(res.error)) throw new Error(NO_WISHES)
    check(res)
  }

  async deleteWish(id: string): Promise<void> {
    check(await this.db.from('wishes').delete().eq('id', id))
  }

  async setDragonName(name: string): Promise<void> {
    const { data, error } = await this.db.auth.getUser()
    if (error || !data.user) throw new Error('Нужно войти в аккаунт')
    check(await this.db.from('profile').upsert({ user_id: data.user.id, dragon_name: name }))
  }

  async replaceAll(s: Snapshot): Promise<void> {
    // история удаляется каскадом вместе с навыками и сферами
    const all = '00000000-0000-0000-0000-000000000000'
    check(await this.db.from('xp_events').delete().neq('id', all))
    check(await this.db.from('skills').delete().neq('id', all))
    check(await this.db.from('life_areas').delete().neq('id', all))
    // журнал и история титанов удаляются каскадом
    check(await this.db.from('titans').delete().neq('id', all))
    check(await this.db.from('goals').delete().neq('id', all))
    check(await this.db.from('credits').delete().neq('id', all))
    check(await this.db.from('salaries').delete().neq('id', all))
    check(await this.db.from('transactions').delete().neq('id', all))
    const cleared = await this.db.from('subscriptions').delete().neq('id', all)
    if (!tableMissing(cleared.error)) check(cleared)
    const emptied = await this.db.from('countdowns').delete().neq('id', all)
    if (!tableMissing(emptied.error)) check(emptied)
    const wiped = await this.db.from('wishes').delete().neq('id', all)
    if (!tableMissing(wiped.error)) check(wiped)

    if (s.areas.length) check(await this.db.from('life_areas').insert(s.areas))
    if (s.skills.length) check(await this.db.from('skills').insert(s.skills))
    if (s.areaHistory.length) {
      check(
        await this.db
          .from('life_area_history')
          .insert(s.areaHistory.map((p) => ({ id: p.id, area_id: p.refId, value: p.value, at: p.at }))),
      )
    }
    if (s.skillHistory.length) {
      check(
        await this.db
          .from('skill_history')
          .insert(s.skillHistory.map((p) => ({ id: p.id, skill_id: p.refId, value: p.value, at: p.at }))),
      )
    }
    if (s.xpEvents.length) check(await this.db.from('xp_events').insert(s.xpEvents))
    if (s.titans.length) check(await this.db.from('titans').insert(s.titans))
    if (s.credits.length) check(await this.db.from('credits').insert(s.credits))
    if (s.salaries.length) check(await this.db.from('salaries').insert(s.salaries))
    if (s.transactions.length) check(await this.db.from('transactions').insert(s.transactions))
    if (s.countdowns.length) {
      const res = await this.db.from('countdowns').insert(s.countdowns)
      if (tableMissing(res.error)) throw new Error(NO_COUNTDOWNS)
      check(res)
    }
    if (s.wishes.length) {
      const res = await this.db.from('wishes').insert(s.wishes.map(wishRow))
      if (tableMissing(res.error)) throw new Error(NO_WISHES)
      check(res)
    }
    if (s.subscriptions.length) {
      const res = await this.db.from('subscriptions').insert(s.subscriptions.map(subscriptionRow))
      if (tableMissing(res.error)) throw new Error(NO_SUBSCRIPTIONS)
      check(res)
    }
    if (s.goals.length) check(await this.db.from('goals').insert(s.goals.map((g) => ({ id: g.id, title: g.title, level: g.level, progress: g.progress, color: g.color, rewarded: g.rewarded, created_at: g.createdAt, done_at: g.doneAt, position: g.position }))))
    if (s.titanHistory.length) {
      check(
        await this.db
          .from('titan_history')
          .insert(s.titanHistory.map((p) => ({ id: p.id, titan_id: p.refId, value: p.value, at: p.at }))),
      )
    }
    if (s.workouts.length) {
      check(
        await this.db
          .from('workouts')
          .insert(s.workouts.map((w) => ({ id: w.id, titan_id: w.titanId, type: w.type, result: w.result, gain: w.gain, at: w.at }))),
      )
    }
    await this.setDragonName(s.profile.dragonName)
  }
}
