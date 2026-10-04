import { describe, expect, it } from 'vitest'
import { leftText, plural, sortByNearness, timeLeft, wisdomFor } from './countdown'
import { daysTo, dueText, sortWishes, WISH_LEVELS, wishLevel, wishTotal } from './wishes'
import { coinGlow, GOAL_LEVELS } from './goals'
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
    [100, 'hui'],
    [299, 'hui'],
    [300, 'hui-elder'],
    [700, 'jiao'],
    [1500, 'jiao-elder'],
    [3000, 'long'],
    [5000, 'long-elder'],
    [8000, 'jiaolong'],
    [11999, 'jiaolong'],
    [12000, 'yinglong'],
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

describe('countdown', () => {
  it('считает дни и часы до начала дня', () => {
    const now = new Date(2026, 9, 4, 10, 30)
    expect(timeLeft('2027-01-01', now)).toEqual({ state: 'ahead', days: 88, hours: 13 })
    expect(timeLeft('2026-10-05', now)).toEqual({ state: 'ahead', days: 0, hours: 13 })
    expect(timeLeft('2026-10-04', now).state).toBe('today')
    expect(timeLeft('2026-10-01', now)).toEqual({ state: 'past', days: 3, hours: 0 })
  })

  it('склоняет дни и часы', () => {
    expect([1, 2, 5, 11, 21, 22, 112].map((n) => plural(n, ['день', 'дня', 'дней']))).toEqual(['день', 'дня', 'дней', 'дней', 'день', 'дня', 'дней'])
    expect(leftText({ state: 'ahead', days: 88, hours: 13 })).toBe('88 дней 13 часов')
    expect(leftText({ state: 'ahead', days: 1, hours: 1 })).toBe('1 день 1 час')
    expect(leftText({ state: 'ahead', days: 0, hours: 3 })).toBe('3 часа')
    expect(leftText({ state: 'ahead', days: 0, hours: 0 })).toBe('меньше часа')
    expect(leftText({ state: 'today', days: 0, hours: 0 })).toBe('сегодня')
    expect(leftText({ state: 'past', days: 3, hours: 0 })).toBe('прошло 3 дня')
  })

  it('ставит ближайшие дни первыми, прошедшие — в конец', () => {
    const items = [{ date: '2026-09-01' }, { date: '2027-01-01' }, { date: '2026-10-04' }, { date: '2026-10-01' }, { date: '2026-11-07' }]
    expect(sortByNearness(items, '2026-10-04').map((i) => i.date)).toEqual(['2026-10-04', '2026-11-07', '2027-01-01', '2026-10-01', '2026-09-01'])
  })

  it('даёт одну мысль на день и меняет её назавтра', () => {
    expect(wisdomFor(new Date(2026, 9, 4, 1))).toBe(wisdomFor(new Date(2026, 9, 4, 23)))
    expect(wisdomFor(new Date(2026, 9, 4))).not.toBe(wisdomFor(new Date(2026, 9, 5)))
  })
})

describe('wishes', () => {
  it('считает календарные дни до срока', () => {
    expect(daysTo('2026-10-05', '2026-10-04')).toBe(1)
    expect(daysTo('2027-01-01', '2026-10-04')).toBe(89)
    expect(daysTo('2026-10-01', '2026-10-04')).toBe(-3)
    // переход на зимнее время не съедает день
    expect(daysTo('2026-11-02', '2026-10-24')).toBe(9)
  })

  it('пишет срок словами', () => {
    expect(dueText('2026-10-04', '2026-10-04')).toBe('сегодня')
    expect(dueText('2026-10-05', '2026-10-04')).toBe('завтра')
    expect(dueText('2026-10-25', '2026-10-04')).toBe('через 21 день')
    expect(dueText('2026-10-01', '2026-10-04')).toBe('срок прошёл 3 дня назад')
  })

  it('ставит самые желанные первыми, внутри металла — со сроком, затем бессрочные по порядку появления', () => {
    const items = [
      { title: 'б', level: 0, date: null, createdAt: '2026-02-01' },
      { title: 'в', level: 0, date: '2027-05-01', createdAt: '2026-03-01' },
      { title: 'а', level: 0, date: null, createdAt: '2026-01-01' },
      { title: 'г', level: 0, date: '2026-12-01', createdAt: '2026-04-01' },
      { title: 'мечта', level: 3, date: null, createdAt: '2026-05-01' },
      { title: 'золото', level: 2, date: null, createdAt: '2026-06-01' },
    ]
    expect(sortWishes(items).map((w) => w.title)).toEqual(['мечта', 'золото', 'г', 'в', 'а', 'б'])
  })

  it('металл монеты: четыре ступени, чужие значения прижимаются к краям', () => {
    expect(WISH_LEVELS.map((l) => l.key)).toEqual(['bronze', 'silver', 'gold', 'jade'])
    expect(wishLevel(2).name).toBe('Золото')
    expect(WISH_LEVELS.map((l) => l.rank)).toEqual(['мандаринское', 'княжеское', 'королевское', 'императорское'])
    expect(wishLevel(9).key).toBe('jade')
    expect(wishLevel(-1).key).toBe('bronze')
    expect(wishLevel(NaN).key).toBe('bronze')
  })

  it('складывает цены', () => {
    expect(wishTotal([{ price: 250000 }, { price: 0 }, { price: 1500 }])).toBe(251500)
    expect(wishTotal([])).toBe(0)
  })
})

describe('goals', () => {
  it('чем важнее цель, тем больше монет: от пяти до одной', () => {
    expect(GOAL_LEVELS.map((l) => l.coins)).toEqual([5, 4, 3, 2, 1])
  })

  it('зажигает монеты по очереди, последнюю — частично', () => {
    expect(coinGlow(0, 5)).toEqual([0, 0, 0, 0, 0])
    expect(coinGlow(50, 5)).toEqual([1, 1, 0.5, 0, 0])
    expect(coinGlow(100, 3)).toEqual([1, 1, 1])
    expect(coinGlow(250, 2)).toEqual([1, 1])
    // 5% звёздной цели — четверть первой монеты, 5% речной — двадцатая часть единственной
    expect(coinGlow(5, 5)[0]).toBeCloseTo(0.25)
    expect(coinGlow(5, 1)[0]).toBeCloseTo(0.05)
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
