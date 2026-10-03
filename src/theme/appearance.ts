import { useSyncExternalStore } from 'react'

/** Оформление хранится на устройстве: у телефона и ПК могут быть свои стихия и фон. */

// цвета повторяют tokens.css: холсту (дракон, эффекты фона) нужны готовые значения
export const ELEMENTS = [
  { key: 'ember', name: 'Пламя', color: '#ff7a1a', bright: '#ffc078', deep: '#8a2f00' },
  { key: 'blood', name: 'Кровь', color: '#e8212f', bright: '#ff7a7f', deep: '#6d0a12' },
  { key: 'storm', name: 'Гроза', color: '#3f9dff', bright: '#b4dcff', deep: '#0f3a7a' },
  { key: 'shadow', name: 'Тень', color: '#a259ff', bright: '#d9b8ff', deep: '#3a1778' },
] as const

export type ElementKey = (typeof ELEMENTS)[number]['key']

export function paletteOf(key: ElementKey): { accent: string; bright: string; deep: string } {
  const el = ELEMENTS.find((e) => e.key === key) ?? ELEMENTS[0]
  return { accent: el.color, bright: el.bright, deep: el.deep }
}

/** Насколько бурно ведёт себя фон; power — множитель для эффектов из fx/effects.ts */
export const INTENSITIES = [
  { key: 'off', name: 'Выкл', power: 0 },
  { key: 'calm', name: 'Спокойно', power: 0.55 },
  { key: 'normal', name: 'Обычно', power: 1 },
  { key: 'wild', name: 'Буйство', power: 1.8 },
] as const

export type IntensityKey = (typeof INTENSITIES)[number]['key']

export const powerOf = (key: IntensityKey): number => INTENSITIES.find((i) => i.key === key)?.power ?? 1

export interface Appearance {
  element: ElementKey
  intensity: IntensityKey
  /** звук стихии; по умолчанию выключен */
  sound: boolean
  /** громкость 0…1 */
  volume: number
  /** своя картинка фона (data URL) или null */
  background: string | null
}

const ELEMENT_KEY = 'heavenly-dragon:element'
const BACKGROUND_KEY = 'heavenly-dragon:background'
const INTENSITY_KEY = 'heavenly-dragon:intensity'
const SOUND_KEY = 'heavenly-dragon:sound'
const VOLUME_KEY = 'heavenly-dragon:volume'

function read(): Appearance {
  let element: ElementKey = 'ember'
  let background: string | null = null
  let intensity: IntensityKey = 'normal'
  let sound = false
  let volume = 0.6
  try {
    sound = localStorage.getItem(SOUND_KEY) === 'on'
    const savedVolume = Number(localStorage.getItem(VOLUME_KEY))
    if (savedVolume > 0 && savedVolume <= 1) volume = savedVolume
    const level = localStorage.getItem(INTENSITY_KEY)
    if (INTENSITIES.some((i) => i.key === level)) intensity = level as IntensityKey
    const saved = localStorage.getItem(ELEMENT_KEY)
    if (ELEMENTS.some((e) => e.key === saved)) element = saved as ElementKey
    background = localStorage.getItem(BACKGROUND_KEY)
  } catch {
    // хранилище недоступно — остаёмся на значениях по умолчанию
  }
  return { element, intensity, sound, volume, background }
}

let current = read()
const listeners = new Set<() => void>()

function apply(next: Appearance): void {
  current = next
  document.documentElement.dataset.element = next.element
  listeners.forEach((l) => l())
}

export function initAppearance(): void {
  apply(current)
}

export function setElement(element: ElementKey): void {
  try {
    localStorage.setItem(ELEMENT_KEY, element)
  } catch {
    // выбор подействует до перезагрузки
  }
  apply({ ...current, element })
}

export function setIntensity(intensity: IntensityKey): void {
  try {
    localStorage.setItem(INTENSITY_KEY, intensity)
  } catch {
    // выбор подействует до перезагрузки
  }
  apply({ ...current, intensity })
}

export function setSound(sound: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, sound ? 'on' : 'off')
  } catch {
    // выбор подействует до перезагрузки
  }
  apply({ ...current, sound })
}

export function setVolume(volume: number): void {
  try {
    localStorage.setItem(VOLUME_KEY, String(volume))
  } catch {
    // выбор подействует до перезагрузки
  }
  apply({ ...current, volume })
}

/** Бросает ошибку, если картинка не поместилась в хранилище. */
export function setBackground(background: string | null): void {
  if (background) localStorage.setItem(BACKGROUND_KEY, background)
  else localStorage.removeItem(BACKGROUND_KEY)
  apply({ ...current, background })
}

export function useAppearance(): Appearance {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current,
  )
}

/** Уменьшает картинку до 1280 px по длинной стороне и сжимает в JPEG. */
export async function imageToDataUrl(file: File, maxSide = 1280): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.82)
}
