import { LocalStore } from './localStore'
import type { DataStore } from './store'
import { supabase, SupabaseStore } from './supabaseStore'

export const cloudEnabled = supabase !== null
export const store: DataStore = supabase ? new SupabaseStore(supabase) : new LocalStore()
export { supabase }
