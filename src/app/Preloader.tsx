import { useEffect, useState } from 'react'
import { DEFAULT_TITANS } from '../data/types'

const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Заставка при входе. Пока она на экране, заранее лепятся статуэтки титанов и прогревается их сцена —
 * чтобы потом раздел «Тренировки» открывался сразу, без ожидания.
 * Кольцо и иероглиф движутся средствами CSS: такая анимация не замирает, пока идёт лепка.
 */
export function Preloader() {
  const count = DEFAULT_TITANS.length
  const [done, setDone] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      const started = performance.now()
      try {
        const [{ sculptStatue }, { sharedStage }] = await Promise.all([import('../fx/statues'), import('../fx/titanStage')])
        for (const [i, titan] of DEFAULT_TITANS.entries()) {
          // пауза — чтобы экран успел показать продвижение
          await pause(40)
          sculptStatue(titan.key)
          if (alive) setDone(i + 1)
        }
        await pause(40)
        const stage = sharedStage()
        stage.setStatues(DEFAULT_TITANS.map((titan) => ({ key: titan.key, material: 'wood' as const })))
        stage.warm()
      } catch {
        // нет WebGL или не скачалась сцена — приложение работает и без статуэток
      }
      // слишком короткая заставка только мелькает
      await pause(Math.max(0, 900 - (performance.now() - started)))
      if (!alive) return
      setLeaving(true)
      await pause(600)
      if (alive) setGone(true)
    })()
    return () => {
      alive = false
    }
  }, [])

  if (gone) return null
  return (
    <div className={`preloader${leaving ? ' leaving' : ''}`} role="status" aria-live="polite">
      <div className="preloader-seal" aria-hidden="true">
        <svg className="enso" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" />
        </svg>
        <svg className="enso inner" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="36" />
        </svg>
        <span>龍</span>
      </div>
      <p className="preloader-title">Дракон пробуждается</p>
      <p className="muted">
        {done < count ? `Мастер высекает титанов · ${done} из ${count}` : 'Титаны встают на постаменты'}
      </p>
      <div className="bar">
        <span style={{ width: `${(done / count) * 100}%` }} />
      </div>
    </div>
  )
}
