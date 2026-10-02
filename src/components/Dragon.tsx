import { useEffect, useRef } from 'react'
import { DragonScene } from '../fx/dragon'
import { paletteOf, useAppearance } from '../theme/appearance'

/** Живой дракон на холсте: level — номер стадии, ratio — доля пути до следующей. */
export function Dragon({ level, ratio, label }: { level: number; ratio: number; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<DragonScene | null>(null)
  const { element } = useAppearance()

  useEffect(() => {
    const canvas = canvasRef.current!
    const scene = new DragonScene(canvas, paletteOf(element))
    sceneRef.current = scene
    scene.setProgress(level, ratio)
    scene.start()
    const observer = new ResizeObserver(() => scene.resize())
    observer.observe(canvas)
    return () => {
      observer.disconnect()
      scene.stop()
    }
    // сцена создаётся один раз; уровень и цвета обновляются ниже
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => sceneRef.current?.setProgress(level, ratio), [level, ratio])
  useEffect(() => sceneRef.current?.setPalette(paletteOf(element)), [element])

  return <canvas ref={canvasRef} className="dragon" role="img" aria-label={label} />
}
