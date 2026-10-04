/** Сколько осталось до дня (или сколько прошло после него) */
export interface TimeLeft {
  /** ahead — день впереди, today — он идёт сейчас, past — уже прошёл */
  state: 'ahead' | 'today' | 'past'
  days: number
  hours: number
}

const HOUR = 3_600_000
const DAY = 24 * HOUR

/** Отсчёт до начала дня 'ГГГГ-ММ-ДД' по местному времени; для прошедшего дня — сколько суток минуло. */
export function timeLeft(date: string, now: Date): TimeLeft {
  const [year, month, day] = date.split('-').map(Number)
  const diff = new Date(year, month - 1, day).getTime() - now.getTime()
  if (diff > 0) {
    const hours = Math.floor(diff / HOUR)
    return { state: 'ahead', days: Math.floor(hours / 24), hours: hours % 24 }
  }
  if (-diff < DAY) return { state: 'today', days: 0, hours: 0 }
  return { state: 'past', days: Math.floor(-diff / DAY), hours: 0 }
}

/** Русское склонение после числа: plural(21, ['день', 'дня', 'дней']) → 'день' */
export function plural(n: number, forms: [string, string, string]): string {
  const tens = Math.abs(n) % 100
  const ones = tens % 10
  if (tens > 10 && tens < 20) return forms[2]
  if (ones === 1) return forms[0]
  if (ones >= 2 && ones <= 4) return forms[1]
  return forms[2]
}

const DAYS: [string, string, string] = ['день', 'дня', 'дней']
const HOURS: [string, string, string] = ['час', 'часа', 'часов']

/** '88 дней 14 часов', 'сегодня', 'прошло 3 дня' */
export function leftText(left: TimeLeft): string {
  if (left.state === 'today') return 'сегодня'
  if (left.state === 'past') return `прошло ${left.days} ${plural(left.days, DAYS)}`
  if (left.days === 0 && left.hours === 0) return 'меньше часа'
  const parts: string[] = []
  if (left.days > 0) parts.push(`${left.days} ${plural(left.days, DAYS)}`)
  if (left.hours > 0) parts.push(`${left.hours} ${plural(left.hours, HOURS)}`)
  return parts.join(' ')
}

/** Грядущие дни — от ближайшего, прошедшие — в конце, от недавнего. */
export function sortByNearness<T extends { date: string }>(items: T[], today: string): T[] {
  const ahead = items.filter((i) => i.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  const past = items.filter((i) => i.date < today).sort((a, b) => b.date.localeCompare(a.date))
  return [...ahead, ...past]
}

/** Мысли дня: старые пословицы и собственные строки в духе пути дракона. */
export const WISDOM = [
  'Путь в тысячу ли начинается с первого шага.',
  'Дракон не рождается в небе — он туда поднимается.',
  'Капля точит камень не силой, а постоянством.',
  'Не бойся идти медленно — бойся стоять на месте.',
  'Меч точат каждый день, а не накануне битвы.',
  'Сегодняшний шаг — завтрашняя вершина.',
  'Гору сдвигает тот, кто начал с малых камней.',
  'Кто победил себя, тому не страшен ни один противник.',
  'Упал семь раз — поднимись восемь.',
  'Тихая река роет глубокое русло.',
  'Сильный преодолеет преграду, мудрый — весь путь.',
  'Лучшее время посадить дерево было двадцать лет назад. Следующее — сегодня.',
  'Чешуя дракона растёт из пройденных дней.',
  'Не жди попутного ветра — расправь крылья.',
  'Огонь внутри не гаснет, пока его кормят делом.',
  'Дисциплина — это мост между целью и её свершением.',
  'Тот, кто идёт, всегда обгонит того, кто собирается.',
  'Сталь становится клинком только после огня и молота.',
  'День без шага вперёд — день, отданный вчерашнему себе.',
  'Яйцо, разбитое снаружи, — конец. Разбитое изнутри — начало.',
  'Вершина покоряется упорному, а не быстрому.',
  'Делай сегодня то, за что завтрашний ты скажет спасибо.',
  'Буря проверяет корни, а не листья.',
  'Малое дело лучше большого намерения.',
  'Небо не падает на тех, кто умеет летать.',
  'Мастер ошибался больше раз, чем ученик пробовал.',
  'Сначала ты ведёшь привычку, потом привычка ведёт тебя.',
  'Жемчужину мудрости находят не на поверхности.',
  'Где воля — там и дорога.',
  'Твой единственный соперник — ты вчерашний.',
  'Долгий путь познаётся шагами, а не взглядом.',
]

/** Мысль на этот день: одна на сутки, меняется в полночь. */
export function wisdomFor(date: Date): string {
  const days = Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / DAY)
  return WISDOM[((days % WISDOM.length) + WISDOM.length) % WISDOM.length]
}
