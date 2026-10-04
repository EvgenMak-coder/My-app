import { useEffect, useRef, useState, type PointerEvent } from 'react'

/** Кольцо долей: каждая доля — дуга своего цвета. В середину можно положить подпись (children). */
export function Donut({ parts }: { parts: { key: string; value: number; color: string }[] }) {
  const radius = 38.5
  const length = Math.PI * 2 * radius
  const total = parts.reduce((sum, p) => sum + p.value, 0)
  // зазор между долями; у единственной доли кольцо сплошное
  const gap = parts.length > 1 ? length / 180 : 0
  let start = 0

  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <g transform="rotate(-90 50 50)" fill="none" strokeWidth={15}>
        {total > 0 &&
          parts.map((p) => {
            const arc = (p.value / total) * length
            const offset = -start
            start += arc
            return (
              <circle
                key={p.key}
                cx={50}
                cy={50}
                r={radius}
                stroke={p.color}
                strokeDasharray={`${Math.max(0.01, arc - gap)} ${length}`}
                strokeDashoffset={offset}
              />
            )
          })}
      </g>
    </svg>
  )
}

/** Круглые отметки шкалы: 4–6 делений с шагом 1, 2 или 5 на степень десяти. */
function niceTicks(min: number, max: number): number[] {
  if (min === max) return [min]
  const rough = (max - min) / 4
  const power = Math.pow(10, Math.floor(Math.log10(rough)))
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= rough) ?? rough
  const ticks: number[] = []
  for (let v = Math.floor(min / step) * step; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 1e6) / 1e6)
  return ticks
}

const PAD = { left: 38, right: 14, top: 12, bottom: 26 }
const HEIGHT = 280

/**
 * Линия роста: точки стоят через равные промежутки в порядке записи.
 * Касание или наведение показывает значение ближайшей точки.
 */
export function LineChart({ data, domain }: { data: { label: string; value: number }[]; domain?: [number, number] }) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.observe(el)
    setWidth(el.clientWidth)
    return () => observer.disconnect()
  }, [])

  const values = data.map((d) => d.value)
  const ticks = niceTicks(domain ? domain[0] : Math.min(...values), domain ? domain[1] : Math.max(...values))
  const low = ticks[0]
  const high = ticks[ticks.length - 1] === low ? low + 1 : ticks[ticks.length - 1]
  const innerW = Math.max(1, width - PAD.left - PAD.right)
  const innerH = HEIGHT - PAD.top - PAD.bottom
  const xOf = (i: number): number => PAD.left + (data.length > 1 ? (innerW * i) / (data.length - 1) : innerW / 2)
  const yOf = (v: number): number => PAD.top + innerH * (1 - (v - low) / (high - low))
  // подписей по горизонтали столько, сколько помещается
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(innerW / 70))))

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left - PAD.left) / innerW
    setActive(Math.min(data.length - 1, Math.max(0, Math.round(ratio * (data.length - 1)))))
  }

  const point = active === null ? null : data[active]
  const tipX = active === null ? 0 : Math.min(width - 62, Math.max(62, xOf(active)))

  return (
    <div className="chart" ref={box}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} className="line-chart" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setActive(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line className="grid" x1={PAD.left} x2={width - PAD.right} y1={yOf(t)} y2={yOf(t)} />
              <text className="tick" x={PAD.left - 8} y={yOf(t) + 4} textAnchor="end">
                {t}
              </text>
            </g>
          ))}
          {data.map((d, i) =>
            i % every === 0 ? (
              <text key={i} className="tick" x={xOf(i)} y={HEIGHT - 8} textAnchor="middle">
                {d.label}
              </text>
            ) : null,
          )}
          <polyline className="line" points={data.map((d, i) => `${xOf(i)},${yOf(d.value)}`).join(' ')} />
          {data.length <= 60 && data.map((d, i) => <circle key={i} className="dot" cx={xOf(i)} cy={yOf(d.value)} r={3} />)}
          {point && active !== null && (
            <g className="tip">
              <line className="guide" x1={xOf(active)} x2={xOf(active)} y1={PAD.top} y2={HEIGHT - PAD.bottom} />
              <circle className="dot active" cx={xOf(active)} cy={yOf(point.value)} r={5} />
              <rect x={tipX - 58} y={PAD.top} width={116} height={40} rx={3} />
              <text x={tipX} y={PAD.top + 16} textAnchor="middle" className="tick">
                {point.label}
              </text>
              <text x={tipX} y={PAD.top + 33} textAnchor="middle" className="value">
                {point.value}
              </text>
            </g>
          )}
        </svg>
      )}
    </div>
  )
}
