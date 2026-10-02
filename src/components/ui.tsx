import type { ReactNode } from 'react'
import { useSnapshot } from '../data/hooks'
import type { Snapshot } from '../data/types'
import { rankFor } from '../game/ranks'

export function Panel({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  )
}

export function Bar({ value, gold = false }: { value: number; gold?: boolean }) {
  return (
    <div className={gold ? 'bar gold' : 'bar'}>
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

export function RankBadge({ value }: { value: number }) {
  const rank = rankFor(value)
  return (
    <span className={`badge ${rank.key}`} title={rank.plain}>
      {rank.name}
    </span>
  )
}

/** Показывает загрузку и ошибку, а детям отдаёт готовые данные. */
export function DataGate({ children }: { children: (snapshot: Snapshot) => ReactNode }) {
  const { data, error, isLoading } = useSnapshot()
  if (isLoading) return <p className="muted">Свиток разворачивается…</p>
  if (error || !data) return <p className="error">Не удалось загрузить данные: {(error as Error | null)?.message}</p>
  return <>{children(data)}</>
}

export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
