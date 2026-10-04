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

/** Сначала желания со сроком — от ближайшего, затем бессрочные в порядке появления. */
export function sortWishes<T extends { date: string | null; createdAt: string }>(items: T[]): T[] {
  const dated = items.filter((w) => w.date).sort((a, b) => a.date!.localeCompare(b.date!) || a.createdAt.localeCompare(b.createdAt))
  const open = items.filter((w) => !w.date).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return [...dated, ...open]
}

export const wishTotal = (items: { price: number }[]): number => items.reduce((sum, w) => sum + w.price, 0)
