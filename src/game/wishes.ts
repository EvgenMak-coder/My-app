import { plural } from './countdown'

const DAY = 86_400_000
const DAYS: [string, string, string] = ['день', 'дня', 'дней']

const dayStart = (key: string): number => {
  const [year, month, day] = key.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

/** Сколько календарных дней от today до date (оба 'ГГГГ-ММ-ДД'); отрицательное — срок уже прошёл. */
export const daysTo = (date: string, today: string): number => Math.round((dayStart(date) - dayStart(today)) / DAY)

/** 'сегодня', 'завтра', 'через 12 дней', 'срок прошёл 3 дня назад' */
export function dueText(date: string, today: string): string {
  const days = daysTo(date, today)
  if (days === 0) return 'сегодня'
  if (days === 1) return 'завтра'
  if (days > 0) return `через ${days} ${plural(days, DAYS)}`
  return `срок прошёл ${-days} ${plural(-days, DAYS)} назад`
}

/** Насколько сильно хочется: металл монеты у желания, от самого слабого к самому сильному. */
export const WISH_LEVELS = [
  { key: 'bronze', name: 'Бронза', hint: 'было бы неплохо' },
  { key: 'silver', name: 'Серебро', hint: 'хочу' },
  { key: 'gold', name: 'Золото', hint: 'очень хочу' },
  { key: 'jade', name: 'Нефрит', hint: 'мечта' },
] as const

export const wishLevel = (level: number) => WISH_LEVELS[Math.min(WISH_LEVELS.length - 1, Math.max(0, Math.round(level) || 0))]

/** Сначала самые желанные (нефрит → бронза); внутри металла — со сроком от ближайшего, затем бессрочные в порядке появления. */
export function sortWishes<T extends { level: number; date: string | null; createdAt: string }>(items: T[]): T[] {
  const byTime = (a: T, b: T): number => {
    if (a.date && b.date) return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)
    if (a.date || b.date) return a.date ? -1 : 1
    return a.createdAt.localeCompare(b.createdAt)
  }
  return [...items].sort((a, b) => b.level - a.level || byTime(a, b))
}

export const wishTotal = (items: { price: number }[]): number => items.reduce((sum, w) => sum + w.price, 0)
