import type { ElementKey } from '../theme/appearance'
import { clamp, glowSprite, rand, rgba, type Palette } from './util'

/** Фоновый эффект стихии. Рисует один кадр; w и h — размер экрана в CSS-пикселях. */
export interface Effect {
  frame(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, dt: number): void
}

/** Примерно нормальное распределение в диапазоне −1…1 */
const bell = (): number => ((Math.random() + Math.random() + Math.random()) / 3) * 2 - 1

// ---------- Пламя: костёр снизу и искры ----------

function fire(p: Palette): Effect {
  const glow = glowSprite(p.accent)

  // языки пламени: у каждого своё место в костре, ширина и ритм
  const TONGUES = Array.from({ length: 13 }, (_, i) => {
    const pos = (i / 12) * 2 - 1
    return {
      pos,
      width: rand(0.2, 0.34),
      height: (1 - Math.abs(pos) * 0.62) * rand(0.75, 1),
      speed: rand(2.2, 4.2),
      phase: rand(0, 6.28),
    }
  })

  interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; phase: number }
  const sparks: Spark[] = []
  let sparkDebt = 0

  const tongue = (ctx: CanvasRenderingContext2D, x: number, base: number, width: number, height: number, sway: number) => {
    ctx.moveTo(x - width / 2, base)
    ctx.bezierCurveTo(x - width / 2, base - height * 0.45, x + sway * 0.35 - width * 0.12, base - height * 0.72, x + sway, base - height)
    ctx.bezierCurveTo(x + sway * 0.35 + width * 0.12, base - height * 0.72, x + width / 2, base - height * 0.45, x + width / 2, base)
  }

  return {
    frame(ctx, w, h, t, dt) {
      ctx.clearRect(0, 0, w, h)
      const cx = w / 2
      const spread = Math.min(w * 0.3, 260)
      const tall = Math.min(h * 0.5, 420)
      const base = h + 8

      ctx.globalCompositeOperation = 'lighter'

      // жар у основания
      ctx.globalAlpha = 0.6
      ctx.drawImage(glow, cx - spread * 1.8, h - tall * 0.9, spread * 3.6, tall * 1.8)
      ctx.globalAlpha = 1

      // три слоя: тёмно-красная кайма, основной цвет, раскалённая сердцевина
      const layers = [
        { color: p.deep, alpha: 0.6, scale: 1, blur: 16 },
        { color: p.accent, alpha: 0.34, scale: 0.72, blur: 11 },
        { color: p.bright, alpha: 0.2, scale: 0.42, blur: 7 },
      ]
      for (const layer of layers) {
        const paint = ctx.createLinearGradient(0, base, 0, base - tall * layer.scale)
        paint.addColorStop(0, rgba(layer.color, layer.alpha))
        paint.addColorStop(0.55, rgba(layer.color, layer.alpha * 0.55))
        paint.addColorStop(1, rgba(layer.color, 0))
        ctx.fillStyle = paint
        // размытие превращает плоские языки в мягкое пламя; где filter не поддержан, остаются чёткие контуры
        ctx.filter = `blur(${layer.blur}px)`
        ctx.beginPath()
        for (const f of TONGUES) {
          // два несовпадающих ритма дают неровное, живое дрожание
          const flicker = 0.62 + 0.24 * Math.sin(t * f.speed + f.phase) + 0.14 * Math.sin(t * f.speed * 2.7 + f.phase * 1.7)
          const height = tall * f.height * flicker * layer.scale
          const width = spread * f.width * (0.55 + 0.45 * layer.scale)
          const sway = Math.sin(t * 1.7 + f.phase) * width * 0.45
          tongue(ctx, cx + f.pos * spread, base, width, height, sway)
        }
        ctx.fill()
      }
      ctx.filter = 'none'

      sparkDebt += dt * 34
      while (sparkDebt >= 1) {
        sparkDebt--
        sparks.push({
          x: cx + bell() * spread * 1.2,
          y: h - rand(0, tall * 0.6),
          vx: rand(-22, 22),
          vy: -rand(70, 210),
          life: 0,
          max: rand(2.5, 7),
          size: rand(0.8, 2.4),
          phase: rand(0, 6.28),
        })
      }

      ctx.lineCap = 'round'
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]
        s.life += dt
        const k = s.life / s.max
        if (k >= 1 || s.y < -20) {
          sparks.splice(i, 1)
          continue
        }
        const vx = s.vx + Math.sin(t * 2 + s.phase) * 34
        s.x += vx * dt
        s.y += s.vy * dt
        s.vy *= 1 - dt * 0.12
        // искра с коротким хвостом по направлению полёта
        ctx.strokeStyle = rgba(k < 0.4 ? '#fff1c9' : p.bright, (1 - k) * 0.95)
        ctx.lineWidth = s.size
        ctx.beginPath()
        ctx.moveTo(s.x, s.y)
        ctx.lineTo(s.x - vx * 0.035, s.y - s.vy * 0.035)
        ctx.stroke()
      }

      ctx.globalCompositeOperation = 'source-over'
    },
  }
}

