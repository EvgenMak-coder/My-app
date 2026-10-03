import { useId, type CSSProperties } from 'react'
import { coinGlow } from '../game/goals'

// всё рисуется в поле шириной 100: петля и узел сверху, столбик монет, кисть снизу
const RADIUS = 17
const STEP = 32
const FIRST_COIN = 84
const KNOT = 44
const HOLE = 4.6

/** Высота поля для талисмана с таким числом монет */
const heightFor = (coins: number): number => 153 + STEP * (coins - 1)

// «心想事成» — «пусть задуманное сбудется»; порядок как на старинных монетах: сверху, снизу, справа, слева
const GLYPHS: [string, number, number][] = [
  ['心', 0, -8.7],
  ['想', 0, 8.7],
  ['事', 8.7, 0],
  ['成', -8.7, 0],
]

// нити кисти: смещение от середины
const STRANDS = [-8, -6, -4, -2, 0, 2, 4, 6, 8]

function CoinFace({ className, fill }: { className: string; fill?: string }) {
  return (
    <g className={className}>
      <circle className="rim" r={RADIUS} fill={fill} />
      <circle className="inner" r={12.8} />
    </g>
  )
}

/** Отверстие и надпись — поверх обоих слоёв монеты, чтобы знаки оставались чёткими при любом свечении */
function CoinMarks() {
  return (
    <>
      <rect className="coin-hole" x={-HOLE} y={-HOLE} width={HOLE * 2} height={HOLE * 2} rx={0.8} />
      {GLYPHS.map(([glyph, x, y]) => (
        <text key={glyph} x={x} y={y + 2.2}>
          {glyph}
        </text>
      ))}
    </>
  )
}

function Gradients({ id }: { id: string }) {
  return (
    <defs>
      <radialGradient id={`${id}gold`} cx="35%" cy="30%" r="80%">
        <stop offset="0%" stopColor="#fff6c8" />
        <stop offset="45%" stopColor="#f2c230" />
        <stop offset="100%" stopColor="#b0720c" />
      </radialGradient>
      <radialGradient id={`${id}halo`}>
        <stop offset="0%" stopColor="#ffd060" stopOpacity="0.95" />
        <stop offset="55%" stopColor="#ff9a20" stopOpacity="0.45" />
        <stop offset="100%" stopColor="#ff9a20" stopOpacity="0" />
      </radialGradient>
    </defs>
  )
}

/**
 * Талисман цели: чем важнее цель, тем больше монет на шнуре. Прогресс (0–100) делится между монетами поровну
 * и зажигает их сверху вниз; монета, до которой дошёл прогресс, горит вполсилы — настолько, насколько заполнена.
 */
export function Talisman({ coins, progress, color }: { coins: number; progress: number; color: string }) {
  const id = useId()
  const height = heightFor(coins)
  const glow = coinGlow(progress, coins)
  const centers = glow.map((_, i) => FIRST_COIN + STEP * i)
  const tasselTop = centers[centers.length - 1] + RADIUS + 3
  const done = progress >= 100
  // даже первые проценты должны быть заметны
  const lit = (part: number): number => (part > 0 ? 0.15 + 0.85 * part : 0)

  return (
    <svg
      className={`talisman${done ? ' done' : ''}`}
      viewBox={`0 0 100 ${height}`}
      style={{ color, aspectRatio: `100 / ${height}` }}
      aria-hidden="true"
    >
      <Gradients id={id} />

      {centers.map((cy, i) => (
        <circle
          key={i}
          className={`coin-halo${glow[i] >= 1 ? ' full' : ''}`}
          cx={50}
          cy={cy}
          r={30}
          fill={`url(#${id}halo)`}
          style={{ '--lit': lit(glow[i]) } as CSSProperties}
        />
      ))}

      {/* петля и шнур: идёт за монетами и виден в их отверстиях */}
      <path className="talisman-cord" d="M 50 26 C 37 15 40 2 50 2 C 60 2 63 15 50 26" />
      <path className="talisman-cord" d={`M 50 ${KNOT + 18} V ${tasselTop}`} />

      {/* узел: плетёный ромб с петлями по бокам */}
      <g className="talisman-knot">
        <ellipse cx={24} cy={KNOT} rx={8} ry={5} />
        <ellipse cx={76} cy={KNOT} rx={8} ry={5} />
        <ellipse cx={26} cy={KNOT} rx={4} ry={2.4} />
        <ellipse cx={74} cy={KNOT} rx={4} ry={2.4} />
        <g transform={`translate(50 ${KNOT}) rotate(45)`}>
          {[0, 1, 2, 3].flatMap((row) =>
            [0, 1, 2, 3].map((col) => (
              <rect key={`${row}${col}`} x={-14 + col * 7 + 0.4} y={-14 + row * 7 + 0.4} width={6.2} height={6.2} rx={1.6} />
            )),
          )}
        </g>
      </g>

      {/* нижние монеты рисуются первыми: верхняя слегка перекрывает следующую, как на связке */}
      {centers
        .map((cy, i) => (
          <g key={i} className="coin" transform={`translate(50 ${cy})`} style={{ '--lit': lit(glow[i]) } as CSSProperties}>
            <CoinFace className="coin-dim" />
            <CoinFace className="coin-gold" fill={`url(#${id}gold)`} />
            <CoinMarks />
            <path className="talisman-cord" d={`M 0 ${-HOLE} V ${HOLE}`} />
          </g>
        ))
        .reverse()}

      <g className="talisman-tassel">
        {STRANDS.map((offset) => (
          <path
            key={offset}
            d={`M ${50 + offset * 0.4} ${tasselTop + 8} Q ${50 + offset * 0.5} ${tasselTop + 24} ${50 + offset} ${tasselTop + 43 - Math.abs(offset) * 0.6}`}
          />
        ))}
        <rect className="talisman-cap" x={45.2} y={tasselTop} width={9.6} height={10} rx={2} />
        <path className="talisman-band" d={`M 45.2 ${tasselTop + 3.4} H 54.8 M 45.2 ${tasselTop + 6.6} H 54.8`} />
      </g>
    </svg>
  )
}

/** Одна горящая монета — значок свершённой цели в архиве */
export function CoinIcon() {
  const id = useId()
  return (
    <svg className="talisman coin-icon" viewBox="-20 -20 40 40" aria-hidden="true">
      <Gradients id={id} />
      <g className="coin" style={{ '--lit': 1 } as CSSProperties}>
        <CoinFace className="coin-gold" fill={`url(#${id}gold)`} />
        <CoinMarks />
      </g>
    </svg>
  )
}
