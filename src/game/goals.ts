export interface GoalLevel {
  key: 'star' | 'heaven' | 'mountain' | 'earth' | 'river'
  name: string
  glyph: string
  /** что относить к этому уровню */
  hint: string
  /** ци за завершение */
  reward: number
  /** цвет жидкости по умолчанию */
  color: string
}

/** Уровни важности: индекс 0 — самый жёсткий. Форму сосуда по key рисует components/Vessel.tsx */
export const GOAL_LEVELS: GoalLevel[] = [
  { key: 'star', name: 'Звёздный', glyph: '星', hint: 'Вопрос жизни: откладывать нельзя', reward: 500, color: '#e6b422' },
  { key: 'heaven', name: 'Небесный', glyph: '天', hint: 'То, что меняет жизнь', reward: 300, color: '#3f9dff' },
  { key: 'mountain', name: 'Горный', glyph: '山', hint: 'Большая вершина, долгий путь', reward: 200, color: '#a259ff' },
  { key: 'earth', name: 'Земной', glyph: '地', hint: 'Важное дело', reward: 100, color: '#2fae7a' },
  { key: 'river', name: 'Речной', glyph: '川', hint: 'Текущие задачи', reward: 50, color: '#35c9d6' },
]

export const levelOf = (index: number): GoalLevel => GOAL_LEVELS[Math.min(GOAL_LEVELS.length - 1, Math.max(0, index))]

/** Цвета жидкости на выбор */
export const GOAL_COLORS = ['#e6b422', '#ff7a1a', '#e8212f', '#ff5fa2', '#a259ff', '#3f9dff', '#35c9d6', '#2fae7a', '#d8d8e8']

/** На сколько процентов меняет прогресс одно нажатие на сосуд */
export const GOAL_STEP = 5
