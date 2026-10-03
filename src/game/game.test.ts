import { describe, expect, it } from 'vitest'
import { rankFor } from './ranks'
import { averageTitan, materialProgress, titanXp } from './titans'
import {
  chargeDate,
  chargeIn,
  dayKey,
  daysUntil,
  expenseShares,
  isCharged,
  monthKey,
  monthRange,
  nextPayday,
  paidPercent,
  shiftMonth,
} from './treasury'
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

describe('treasury', () => {
  it('считает доли расходов и не учитывает доходы', () => {
    const shares = expenseShares([
      { kind: 'expense', category: 'food', amount: 6000 },
      { kind: 'expense', category: 'home', amount: 3000 },
      { kind: 'expense', category: 'food', amount: 1000 },
      { kind: 'income', category: 'salary', amount: 99999 },
    ])
    expect(shares.map((s) => [s.category.key, s.amount, s.percent])).toEqual([
      ['food', 7000, 70],
      ['home', 3000, 30],
    ])
    expect(expenseShares([])).toEqual([])
  })

  it('подписки и развлечения идут отдельными долями', () => {
    const shares = expenseShares([
      { kind: 'expense', category: 'subscription', amount: 600 },
      { kind: 'expense', category: 'fun', amount: 300 },
      { kind: 'expense', category: 'other', amount: 100 },
    ])
    expect(shares.map((s) => [s.category.name, s.percent])).toEqual([
      ['Подписки', 60],
      ['Развлечения', 30],
      ['Прочее', 10],
    ])
  })

  it('неизвестная категория уходит в «Прочее»', () => {
    expect(expenseShares([{ kind: 'expense', category: 'штаны', amount: 5 }])[0].category.key).toBe('other')
  })

  it('находит ближайшую выплату', () => {
    expect(nextPayday(5, new Date(2026, 9, 2)).getDate()).toBe(5)
    expect(nextPayday(5, new Date(2026, 9, 5)).getMonth()).toBe(9)
    const next = nextPayday(5, new Date(2026, 9, 6))
    expect([next.getMonth(), next.getDate()]).toEqual([10, 5])
    // 31-е число в коротком месяце — последний день месяца
    expect(nextPayday(31, new Date(2026, 1, 10)).getDate()).toBe(28)
    expect(daysUntil(new Date(2026, 9, 5), new Date(2026, 9, 2, 23, 30))).toBe(3)
  })

  it('листает месяцы через границу года', () => {
    expect(monthKey(new Date(2026, 0, 15))).toBe('2026-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  })

  it('даёт выбор месяцев с запасом вперёд и захватывает месяцы с записями', () => {
    const months = monthRange('2026-10', [])
    expect(months[0]).toBe('2026-07')
    expect(months[months.length - 1]).toBe('2027-04')
    expect(months).toContain('2027-01')
    expect(monthRange('2026-10', ['2025-12', '2027-09'])[0]).toBe('2025-12')
    expect(monthRange('2026-10', ['2025-12', '2027-09']).slice(-1)[0]).toBe('2027-09')
  })

  it('считает погашенную часть кредита', () => {
    expect(paidPercent(290000, 253663)).toBe(13)
    expect(paidPercent(140000, 0)).toBe(100)
    expect(paidPercent(0, 0)).toBe(100)
  })

  it('ставит списание подписки на её число, а в коротком месяце — на последний день', () => {
    expect(chargeDate(5, '2026-10')).toBe('2026-10-05')
    expect(chargeDate(31, '2026-11')).toBe('2026-11-30')
    expect(chargeDate(31, '2027-02')).toBe('2027-02-28')
    expect(dayKey(new Date(2026, 9, 3, 23, 50))).toBe('2026-10-03')
  })

  it('считает списание только пока подписка действует', () => {
    const sub = { day: 15, startedAt: '2026-10-01', endedAt: null }
    expect(chargeIn(sub, '2026-09')).toBeNull()
    expect(chargeIn(sub, '2026-10')).toBe('2026-10-15')
    expect(chargeIn(sub, '2027-03')).toBe('2027-03-15')
    const cancelled = { ...sub, endedAt: '2026-12-10' }
    expect(chargeIn(cancelled, '2026-11')).toBe('2026-11-15')
    expect(chargeIn(cancelled, '2026-12')).toBeNull()
    // отменили в день списания — оно уже прошло
    expect(chargeIn({ ...sub, endedAt: '2026-12-15' }, '2026-12')).toBe('2026-12-15')
  })

  it('учитывает списание в общем счёте только с его дня', () => {
    expect(isCharged('2026-10-15', '2026-10-14')).toBe(false)
    expect(isCharged('2026-10-15', '2026-10-15')).toBe(true)
    expect(isCharged('2026-10-15', '2026-11-01')).toBe(true)
  })
})