// ---------- Кровь: потёки сверху и срывающиеся капли ----------

function blood(p: Palette): Effect {
  interface Drip { x: number; top: number; y: number; v: number; target: number; timer: number; width: number }
  interface Drop { x: number; y: number; vy: number; r: number }
  const drips: Drip[] = []
  const drops: Drop[] = []
  const SPEEDS = [4, 14, 42, 115]

  const newDrip = (w: number, h: number, scattered: boolean): Drip => {
    const y = scattered ? rand(0, h * 0.7) : -10
    return { x: rand(0, w), top: scattered ? y - rand(40, 260) : -10, y, v: 0, target: 20, timer: 0, width: rand(2, 5.5) }
  }

  return {
    frame(ctx, w, h, _t, dt) {
      ctx.clearRect(0, 0, w, h)
      const wanted = clamp(Math.round(w / 65), 7, 24)
      while (drips.length < wanted) drips.push(newDrip(w, h, drips.length < wanted - 1))

      // кромка сверху, откуда всё течёт
      const band = ctx.createLinearGradient(0, 0, 0, 34)
      band.addColorStop(0, rgba(p.deep, 0.9))
      band.addColorStop(1, rgba(p.deep, 0))
      ctx.fillStyle = band
      ctx.fillRect(0, 0, w, 34)

      for (let i = 0; i < drips.length; i++) {
        const d = drips[i]
        // капля то ползёт, то срывается — как по стеклу
        d.timer -= dt
        if (d.timer <= 0) {
          d.timer = rand(0.4, 2.2)
          d.target = SPEEDS[Math.floor(Math.random() * SPEEDS.length)]
        }
        d.v += (d.target - d.v) * Math.min(1, dt * 2.5)
        const gone = d.y > h + 20
        if (!gone) d.y += d.v * dt
        d.top += (gone ? 90 : d.v * 0.35 + 3) * dt

        if (d.top > h + 20) {
          drips[i] = newDrip(w, h, false)
          continue
        }
        if (!gone && d.v > 35 && Math.random() < dt * 0.25) {
          drops.push({ x: d.x, y: d.y, vy: d.v + 60, r: d.width * 0.45 })
        }

        const trail = ctx.createLinearGradient(0, d.top, 0, d.y)
        trail.addColorStop(0, rgba(p.deep, 0))
        trail.addColorStop(1, rgba(p.accent, 0.8))
        ctx.fillStyle = trail
        ctx.fillRect(d.x - d.width / 2, d.top, d.width, d.y - d.top)

        ctx.fillStyle = p.accent
        ctx.beginPath()
        ctx.arc(d.x, d.y, d.width * 0.85, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = rgba(p.bright, 0.75)
        ctx.beginPath()
        ctx.arc(d.x - d.width * 0.25, d.y - d.width * 0.25, d.width * 0.25, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.fillStyle = p.accent
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]
        d.vy += 520 * dt
        d.y += d.vy * dt
        if (d.y > h + 20) {
          drops.splice(i, 1)
          continue
        }
        ctx.beginPath()
        ctx.ellipse(d.x, d.y, d.r, d.r * (1.4 + d.vy / 500), 0, 0, Math.PI * 2)
        ctx.fill()
      }
    },
  }
}

// ---------- Гроза: тучи, дождь, молнии ----------

type Point = [number, number]

function storm(p: Palette): Effect {
  const cloud = glowSprite('#1a2a4d', 128)
  interface Bolt { main: Point[]; branches: Point[][]; life: number; max: number }
  interface Rain { x: number; y: number; len: number; v: number }
  const bolts: Bolt[] = []
  const rain: Rain[] = []
  let next = 1.2
  let flash = 0

  const makeBolt = (w: number, h: number): Bolt => {
    let x = w * rand(0.1, 0.9)
    let y = 0
    const end = h * rand(0.45, 0.85)
    const main: Point[] = [[x, y]]
    const branches: Point[][] = []
    while (y < end) {
      y += rand(12, 38)
      x += rand(-26, 26)
      main.push([x, y])
      if (Math.random() < 0.2) {
        const side = Math.random() < 0.5 ? -1 : 1
        const branch: Point[] = [[x, y]]
        let bx = x
        let by = y
        const steps = Math.floor(rand(3, 8))
        for (let s = 0; s < steps; s++) {
          bx += side * rand(8, 30)
          by += rand(6, 26)
          branch.push([bx, by])
        }
        branches.push(branch)
      }
    }
    return { main, branches, life: 0, max: rand(0.25, 0.5) }
  }

  const trace = (ctx: CanvasRenderingContext2D, pts: Point[]) => {
    ctx.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  }

  return {
    frame(ctx, w, h, t, dt) {
      ctx.clearRect(0, 0, w, h)

      // тучи плывут вдоль верхнего края
      ctx.globalAlpha = 0.55 + flash * 0.3
      for (let i = 0; i < 6; i++) {
        const x = (((i * 0.23 + t * 0.005 * (1 + (i % 3))) % 1.3) - 0.15) * w
        ctx.drawImage(cloud, x - 260, -170 + (i % 2) * 40, 520, 340)
      }
      ctx.globalAlpha = 1

      // вспышка неяркая: это фон под текстом, а не стробоскоп
      if (flash > 0) {
        ctx.fillStyle = rgba(p.bright, flash * 0.1)
        ctx.fillRect(0, 0, w, h)
        flash = Math.max(0, flash - dt * 2.4)
      }

      const wanted = clamp(Math.round((w * h) / 8000), 60, 240)
      while (rain.length < wanted) rain.push({ x: rand(0, w * 1.2), y: rand(0, h), len: rand(10, 26), v: rand(600, 1100) })
      ctx.strokeStyle = rgba(p.bright, 0.26)
      ctx.lineWidth = 1
      ctx.beginPath()
      for (const r of rain) {
        r.y += r.v * dt
        r.x -= r.v * 0.18 * dt
        if (r.y > h + 30) {
          r.y = -30
          r.x = rand(0, w * 1.2)
        }
        ctx.moveTo(r.x, r.y)
        ctx.lineTo(r.x + r.len * 0.18, r.y - r.len)
      }
      ctx.stroke()

      next -= dt
      if (next <= 0) {
        bolts.push(makeBolt(w, h))
        next = rand(2.5, 8)
        flash = 1
      }

      ctx.lineJoin = 'round'
      ctx.shadowColor = p.accent
      ctx.shadowBlur = 22
      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i]
        b.life += dt
        const k = b.life / b.max
        if (k >= 1) {
          bolts.splice(i, 1)
          continue
        }
        const flicker = k < 0.15 ? 1 : (Math.sin(b.life * 70) > 0 ? 1 : 0.35) * (1 - k)
        ctx.strokeStyle = `rgba(255,255,255,${flicker})`
        ctx.lineWidth = 2.4
        ctx.beginPath()
        trace(ctx, b.main)
        ctx.stroke()
        ctx.strokeStyle = rgba(p.bright, flicker * 0.8)
        ctx.lineWidth = 1.1
        ctx.beginPath()
        for (const branch of b.branches) trace(ctx, branch)
        ctx.stroke()
      }
      ctx.shadowBlur = 0
    },
  }
}

