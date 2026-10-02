export const XP_PER_TITAN_POINT = 10

export interface Material {
  key: 'wood' | 'bronze' | 'silver' | 'gold' | 'jade'
  name: string
  /** значение показателя, с которого титан переходит в этот материал */
  from: number
}

export const MATERIALS: Material[] = [
  { key: 'wood', name: 'Дерево', from: 0 },
  { key: 'bronze', name: 'Бронза', from: 20 },
  { key: 'silver', name: 'Серебро', from: 40 },
  { key: 'gold', name: 'Золото', from: 60 },
  { key: 'jade', name: 'Нефрит', from: 80 },
]

export interface MaterialProgress {
  index: number
  material: Material
  next: Material | null
  /** сколько пунктов осталось до следующего материала */
  left: number
}

export function materialProgress(value: number): MaterialProgress {
  let index = 0
  for (let i = 0; i < MATERIALS.length; i++) {
    if (value >= MATERIALS[i].from) index = i
  }
  const next = MATERIALS[index + 1] ?? null
  return { index, material: MATERIALS[index], next, left: next ? next.from - value : 0 }
}

/** Опыт даётся только за рост показателя. */
export const titanXp = (oldValue: number, newValue: number): number =>
  Math.max(0, newValue - oldValue) * XP_PER_TITAN_POINT

/** Кто воплощает показатель. Картинки лежат в public/titans/<key>.jpg — см. README там же. */
export const TITAN_HEROES: Record<string, { hero: string; title: string; glyph: string; focus?: string }> = {
  strength: { hero: 'Рагнар', title: 'Викинг', glyph: '力' },
  agility: { hero: 'Зоро', title: 'Самурай', glyph: '迅' },
  endurance: { hero: 'Спартак', title: 'Гладиатор', glyph: '耐' },
  // focus — какая часть картинки остаётся в кадре карточки (CSS object-position)
  burst: { hero: 'Тодзи', title: 'Охотник', glyph: '爆', focus: 'center 70%' },
  flexibility: { hero: 'Алукард', title: 'Вампир', glyph: '柔' },
}

export const averageTitan = (titans: { value: number }[]): number =>
  titans.length ? Math.round(titans.reduce((sum, t) => sum + t.value, 0) / titans.length) : 0
