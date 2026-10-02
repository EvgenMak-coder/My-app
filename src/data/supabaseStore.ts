import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { DataStore } from './store'
import {
  DEFAULT_AREAS,
  newId,
  type HistoryPoint,
  type LifeArea,
  type Skill,
  type SkillCategory,
  type Snapshot,
  type XpEvent,
  type XpSource,
} from './types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null

interface Result<T> {
  data: T | null
  error: { message: string } | null
}

function rows<T>(res: Result<T[]>): T[] {
  if (res.error) throw new Error(res.error.message)
  return res.data ?? []
}

function check(res: { error: { message: string } | null }): void {
  if (res.error) throw new Error(res.error.message)
}

interface SkillRow { id: string; category: SkillCategory; name: string; value: number; position: number }
interface AreaRow { id: string; key: string; name: string; value: number; position: number }
interface SkillHistoryRow { id: string; skill_id: string; value: number; at: string }
interface AreaHistoryRow { id: string; area_id: string; value: number; at: string }
interface XpRow { id: string; source: XpSource; amount: number; note: string; at: string }

// user_id в строках не передаём — в базе стоит default auth.uid(), а RLS не пускает к чужим данным
export class SupabaseStore implements DataStore {
  constructor(private db: SupabaseClient) {}

  async load(): Promise<Snapshot> {
    const [profile, areas, skills, areaHistory, skillHistory, xp] = await Promise.all([
      this.db.from('profile').select('dragon_name').maybeSingle(),
      this.db.from('life_areas').select('id,key,name,value,position').order('position'),
      this.db.from('skills').select('id,category,name,value,position').order('position'),
      this.db.from('life_area_history').select('id,area_id,value,at').order('at'),
      this.db.from('skill_history').select('id,skill_id,value,at').order('at'),
      this.db.from('xp_events').select('id,source,amount,note,at').order('at'),
    ])
    if (profile.error) throw new Error(profile.error.message)

    let areaList: LifeArea[] = rows<AreaRow>(areas)
    if (areaList.length === 0) {
      areaList = DEFAULT_AREAS.map((a, i) => ({ id: newId(), key: a.key, name: a.name, value: 0, position: i }))
      check(await this.db.from('life_areas').insert(areaList))
    }

    return {
      version: 1,
      profile: { dragonName: (profile.data?.dragon_name as string | undefined) ?? 'Небесный дракон' },
      areas: areaList,
      skills: rows<SkillRow>(skills),
      areaHistory: rows<AreaHistoryRow>(areaHistory).map((h) => ({ id: h.id, refId: h.area_id, value: h.value, at: h.at })),
      skillHistory: rows<SkillHistoryRow>(skillHistory).map((h) => ({ id: h.id, refId: h.skill_id, value: h.value, at: h.at })),
      xpEvents: rows<XpRow>(xp),
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
    await this.setDragonName(s.profile.dragonName)
  }
}
