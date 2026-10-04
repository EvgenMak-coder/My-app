import { useEffect, useRef, useState } from 'react'
import { sharedStage, type StatueSpec, type TitanStage } from '../fx/titanStage'
import { paletteOf, useAppearance } from '../theme/appearance'

/**
 * Круговая витрина статуэток: листается пальцем, стрелками или касанием края.
 * Статуэтка в центре — выбранный титан. Сама сцена одна на всё приложение и готовится заранее,
 * при входе (см. app/Preloader), поэтому здесь её холст просто вставляется на страницу.
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
  const boxRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<TitanStage | null>(null)
  const onIndexRef = useRef(onIndex)
  onIndexRef.current = onIndex
  const [failed, setFailed] = useState(false)
  const { element } = useAppearance()
  // строка вместо массива в зависимостях: материалы обновляются только при настоящей перемене
  const signature = statues.map((s) => `${s.key}:${s.material}`).join(',')

  useEffect(() => {
    let stage: TitanStage
    try {
      stage = sharedStage()
    } catch {
      // нет WebGL — остаются стрелки и подпись, без статуэток
      setFailed(true)
      return
    }
    const canvas = stage.canvas
    canvas.setAttribute('role', 'img')
    boxRef.current!.prepend(canvas)
    stageRef.current = stage
    stage.onIndex = (i) => onIndexRef.current(i)
    stage.setAccent(paletteOf(element).accent)
    stage.setStatues(statues)
    stage.setIndex(index)
    stage.start()
    const observer = new ResizeObserver(() => stage.resize())
    observer.observe(canvas)
    // витрина, прокрученная за край экрана, не рисуется — бережём батарею
    const watcher = new IntersectionObserver(([entry]) => (entry.isIntersecting ? stage.start() : stage.stop()))
    watcher.observe(canvas)
    return () => {
      observer.disconnect()
      watcher.disconnect()
      // сцена остаётся жить до следующего захода в раздел, только перестаёт рисовать
      stage.stop()
      stage.onIndex = () => {}
      canvas.remove()
      stageRef.current = null
    }
    // холст вставляется один раз; состав, выбор и цвет обновляются ниже
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => stageRef.current?.setStatues(statues), [signature])
  useEffect(() => stageRef.current?.setIndex(index), [index])
  useEffect(() => stageRef.current?.setAccent(paletteOf(element).accent), [element])
  useEffect(() => stageRef.current?.canvas.setAttribute('aria-label', label), [label])

  const count = statues.length
  const step = (direction: 1 | -1) => {
    if (stageRef.current) stageRef.current.shift(direction)
    else onIndex((index + direction + count) % count)
  }

  return (
    <div className="carousel" ref={boxRef}>
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
