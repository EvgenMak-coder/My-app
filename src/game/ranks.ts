export interface Rank {
  key: 'low' | 'medium' | 'high' | 'professional' | 'extra'
  /** фэнтезийное название */
  name: string
  /** исходное название из Excel */
  plain: string
  /** верхняя граница, не включая */
  below: number
}

// Границы — как в формуле листа «Навыки»: <21, <51, <71, <96, выше
export const RANKS: Rank[] = [
  { key: 'low', name: 'Ученик', plain: 'Low skill', below: 21 },
  { key: 'medium', name: 'Адепт', plain: 'Medium skill', below: 51 },
  { key: 'high', name: 'Мастер', plain: 'High skill', below: 71 },
  { key: 'professional', name: 'Старейшина', plain: 'Professional skill', below: 96 },
  { key: 'extra', name: 'Небожитель', plain: 'Extra skill', below: Infinity },
]

export function rankFor(value: number): Rank {
  return RANKS.find((r) => value < r.below) ?? RANKS[RANKS.length - 1]
}
