import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { store, supabase } from './index'
import type { DataStore } from './store'
import type { Snapshot } from './types'

const SNAPSHOT = ['snapshot']

export function useSnapshot() {
  return useQuery<Snapshot>({ queryKey: SNAPSHOT, queryFn: () => store.load() })
}

/** Выполняет действие над хранилищем и перечитывает данные. */
export function useAction<A>(fn: (store: DataStore, arg: A) => Promise<void>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (arg: A) => fn(store, arg),
    onSettled: () => qc.invalidateQueries({ queryKey: SNAPSHOT }),
  })
}

/** undefined — ещё проверяем, null — не вошли. */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    if (!supabase) {
      setSession(null)
      return
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  return session
}
