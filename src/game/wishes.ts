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

/**
 * Насколько сильно хочется: металл монеты и чин желания, от самого слабого к самому сильному.
 * Чины задал владелец (барон, граф, король, император); два младших переложены на китайский лад:
 * мандарин 官 — сановник, князь 侯 — удельный хоу.
 */
export const WISH_LEVELS = [
  { key: 'bronze', name: 'Бронза', rank: 'мандаринское', glyph: '官' },
  { key: 'silver', name: 'Серебро', rank: 'княжеское', glyph: '侯' },
  { key: 'gold', name: 'Золото', rank: 'королевское', glyph: '王' },
  { key: 'jade', name: 'Нефрит', rank: 'императорское', glyph: '皇' },
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
