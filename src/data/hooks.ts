import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { store, supabase } from './index'
import { MemoryStore } from './localStore'
import type { DataStore } from './store'
import type { Snapshot } from './types'

const SNAPSHOT = ['snapshot']

export function useSnapshot() {
  return useQuery<Snapshot>({ queryKey: SNAPSHOT, queryFn: () => store.load() })
}

/**
 * Выполняет действие над хранилищем. Экран обновляется сразу: то же действие сначала проигрывается
 * на копии данных в памяти, а настоящее сохранение и сверка с облаком идут следом.
 * Если сохранить не удалось, экран возвращается к прежнему состоянию.
 */
export function useAction<A>(fn: (store: DataStore, arg: A) => Promise<void>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (arg: A) => fn(store, arg),
    onMutate: async (arg: A) => {
      // уже летящая загрузка не должна затереть то, что мы сейчас покажем
      await qc.cancelQueries({ queryKey: SNAPSHOT })
      const before = qc.getQueryData<Snapshot>(SNAPSHOT)
      if (before) {
        const draft = new MemoryStore(structuredClone(before))
        try {
          await fn(draft, arg)
          qc.setQueryData(SNAPSHOT, draft.snapshot)
        } catch {
          // репетиция не удалась — ошибку покажет настоящее сохранение
        }
      }
      return { before }
    },
    onError: (_error, _arg, context) => {
      if (context?.before) qc.setQueryData(SNAPSHOT, context.before)
    },
    // сверяемся с облаком, когда закончилось последнее из действий подряд: иначе ответ
    // на первое нажатие на миг откатил бы второе
    onSettled: () => {
      if (qc.isMutating() <= 1) void qc.invalidateQueries({ queryKey: SNAPSHOT })
    },
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
