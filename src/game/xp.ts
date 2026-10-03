export const XP_PER_SKILL_POINT = 10
export const XP_PER_AREA_POINT = 5

export interface Stage {
  key: 'egg' | 'hui' | 'hui-elder' | 'jiao' | 'jiao-elder' | 'long' | 'long-elder' | 'jiaolong' | 'yinglong'
  name: string
  /** опыт, с которого начинается стадия */
  from: number
  /** что меняется в облике — внешний вид задаёт fx/dragon.ts по номеру стадии */
  note: string
}

/**
 * Путь взросления — по китайскому канону («Тайпин юйлань», X в.): хуэй 虺 становится цзяо 蛟, цзяо — луном 龍,
 * лун — рогатым цзяо-луном 角龍, а тот — крылатым ин-луном 應龍. Между каноническими ступенями стоят
 * промежуточные, чтобы дракон менялся чаще. Крылья — только на последней: восточный дракон летает без них.
 */
export const STAGES: Stage[] = [
  { key: 'egg', name: 'Яйцо', from: 0, note: 'Скорлупа трескается, жар внутри растёт' },
  { key: 'hui', name: 'Хуэй 虺 — змейка', from: 100, note: 'Вылупился: гладкая змейка без лап, рогов и усов' },
  { key: 'hui-elder', name: 'Старший хуэй', from: 300, note: 'Тело длиннее, по хребту пробивается гребень' },
  { key: 'jiao', name: 'Цзяо 蛟 — водный дракон', from: 700, note: 'Четыре короткие лапы с тремя когтями, чешуя карпа' },
  { key: 'jiao-elder', name: 'Матёрый цзяо', from: 1500, note: 'Клыки и пламенный веер на хвосте' },
  { key: 'long', name: 'Лун 龍 — дракон', from: 3000, note: 'Усы, грива, борода, первые рожки; на лбу нарост чи-му — без него в небо не подняться' },
  { key: 'long-elder', name: 'Зрелый лун', from: 5000, note: 'Рога дают отросток, грива гуще, вокруг тела искры' },
  { key: 'jiaolong', name: 'Цзяо-лун 角龍 — рогатый', from: 8000, note: 'Оленьи рога, пять когтей императора, чи-му светится' },
  { key: 'yinglong', name: 'Ин-лун 應龍 — крылатый', from: 12000, note: 'Крылья и жемчужина мудрости: древний повелитель дождя' },
]

/** Опыт даётся только за рост; откат значения ничего не отнимает. */
export const skillXp = (oldValue: number, newValue: number): number =>
  Math.max(0, newValue - oldValue) * XP_PER_SKILL_POINT

export const areaXp = (oldValue: number, newValue: number): number =>
  Math.max(0, newValue - oldValue) * XP_PER_AREA_POINT

export const totalXp = (events: { amount: number }[]): number => events.reduce((sum, e) => sum + e.amount, 0)

export interface StageProgress {
  index: number
  stage: Stage
  next: Stage | null
  /** доля пути до следующей стадии, 0..1 */
  ratio: number
}

export function stageProgress(xp: number): StageProgress {
  let index = 0
  for (let i = 0; i < STAGES.length; i++) {
    if (xp >= STAGES[i].from) index = i
  }
  const stage = STAGES[index]
  const next = STAGES[index + 1] ?? null
  const ratio = next ? (xp - stage.from) / (next.from - stage.from) : 1
  return { index, stage, next, ratio }
}