// ---------- Тень: фиолетовые завихрения ----------

function shadow(p: Palette): Effect {
  const smoke = glowSprite(p.deep, 256)
  const haze = glowSprite(p.accent, 256)
  const TRAIL = 44
  interface Mote { x: number; y: number; trail: number[]; life: number; max: number; width: number; bright: boolean }
  const motes: Mote[] = []
  const VORTICES = [
    { ax: 0.31, ay: 0.23, px: 0.0, py: 1.3, dir: 1, power: 1 },
    { ax: 0.19, ay: 0.29, px: 2.1, py: 0.4, dir: -1, power: 0.8 },
    { ax: 0.27, ay: 0.17, px: 4.2, py: 3.0, dir: 1, power: 0.7 },
    { ax: 0.23, ay: 0.21, px: 5.4, py: 5.1, dir: -1, power: 0.9 },
  ]
  const centers = VORTICES.map(() => ({ x: 0, y: 0 }))

  const respawn = (m: Mote, w: number, h: number) => {
    // частицы рождаются рядом с вихрями, чтобы спирали были плотными
    const c = centers[Math.floor(Math.random() * centers.length)]
    const a = rand(0, 6.28)
    const r = rand(20, Math.min(w, h) * 0.42)
    m.x = c.x + Math.cos(a) * r
    m.y = c.y + Math.sin(a) * r
    m.trail.length = 0
    m.life = 0
    m.max = rand(2.5, 7)
  }

  return {
    frame(ctx, w, h, t, dt) {
      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'

      VORTICES.forEach((v, i) => {
        centers[i].x = (0.5 + 0.4 * Math.sin(t * v.ax * 0.3 + v.px)) * w
        centers[i].y = (0.5 + 0.4 * Math.sin(t * v.ay * 0.3 + v.py)) * h
        // клубы дыма кружат вокруг центра вихря
        for (let j = 0; j < 4; j++) {
          const a = t * 0.45 * v.dir + (j * Math.PI) / 2
          const r = 50 + j * 42
          const size = 260 + j * 60
          ctx.globalAlpha = 0.34
          ctx.drawImage(smoke, centers[i].x + Math.cos(a) * r - size / 2, centers[i].y + Math.sin(a) * r - size / 2, size, size)
        }
        ctx.globalAlpha = 0.2
        ctx.drawImage(haze, centers[i].x - 110, centers[i].y - 110, 220, 220)
      })
      ctx.globalAlpha = 1

      const wanted = clamp(Math.round((w * h) / 3800), 140, 380)
      while (motes.length < wanted) {
        const m: Mote = { x: 0, y: 0, trail: [], life: 0, max: 1, width: rand(0.7, 2.4), bright: Math.random() < 0.3 }
        respawn(m, w, h)
        m.life = rand(0, m.max)
        motes.push(m)
      }

      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      for (const m of motes) {
        m.life += dt
        if (m.life > m.max || m.x < -60 || m.x > w + 60 || m.y < -60 || m.y > h + 60) {
          respawn(m, w, h)
          continue
        }
        let vx = 0
        let vy = 0
        VORTICES.forEach((v, i) => {
          const dx = m.x - centers[i].x
          const dy = m.y - centers[i].y
          const d = Math.sqrt(dx * dx + dy * dy) + 1
          const swirl = (v.power * 190 * 110) / (d + 110)
          vx += (-dy / d) * v.dir * swirl - (dx / d) * 16
          vy += (dx / d) * v.dir * swirl - (dy / d) * 16
        })
        m.x += vx * dt
        m.y += vy * dt
        m.trail.push(m.x, m.y)
        if (m.trail.length > TRAIL * 2) m.trail.splice(0, 2)
        if (m.trail.length < 6) continue

        const alpha = Math.sin((m.life / m.max) * Math.PI) * 0.75
        const color = m.bright ? p.bright : p.accent
        const half = (m.trail.length >> 2) << 1
        // хвост тусклее головы
        ctx.lineWidth = m.width
        ctx.strokeStyle = rgba(color, alpha * 0.35)
        ctx.beginPath()
        ctx.moveTo(m.trail[0], m.trail[1])
        for (let i = 2; i <= half; i += 2) ctx.lineTo(m.trail[i], m.trail[i + 1])
        ctx.stroke()
        ctx.strokeStyle = rgba(color, alpha)
        ctx.beginPath()
        ctx.moveTo(m.trail[half], m.trail[half + 1])
        for (let i = half + 2; i < m.trail.length; i += 2) ctx.lineTo(m.trail[i], m.trail[i + 1])
        ctx.stroke()
      }
      ctx.globalCompositeOperation = 'source-over'
    },
  }
}

export const EFFECTS: Record<ElementKey, (palette: Palette) => Effect> = {
  ember: fire,
  blood,
  storm,
  shadow,
}
