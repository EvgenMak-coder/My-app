export const XP_PER_SKILL_POINT = 10
export const XP_PER_AREA_POINT = 5

export interface Stage {
  key: 'egg' | 'hatchling' | 'serpent' | 'horned' | 'young' | 'river' | 'mountain' | 'ancient' | 'celestial'
  name: string
  /** опыт, с которого начинается стадия */
  from: number
  /** что меняется в облике — внешний вид задаёт fx/dragon.ts по номеру стадии */
  note: string
}

export const STAGES: Stage[] = [
  { key: 'egg', name: 'Яйцо', from: 0, note: 'Скорлупа трескается, жар внутри растёт' },
  { key: 'hatchling', name: 'Змеёныш', from: 100, note: 'Вылупился: короткое гладкое тело' },
  { key: 'serpent', name: 'Змей', from: 300, note: 'Тело длиннее, по хребту — светящийся гребень' },
  { key: 'horned', name: 'Рогатый змей', from: 700, note: 'Первые рожки, усы и кисть на хвосте' },
  { key: 'young', name: 'Юный дракон', from: 1500, note: 'Лапы с когтями и грива' },
  { key: 'river', name: 'Речной дракон', from: 3000, note: 'Рога с отростками, клыки, грива гуще' },
  { key: 'mountain', name: 'Горный дракон', from: 5000, note: 'Вокруг тела поднимаются искры' },
  { key: 'ancient', name: 'Древний дракон', from: 8000, note: 'Ветвистые рога и знак на лбу' },
  { key: 'celestial', name: 'Небесный дракон', from: 12000, note: 'Гонится за жемчужиной мудрости' },
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
