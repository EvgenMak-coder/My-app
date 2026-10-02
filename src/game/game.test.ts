import { describe, expect, it } from 'vitest'
import { rankFor } from './ranks'
import { averageTitan, materialProgress, titanXp } from './titans'
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

describe('materialProgress', () => {
  it.each([
    [0, 'wood'],
    [19, 'wood'],
    [20, 'bronze'],
    [39, 'bronze'],
    [40, 'silver'],
    [60, 'gold'],
    [79, 'gold'],
    [80, 'jade'],
    [100, 'jade'],
  ])('%i → %s', (value, key) => {
    expect(materialProgress(value).material.key).toBe(key)
  })

  it('считает остаток до следующего материала', () => {
    expect(materialProgress(45).left).toBe(15)
    expect(materialProgress(45).next?.key).toBe('gold')
    expect(materialProgress(90).next).toBeNull()
  })
})

describe('titans', () => {
  it('опыт только за рост', () => {
    expect(titanXp(25, 27)).toBe(20)
    expect(titanXp(27, 25)).toBe(0)
  })

  it('среднее по титанам округляется, как в Excel', () => {
    expect(averageTitan([25, 45, 30, 10, 20].map((value) => ({ value })))).toBe(26)
    expect(averageTitan([])).toBe(0)
  })
})
