import { describe, expect, it } from 'vitest'
import { rankFor } from './ranks'
import { areaXp, skillXp, stageProgress, totalXp } from './xp'

describe('rankFor', () => {
  it.each([
    [0, 'low'],
    [20, 'low'],
    [21, 'medium'],
    [50, 'medium'],
    [51, 'high'],
    [70, 'high'],
    [71, 'professional'],
    [95, 'professional'],
    [96, 'extra'],
    [100, 'extra'],
  ])('%i → %s', (value, key) => {
    expect(rankFor(value).key).toBe(key)
  })
})

describe('xp', () => {
  it('даёт опыт только за рост', () => {
    expect(skillXp(40, 44)).toBe(40)
    expect(skillXp(44, 40)).toBe(0)
    expect(areaXp(10, 12)).toBe(10)
    expect(areaXp(12, 12)).toBe(0)
  })

  it('суммирует события', () => {
    expect(totalXp([{ amount: 10 }, { amount: 25 }])).toBe(35)
    expect(totalXp([])).toBe(0)
  })
})

describe('stageProgress', () => {
  it.each([
    [0, 'egg'],
    [99, 'egg'],
    [100, 'hatchling'],
    [299, 'hatchling'],
    [300, 'serpent'],
    [700, 'horned'],
    [1500, 'young'],
    [3000, 'river'],
    [5000, 'mountain'],
    [8000, 'ancient'],
    [11999, 'ancient'],
    [12000, 'celestial'],
  ])('%i опыта → %s', (xp, key) => {
    expect(stageProgress(xp).stage.key).toBe(key)
  })

  it('считает долю пути до следующей стадии', () => {
    expect(stageProgress(50).ratio).toBe(0.5)
    expect(stageProgress(200).ratio).toBe(0.5)
  })

  it('на последней стадии следующей нет', () => {
    const p = stageProgress(99999)
    expect(p.next).toBeNull()
    expect(p.ratio).toBe(1)
  })
})
