export interface GoalLevel {
  key: 'star' | 'heaven' | 'mountain' | 'earth' | 'river'
  name: string
  glyph: string
  /** что относить к этому уровню */
  hint: string
  /** ци за завершение */
  reward: number
  /** сколько монет на талисмане: чем важнее цель, тем больше */
  coins: number
  /** цвет шнура по умолчанию */
  color: string
}

/** Уровни важности: индекс 0 — самый жёсткий. Талисман с монетами рисует components/Talisman.tsx */
export const GOAL_LEVELS: GoalLevel[] = [
  { key: 'star', name: 'Звёздный', glyph: '星', hint: 'Вопрос жизни: откладывать нельзя', reward: 500, coins: 5, color: '#e8212f' },
  { key: 'heaven', name: 'Небесный', glyph: '天', hint: 'То, что меняет жизнь', reward: 300, coins: 4, color: '#e6b422' },
  { key: 'mountain', name: 'Горный', glyph: '山', hint: 'Большая вершина, долгий путь', reward: 200, coins: 3, color: '#a259ff' },
  { key: 'earth', name: 'Земной', glyph: '地', hint: 'Важное дело', reward: 100, coins: 2, color: '#2fae7a' },
  { key: 'river', name: 'Речной', glyph: '川', hint: 'Текущие задачи', reward: 50, coins: 1, color: '#35c9d6' },
]

export const levelOf = (index: number): GoalLevel => GOAL_LEVELS[Math.min(GOAL_LEVELS.length - 1, Math.max(0, index))]

/** Цвета шнура на выбор */
export const GOAL_COLORS = ['#e6b422', '#ff7a1a', '#e8212f', '#ff5fa2', '#a259ff', '#3f9dff', '#35c9d6', '#2fae7a', '#d8d8e8']

/** На сколько процентов меняет прогресс одно нажатие на талисман */
export const GOAL_STEP = 5

/**
 * Насколько горит каждая монета талисмана (0–1), сверху вниз: прогресс делится между монетами поровну,
 * поэтому монета, до которой он дошёл, горит частично.
 */
export function coinGlow(progress: number, coins: number): number[] {
  const filled = (Math.min(100, Math.max(0, progress)) / 100) * coins
  return Array.from({ length: coins }, (_, i) => Math.min(1, Math.max(0, filled - i)))
}
