import type { ElementKey } from '../theme/appearance'
import { soundscape } from './sound'
import { clamp, glowSprite, rand, rgba, type Palette } from './util'

/** Фоновый эффект стихии. Рисует один кадр; w и h — размер экрана в CSS-пикселях. */
export interface Effect {
  frame(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, dt: number): void
}

/** power — интенсивность из настроек: 0.55 спокойно, 1 обычно, 1.8 буйство. */
type EffectFactory = (palette: Palette, power: number) => Effect

/** Примерно нормальное распределение в диапазоне −1…1 */
const bell = (): number => ((Math.random() + Math.random() + Math.random()) / 3) * 2 - 1

// ---------- Пламя: огонь по всей нижней кромке, искры и всплески ----------

function fire(p: Palette, power: number): Effect {
  const heat = glowSprite(p.accent)
  // частицы трёх температур; белый жар получается сам там, где они густо накладываются друг на друга
  const TEMPERATURES = [glowSprite(p.bright, 48), glowSprite(p.accent, 48), glowSprite(p.deep, 48)]
  const SPARK_COLORS = ['#ffffff', '#fff1c9', p.bright, p.accent]

  interface Emitter { x: number; strength: number; speed: number; phase: number; debt: number }
  interface Flame { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; seed: number }
  interface Spark { x: number; y: number; vx: number; vy: number; gravity: number; life: number; max: number; size: number; phase: number; color: string }
  interface Flare { x: number; life: number; max: number }
  let emitters: Emitter[] = []
  let builtFor = 0
  const flames: Flame[] = []
  const sparks: Spark[] = []
  const flares: Flare[] = []
  let sparkDebt = 0
  let nextFlare = 1

  return {
    frame(ctx, w, h, t, dt) {
      ctx.clearRect(0, 0, w, h)
      if (w !== builtFor) {
        builtFor = w
        // очаги стоят вдоль всей ширины, у каждого своя сила и ритм
        const count = Math.max(10, Math.round(w / 28))
        emitters = Array.from({ length: count }, (_, i) => ({
          x: ((i + 0.5) / count) * w + rand(-10, 10),
          strength: rand(0.55, 1),
          speed: rand(1.6, 3.6),
          phase: rand(0, 6.28),
          debt: 0,
        }))
      }
      const tall = Math.min(h * 0.45, 380) * (0.55 + 0.45 * power)
      // на телефоне нижнюю кромку закрывает панель разделов — поднимаем огонь над ней
      const base = w < 800 ? h - 58 : h + 6

      // всплеск: пламя в одном месте взмывает и выбрасывает сноп искр
      nextFlare -= dt
      if (nextFlare <= 0) {
        nextFlare = rand(1.2, 3.6) / power
        const x = rand(0, w)
        flares.push({ x, life: 0, max: rand(0.7, 1.3) })
        soundscape.trigger('flare')
        const burst = Math.round(rand(25, 50) * power)
        for (let i = 0; i < burst; i++) {
          sparks.push({
            x: x + rand(-30, 30),
            y: base - rand(0, tall * 0.5),
            vx: rand(-90, 90),
            vy: -rand(180, 460),
            gravity: 170,
            life: 0,
            max: rand(1, 3),
            size: rand(1, 2.8),
            phase: rand(0, 6.28),
            color: SPARK_COLORS[Math.floor(rand(0, 3))],
          })
        }
      }
      for (let i = flares.length - 1; i >= 0; i--) {
        flares[i].life += dt
        if (flares[i].life >= flares[i].max) flares.splice(i, 1)
      }

      ctx.globalCompositeOperation = 'lighter'

      // жар вдоль всей кромки
      ctx.globalAlpha = 0.5
      ctx.drawImage(heat, -w * 0.2, base - tall * 1.1, w * 1.4, tall * 2.2)

      const rate = 48 * Math.sqrt(power)
      for (const e of emitters) {
        let live = e.strength * (0.6 + 0.28 * Math.sin(t * e.speed + e.phase) + 0.12 * Math.sin(t * e.speed * 2.3 + e.phase * 1.9))
        for (const flare of flares) {
          const d = (e.x - flare.x) / 130
          live += Math.exp(-d * d) * Math.sin((flare.life / flare.max) * Math.PI) * 0.9
        }
        e.debt += dt * rate * live
        while (e.debt >= 1) {
          e.debt--
          flames.push({
            x: e.x + rand(-16, 16),
            y: base + rand(0, 14),
            vx: rand(-12, 12),
            vy: -tall * rand(1, 1.7) * Math.min(1.7, Math.max(0.5, live)),
            life: 0,
            max: rand(0.55, 1.1),
            size: rand(34, 66) * (0.8 + 0.4 * live),
            seed: rand(0, 6.28),
          })
        }
      }

      // частица остывает по пути вверх: белая у основания, красная на языке
      for (let i = flames.length - 1; i >= 0; i--) {
        const f = flames[i]
        f.life += dt
        const k = f.life / f.max
        if (k >= 1) {
          flames.splice(i, 1)
          continue
        }
        f.x += (f.vx + Math.sin(t * 3.1 + f.seed + f.y * 0.02) * 22) * dt
        f.y += f.vy * dt
        f.vy *= 1 - dt * 0.9
        // язык сужается кверху и вытянут по вертикали
        const size = f.size * (1 - k * 0.7)
        ctx.globalAlpha = (k < 0.08 ? k / 0.08 : 1) * Math.pow(1 - k, 1.1) * 0.3
        ctx.drawImage(TEMPERATURES[k < 0.3 ? 0 : k < 0.65 ? 1 : 2], f.x - size / 2, f.y - size * 0.85, size, size * 1.7)
      }
      ctx.globalAlpha = 1

      sparkDebt += dt * 30 * power * (w / 800)
      while (sparkDebt >= 1) {
        sparkDebt--
        sparks.push({
          x: rand(0, w),
          y: base - rand(0, tall * 0.6),
          vx: rand(-22, 22),
          vy: -rand(70, 230),
          gravity: 0,
          life: 0,
          max: rand(2.5, 7),
          size: rand(0.8, 2.4),
          phase: rand(0, 6.28),
          color: SPARK_COLORS[Math.floor(rand(1, 4))],
        })
      }

      ctx.lineCap = 'round'
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]
        s.life += dt
        const k = s.life / s.max
        if (k >= 1 || s.y < -20 || s.y > h + 40) {
          sparks.splice(i, 1)
          continue
        }
        const vx = s.vx + Math.sin(t * 2 + s.phase) * 34
        s.vy += s.gravity * dt
        s.x += vx * dt
        s.y += s.vy * dt
        if (!s.gravity) s.vy *= 1 - dt * 0.12
        // искра с коротким хвостом по направлению полёта
        ctx.strokeStyle = rgba(s.color, (1 - k) * 0.95)
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

// ---------- Кровь: неподвижные разводы и брызги, только блики мерцают ----------

function blood(p: Palette, power: number): Effect {
  interface Glint { x: number; y: number; r: number; phase: number; speed: number }
  let layer: HTMLCanvasElement | null = null
  let builtW = 0
  let builtH = 0
  let glints: Glint[] = []

  /** Клякса неровной формы с тёмным краем. */
  const blot = (g: CanvasRenderingContext2D, cx: number, cy: number, radius: number) => {
    const n = 14
    const pts: [number, number][] = []
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const r = radius * rand(0.72, 1.22)
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
    }
    g.beginPath()
    g.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2)
    for (let i = 0; i < n; i++) {
      const next = pts[(i + 1) % n]
      g.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + next[0]) / 2, (pts[i][1] + next[1]) / 2)
    }
    g.closePath()
    const paint = g.createRadialGradient(cx - radius * 0.2, cy - radius * 0.2, 0, cx, cy, radius * 1.25)
    paint.addColorStop(0, rgba(p.accent, 0.95))
    paint.addColorStop(0.6, rgba(p.deep, 0.95))
    paint.addColorStop(1, 'rgba(20,0,2,0.95)')
    g.fillStyle = paint
    g.fill()
  }

  const build = (w: number, h: number) => {
    const scale = Math.min(window.devicePixelRatio || 1, 1.5)
    layer = document.createElement('canvas')
    layer.width = Math.round(w * scale)
    layer.height = Math.round(h * scale)
    const g = layer.getContext('2d')!
    g.scale(scale, scale)
    g.lineCap = 'round'
    glints = []

    const band = g.createLinearGradient(0, 0, 0, 60)
    band.addColorStop(0, rgba(p.deep, 0.85))
    band.addColorStop(1, rgba(p.deep, 0))
    g.fillStyle = band
    g.fillRect(0, 0, w, 60)

    // разводы: широкие мазки полусухой кистью
    const smears = clamp(Math.round((w * h) / 260000), 2, 7)
    for (let s = 0; s < smears; s++) {
      const x = rand(0, w)
      const y = rand(0, h)
      const angle = rand(-0.5, 0.5) + (Math.random() < 0.5 ? 0 : Math.PI / 2)
      const length = rand(160, 440)
      const width = rand(30, 95)
      const bend = rand(-60, 60)
      const hairs = Math.floor(rand(14, 28))
      const px = (d: number, o: number) => x + Math.cos(angle) * d - Math.sin(angle) * o
      const py = (d: number, o: number) => y + Math.sin(angle) * d + Math.cos(angle) * o
      for (let i = 0; i < hairs; i++) {
        const off = rand(-width / 2, width / 2)
        const start = rand(0, length * 0.25)
        const end = length - rand(0, length * 0.35)
        g.strokeStyle = rgba(Math.random() < 0.3 ? p.accent : p.deep, rand(0.06, 0.26))
        g.lineWidth = rand(1, 5.5)
        g.beginPath()
        g.moveTo(px(start, off), py(start, off))
        g.quadraticCurveTo(px(length / 2, off + bend), py(length / 2, off + bend), px(end, off), py(end, off))
        g.stroke()
      }
    }

    // брызги: клякса, веер мелких капель и иногда застывший потёк
    const splats = clamp(Math.round(((w * h) / 70000) * (0.5 + 0.5 * power)), 4, 24)
    for (let s = 0; s < splats; s++) {
      const cx = rand(0, w)
      const cy = rand(0, h)
      const radius = rand(12, 54)
      const heading = rand(0, Math.PI * 2)

      const drops = Math.floor(rand(12, 46))
      for (let i = 0; i < drops; i++) {
        const a = heading + bell() * 1.7
        const far = Math.random()
        const dist = radius * (1.1 + far * far * 5.5)
        const size = Math.max(0.7, radius * 0.17 * (1 - far * 0.8) * rand(0.5, 1.3))
        const x = cx + Math.cos(a) * dist
        const y = cy + Math.sin(a) * dist
        g.fillStyle = rgba(Math.random() < 0.5 ? p.accent : p.deep, rand(0.7, 0.95))
        g.beginPath()
        g.ellipse(x, y, size * rand(1, 2.8), size, a, 0, Math.PI * 2)
        g.fill()
        if (size > 3.2) glints.push({ x: x - size * 0.3, y: y - size * 0.3, r: size * 0.28, phase: rand(0, 6.28), speed: rand(0.5, 1.4) })
      }

      if (Math.random() < 0.4) {
        const x = cx + rand(-radius * 0.4, radius * 0.4)
        const top = cy + radius * 0.4
        const length = rand(30, 170)
        const width = rand(2.5, 6.5)
        const run = g.createLinearGradient(0, top, 0, top + length)
        run.addColorStop(0, rgba(p.deep, 0.9))
        run.addColorStop(1, rgba(p.accent, 0.95))
        g.strokeStyle = run
        g.lineWidth = width
        g.beginPath()
        g.moveTo(x, top)
        g.lineTo(x + rand(-3, 3), top + length)
        g.stroke()
        g.fillStyle = p.accent
        g.beginPath()
        g.arc(x, top + length, width * 0.95, 0, Math.PI * 2)
        g.fill()
        glints.push({ x: x - width * 0.3, y: top + length - width * 0.3, r: width * 0.3, phase: rand(0, 6.28), speed: rand(0.5, 1.4) })
      }

      blot(g, cx, cy, radius)
      glints.push({ x: cx - radius * 0.32, y: cy - radius * 0.34, r: radius * 0.13, phase: rand(0, 6.28), speed: rand(0.5, 1.4) })
    }
  }

  return {
    frame(ctx, w, h, t) {
      if (!layer || w !== builtW || h !== builtH) {
        builtW = w
        builtH = h
        build(w, h)
      }
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(layer!, 0, 0, w, h)
      // ничего не движется — только влажный блеск на каплях
      for (const s of glints) {
        ctx.fillStyle = `rgba(255,232,232,${0.22 + 0.5 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase))})`
        ctx.beginPath()
        ctx.ellipse(s.x, s.y, s.r * 1.5, s.r, -0.6, 0, Math.PI * 2)
        ctx.fill()
      }
    },
  }
}

