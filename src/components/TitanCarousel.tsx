import { useEffect, useRef, useState } from 'react'
import { TitanStage, type StatueSpec } from '../fx/titanStage'
import { paletteOf, useAppearance } from '../theme/appearance'

/**
 * Круговая витрина статуэток: листается пальцем, стрелками или касанием края.
 * Статуэтка в центре — выбранный титан. Грузится отдельным куском вместе с three.js.
 */
export default function TitanCarousel({
  statues,
  index,
  onIndex,
  label,
}: {
  statues: StatueSpec[]
  index: number
  onIndex: (index: number) => void
  label: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<TitanStage | null>(null)
  const onIndexRef = useRef(onIndex)
  onIndexRef.current = onIndex
  const [failed, setFailed] = useState(false)
  const { element } = useAppearance()
  // строка вместо массива в зависимостях: статуэтки пересобираются только при настоящей перемене
  const signature = statues.map((s) => `${s.key}:${s.material}`).join(',')

  useEffect(() => {
    const canvas = canvasRef.current!
    let stage: TitanStage
    try {
      stage = new TitanStage(canvas, (i) => onIndexRef.current(i), paletteOf(element).accent)
    } catch {
      // нет WebGL — остаются стрелки и подпись, без статуэток
      setFailed(true)
      return
    }
    stageRef.current = stage
    stage.setStatues(statues)
    stage.setIndex(index)
    stage.start()
    const observer = new ResizeObserver(() => stage.resize())
    observer.observe(canvas)
    return () => {
      observer.disconnect()
      stage.dispose()
      stageRef.current = null
    }
    // сцена создаётся один раз; состав, выбор и цвет обновляются ниже
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => stageRef.current?.setStatues(statues), [signature])
  useEffect(() => stageRef.current?.setIndex(index), [index])
  useEffect(() => stageRef.current?.setAccent(paletteOf(element).accent), [element])

  const count = statues.length
  const step = (direction: 1 | -1) => {
    if (stageRef.current) stageRef.current.shift(direction)
    else onIndex((index + direction + count) % count)
  }

  return (
    <div className="carousel">
      <canvas ref={canvasRef} className={failed ? 'hidden' : ''} role="img" aria-label={label} />
      {failed && <p className="muted carousel-fallback">Объёмные статуэтки на этом устройстве не открылись — титана можно выбрать стрелками.</p>}
      <button className="carousel-arrow prev ghost" aria-label="Предыдущий титан" onClick={() => step(-1)}>
        ‹
      </button>
      <button className="carousel-arrow next ghost" aria-label="Следующий титан" onClick={() => step(1)}>
        ›
      </button>
    </div>
  )
}
