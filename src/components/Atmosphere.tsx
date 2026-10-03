import { useEffect, useRef } from 'react'
import { EFFECTS } from '../fx/effects'
import { soundscape } from '../fx/sound'
import { prefersReducedMotion } from '../fx/util'
import { paletteOf, powerOf, useAppearance } from '../theme/appearance'

/** Неподвижный слой за всем приложением: свечение стихии, своя картинка и её эффект. */
export function Atmosphere() {
  const { element, intensity, sound, volume, background } = useAppearance()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const power = powerOf(intensity)
    soundscape.setVisuals(power > 0 && !prefersReducedMotion())
    if (power === 0 || prefersReducedMotion()) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      return
    }

    const effect = EFFECTS[element](paletteOf(element), power)
    // на телефонах с плотным экраном полного разрешения для дыма и огня не нужно
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    let width = 0
    let height = 0
    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    let raf = 0
    let last = performance.now()
    let t = 0
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      t += dt
      effect.frame(ctx, width, height, t, dt)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [element, intensity])

  useEffect(() => soundscape.configure({ enabled: sound, volume, element }), [sound, volume, element])

  return (
    <div className="atmo" aria-hidden="true">
      {background && (
        <>
          <div className="image" style={{ backgroundImage: `url(${background})` }} />
          <div className="veil" />
        </>
      )}
      <canvas ref={canvasRef} />
    </div>
  )
}