// ---------- Гроза: тучи, ливень, молнии ----------

type Point = [number, number]

function storm(p: Palette, power: number): Effect {
  const cloud = glowSprite('#1a2a4d', 128)
  const sheet = glowSprite(p.accent, 128)
  interface Bolt { main: Point[]; branches: Point[][]; life: number; max: number }
  interface Rain { x: number; y: number; len: number; v: number }
  const bolts: Bolt[] = []
  const rain: Rain[] = []
  let next = 0.8
  let flash = 0
  // зарница — тихий сполох внутри туч
  let glimmer = 0
  let glimmerX = 0

  const makeBolt = (w: number, h: number): Bolt => {
    let x = w * rand(0.05, 0.95)
    let y = 0
    const end = h * rand(0.5, 0.95)
    const main: Point[] = [[x, y]]
    const branches: Point[][] = []
    while (y < end) {
      y += rand(12, 38)
      x += rand(-26, 26)
      main.push([x, y])
      if (Math.random() < 0.24) {
        const side = Math.random() < 0.5 ? -1 : 1
        const branch: Point[] = [[x, y]]
        let bx = x
        let by = y
        const steps = Math.floor(rand(3, 9))
        for (let s = 0; s < steps; s++) {
          bx += side * rand(8, 30)
          by += rand(6, 26)
          branch.push([bx, by])
        }
        branches.push(branch)
      }
    }
    return { main, branches, life: 0, max: rand(0.25, 0.55) }
  }

  const trace = (ctx: CanvasRenderingContext2D, pts: Point[]) => {
    ctx.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  }

  return {
    frame(ctx, w, h, t, dt) {
      ctx.clearRect(0, 0, w, h)

      // тучи плывут вдоль верхнего края
      ctx.globalAlpha = Math.min(1, 0.6 + flash * 0.3)
      for (let i = 0; i < 8; i++) {
        const x = (((i * 0.19 + t * 0.006 * (1 + (i % 3))) % 1.3) - 0.15) * w
        ctx.drawImage(cloud, x - 280, -180 + (i % 2) * 50, 560, 380)
      }

      if (Math.random() < dt * 0.5 * power) {
        glimmer = 1
        glimmerX = rand(0, w)
      }
      if (glimmer > 0) {
        ctx.globalCompositeOperation = 'lighter'
        ctx.globalAlpha = glimmer * 0.35
        ctx.drawImage(sheet, glimmerX - 300, -200, 600, 400)
        ctx.globalCompositeOperation = 'source-over'
        glimmer = Math.max(0, glimmer - dt * 3.5)
      }
      ctx.globalAlpha = 1

      // вспышка неяркая: это фон под текстом, а не стробоскоп
      if (flash > 0) {
        ctx.fillStyle = rgba(p.bright, flash * 0.13)
        ctx.fillRect(0, 0, w, h)
        flash = Math.max(0, flash - dt * 2.4)
      }

      const wanted = clamp(Math.round(((w * h) / 4200) * power), 80, 520)
      while (rain.length < wanted) rain.push({ x: rand(0, w * 1.25), y: rand(0, h), len: rand(12, 30), v: rand(700, 1300) })
      ctx.strokeStyle = rgba(p.bright, 0.3)
      ctx.lineWidth = 1
      ctx.beginPath()
      for (const r of rain) {
        r.y += r.v * dt
        r.x -= r.v * 0.22 * dt
        if (r.y > h + 30) {
          r.y = -30
          r.x = rand(0, w * 1.25)
        }
        ctx.moveTo(r.x, r.y)
        ctx.lineTo(r.x + r.len * 0.22, r.y - r.len)
      }
      ctx.stroke()

      next -= dt
      if (next <= 0) {
        bolts.push(makeBolt(w, h))
        soundscape.trigger('thunder')
        // иногда бьёт сразу двумя разрядами
        if (Math.random() < 0.3 * power) bolts.push(makeBolt(w, h))
        next = rand(1.2, 4.2) / power
        flash = 1
      }

      ctx.lineJoin = 'round'
      ctx.shadowColor = p.accent
      ctx.shadowBlur = 24
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
        ctx.lineWidth = 2.8
        ctx.beginPath()
        trace(ctx, b.main)
        ctx.stroke()
        ctx.strokeStyle = rgba(p.bright, flicker * 0.8)
        ctx.lineWidth = 1.2
        ctx.beginPath()
        for (const branch of b.branches) trace(ctx, branch)
        ctx.stroke()
      }
      ctx.shadowBlur = 0
    },
  }
}

// ---------- Тень: фиолетовые завихрения ----------

function shadow(p: Palette, power: number): Effect {
  const smoke = glowSprite(p.deep, 256)
  const haze = glowSprite(p.accent, 256)
  const TRAIL = 44
  const density = Math.min(1.4, 0.6 + 0.4 * power)
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
          ctx.globalAlpha = 0.34 * density
          ctx.drawImage(smoke, centers[i].x + Math.cos(a) * r - size / 2, centers[i].y + Math.sin(a) * r - size / 2, size, size)
        }
        ctx.globalAlpha = 0.2 * density
        ctx.drawImage(haze, centers[i].x - 110, centers[i].y - 110, 220, 220)
      })
      ctx.globalAlpha = 1

      const wanted = clamp(Math.round(((w * h) / 3800) * power), 90, 560)
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

export const EFFECTS: Record<ElementKey, EffectFactory> = {
  ember: fire,
  blood,
  storm,
  shadow,
}
