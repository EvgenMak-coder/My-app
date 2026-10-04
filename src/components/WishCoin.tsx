import { useId } from 'react'
import { wishLevel } from '../game/wishes'

// светлый блик, основной тон и тень металла
const METALS: Record<string, [string, string, string]> = {
  bronze: ['#f3c49a', '#c27a3e', '#6a3a16'],
  silver: ['#ffffff', '#c4ccd6', '#68727e'],
  gold: ['#fff6c8', '#f2c230', '#b0720c'],
  jade: ['#d6ffea', '#3fbf8f', '#12684a'],
}

/** Монета желания: металл говорит, насколько сильно хочется. С отметкой — желание исполнено. */
export function WishCoin({ level, done = false }: { level: number; done?: boolean }) {
  const id = useId()
  const metal = wishLevel(level)
  const [light, tone, shade] = METALS[metal.key]
  return (
    <svg className={`wish-coin ${metal.key}`} viewBox="-20 -20 40 40" aria-hidden="true">
      <defs>
        <radialGradient id={id} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor={light} />
          <stop offset="45%" stopColor={tone} />
          <stop offset="100%" stopColor={shade} />
        </radialGradient>
      </defs>
      <circle r={17} fill={`url(#${id})`} stroke={light} strokeWidth={1.1} />
      <circle r={12.8} fill="none" stroke={shade} strokeWidth={0.9} />
      {/* четыре насечки вместо надписи: в таком размере знаки не читаются */}
      {[0, 90, 180, 270].map((turn) => (
        <rect key={turn} x={-1.6} y={-11.4} width={3.2} height={3.6} rx={0.6} fill={shade} opacity={0.7} transform={`rotate(${turn})`} />
      ))}
      <rect x={-4.6} y={-4.6} width={9.2} height={9.2} rx={0.8} fill="#0b0906" stroke={shade} strokeWidth={0.8} />
      {done && <path className="wish-coin-check" d="M-9 0.5 L-2.5 7.5 L10 -8" />}
    </svg>
  )
}
