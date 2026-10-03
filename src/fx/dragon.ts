import { clamp, lerp, prefersReducedMotion, rand, rgba, type Palette } from './util'

const INK = '#17141c'
const INK_DEEP = '#08070a'
const BONE = '#efe6d2'

/** Насколько брюхо заходит на бока (в радианах по окружности тела): от этого зависит ширина полосы щитков. */
const BELLY = 1.2
const BELLY_EDGE = Math.cos(BELLY)

/**
 * Что есть у дракона на каждой стадии (индекс = номер стадии из game/xp.ts).
 * Порядок появления частей — по китайскому канону: хуэй (змейка) → цзяо (лапы) → лун (усы, грива, нарост на лбу)
 * → цзяо-лун (оленьи рога) → ин-лун (крылья). Раньше последней стадии крыльев нет: восточный дракон летает без них.
 */
interface Look {
  segments: number
  radius: number
  /** высота гребня вдоль хребта в долях толщины тела; 0 — нет */
  fin: number
  /** когтей на лапе: 0 — лап нет, 3 — простой, 4 — знатный, 5 — императорский */
  claws: number
  tail: boolean
  fangs: boolean
  /** длина усов, 0 — нет */
  whiskers: number
  /** число прядей гривы */
  mane: number
  beard: boolean
  /** 尺木 — нарост на лбу, без которого дракон не поднимется в небо */
  bump: boolean
  /** 0 — нет, 1 — рожки, 2 — с отростком, 3 — оленьи */
  horns: number
  /** искры вокруг тела: 0…3 */
  aura: number
  /** нарост на лбу светится */
  mark: boolean
  pearl: boolean
  wings: boolean
}

const NONE = { fin: 0, claws: 0, tail: false, fangs: false, whiskers: 0, mane: 0, beard: false, bump: false, horns: 0, aura: 0, mark: false, pearl: false, wings: false }

const LOOKS: Look[] = [
  { ...NONE, segments: 0, radius: 0 },
  { ...NONE, segments: 16, radius: 7.5 },
  { ...NONE, segments: 21, radius: 8.8, fin: 0.5 },
  { ...NONE, segments: 25, radius: 10, fin: 0.7, claws: 3 },
  { ...NONE, segments: 29, radius: 11.2, fin: 0.8, claws: 3, tail: true, fangs: true },
  { ...NONE, segments: 34, radius: 12.5, fin: 0.9, claws: 4, tail: true, fangs: true, whiskers: 1, mane: 5, beard: true, bump: true, horns: 1 },
  { ...NONE, segments: 38, radius: 14, fin: 1, claws: 4, tail: true, fangs: true, whiskers: 1.25, mane: 7, beard: true, bump: true, horns: 2, aura: 1 },
  { ...NONE, segments: 42, radius: 15.5, fin: 1, claws: 5, tail: true, fangs: true, whiskers: 1.45, mane: 9, beard: true, bump: true, horns: 3, aura: 2, mark: true },
  { ...NONE, segments: 46, radius: 17, fin: 1, claws: 5, tail: true, fangs: true, whiskers: 1.6, mane: 9, beard: true, bump: true, horns: 3, aura: 3, mark: true, pearl: true, wings: true },
]

// трещины на скорлупе, в координатах яйца; открываются по мере набора опыта
const CRACKS: [number, number][][] = [
  [[-6, -40], [2, -28], [-4, -18], [6, -8]],
  [[2, -28], [14, -22], [20, -12]],
  [[-4, -18], [-18, -12], [-24, 0]],
  [[6, -8], [0, 4], [10, 14], [4, 26]],
  [[10, 14], [24, 18], [30, 28]],
  [[0, 4], [-14, 12], [-20, 26], [-12, 38]],
  [[-24, 0], [-34, 8]],
  [[4, 26], [8, 40]],
]

// пряди гривы на голове в профиль: основание (x, y) и длина
const MANE: [number, number, number][] = [
  [-5, -9, 20],
  [-8, -4, 24],
  [-8, 2, 22],
  [-5, 8, 18],
  [-2, -10.5, 15],
  [-9, -1, 26],
  [-7, 5.5, 20],
  [-6, -7, 22],
  [-3, 9.5, 14],
]

interface Vec { x: number; y: number }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number }

/** Положение и поворот каждого звена тела на текущем кадре */
interface Geo {
  n: number
  x: number[]
  y: number[]
  ang: number[]
  /** вперёд вдоль тела */
  fx: number[]
  fy: number[]
  /** вбок; при полёте вправо смотрит вверх */
  nx: number[]
  ny: number[]
  rad: number[]
  /**
   * Поворот тела вокруг оси: 1 и −1 — вид сбоку (спина сверху экрана), 0 — вид сверху.
   * Спина всегда стремится вверх, поэтому на разворотах тело перекручивается, как на свитках.
   */
  tw: number[]
}

type Pen = CanvasRenderingContext2D | Path2D

/** Язык пламени, прядь или перо: лист от основания к острию, выгнутый вбок. */
function leaf(p: Pen, bx: number, by: number, tx: number, ty: number, width: number, bend: number): void {
  const dx = tx - bx
  const dy = ty - by
  const len = Math.hypot(dx, dy) || 1
  const px = -dy / len
  const py = dx / len
  const mx = bx + dx * 0.45 + px * bend
  const my = by + dy * 0.45 + py * bend
  p.moveTo(bx + px * width * 0.5, by + py * width * 0.5)
  p.quadraticCurveTo(mx + px * width * 0.6, my + py * width * 0.6, tx, ty)
  p.quadraticCurveTo(mx - px * width * 0.6, my - py * width * 0.6, bx - px * width * 0.5, by - py * width * 0.5)
  p.closePath()
}

/** Плавная линия через точки: углы скругляются по серединам отрезков. */
function smooth(p: Pen, xs: number[], ys: number[], from: number, to: number, start: boolean): void {
  const step = from <= to ? 1 : -1
  if (start) p.moveTo(xs[from], ys[from])
  else p.lineTo(xs[from], ys[from])
  for (let i = from + step; i !== to; i += step) {
    p.quadraticCurveTo(xs[i], ys[i], (xs[i] + xs[i + step]) / 2, (ys[i] + ys[i + step]) / 2)
  }
  p.lineTo(xs[to], ys[to])
}

export class DragonScene {
  private ctx: CanvasRenderingContext2D
  private scale = 1
  private w = 360
  /** логическая высота сцены; на узких экранах больше, чтобы длинному дракону было где развернуться */
  private h = 300
  private raf = 0
  private last = 0
  private t = rand(0, 20)
  private level = 0
  private ratio = 0
  private segments = 0
  private radius = 0
  private chain: Vec[] = []
  private sparks: Spark[] = []
  private sparkDebt = 0

  constructor(
    private canvas: HTMLCanvasElement,
    private palette: Palette,
  ) {
    this.ctx = canvas.getContext('2d')!
  }

  /** level — номер стадии, ratio — доля пути до следующей (дракон подрастает и внутри стадии). */
  setProgress(level: number, ratio: number): void {
    this.level = Math.min(LOOKS.length - 1, Math.max(0, level))
    this.ratio = Math.min(1, Math.max(0, ratio))
    const look = LOOKS[this.level]
    const next = LOOKS[Math.min(LOOKS.length - 1, this.level + 1)]
    this.segments = this.level === 0 ? 0 : Math.round(lerp(look.segments, next.segments, this.ratio))
    this.radius = lerp(look.radius, next.radius, this.ratio)
    this.frame()

    const head = this.path(this.t)
    const spacing = this.radius * 0.62
    const grew = this.segments > this.chain.length
    while (this.chain.length < this.segments) {
      // новые звенья продолжают хвост по его направлению, а не слипаются в одну точку
      const tail = this.chain[this.chain.length - 1] ?? { x: head.x + spacing, y: head.y }
      const before = this.chain[this.chain.length - 2] ?? { x: tail.x + spacing, y: tail.y }
      const d = Math.hypot(tail.x - before.x, tail.y - before.y) || 1
      this.chain.push({
        x: tail.x + ((tail.x - before.x) / d) * spacing,
        y: tail.y + ((tail.y - before.y) / d) * spacing,
      })
    }
    this.chain.length = this.segments
    // новое тело сначала вытянуто в линию — проматываем движение, чтобы оно легло по траектории
    if (grew) this.settle()
    if (prefersReducedMotion()) this.draw()
  }

  setPalette(palette: Palette): void {
    this.palette = palette
    if (prefersReducedMotion()) this.draw()
  }

  resize(): void {
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    if (!width || !height) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.width = Math.round(width * dpr)
    this.canvas.height = Math.round(height * dpr)
    this.frame()
    if (prefersReducedMotion()) this.draw()
  }

  /** Размер сцены под текущий рост дракона. На телефоне холст почти квадратный: чем крупнее дракон, тем дальше отходит «камера», иначе ему тесно. */
  private frame(): void {
    if (!this.canvas.width || !this.canvas.height) return
    // маленького дракона показываем ближе, иначе змейка теряется в поле
    const close = clamp(140 + this.radius * 14, 230, 300)
    const room = close + 50 * clamp((this.radius - 8) / 9, 0, 1)
    this.h = clamp((close * 1.5 * this.canvas.height) / this.canvas.width, close, room)
    this.scale = this.canvas.height / this.h
    this.w = this.canvas.width / this.scale
  }

  start(): void {
    this.resize()
    if (prefersReducedMotion()) return
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.tick)
  }

  stop(): void {
    cancelAnimationFrame(this.raf)
  }

  private tick = (now: number): void => {
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    this.t += dt
    this.update(dt)
    this.draw()
    this.raf = requestAnimationFrame(this.tick)
  }

  private settle(): void {
    for (let i = 0; i < 600; i++) {
      this.t += 1 / 30
      this.update(1 / 30)
    }
    this.sparks.length = 0
  }

  /** Траектория головы: плавная «восьмёрка» на всю ширину поля. */
  private path(t: number): Vec {
    // запас у краёв — под голову с рогами
    const reach = Math.max(50, this.w / 2 - 44 - this.radius * 2.4)
    return {
      x: this.w / 2 + Math.sin(t * 0.5) * reach * 0.84 + Math.sin(t * 1.27 + 1) * reach * 0.16,
      y: this.h / 2 + Math.sin(t + 0.4) * this.h * 0.25 + Math.cos(t * 0.63) * this.h * 0.065,
    }
  }

  private update(dt: number): void {
    if (this.level === 0) return
    const head = this.path(this.t)
    const spacing = this.radius * 0.62
    this.chain[0] = head
    // каждое звено тянется за предыдущим на фиксированном расстоянии
    for (let i = 1; i < this.chain.length; i++) {
      const prev = this.chain[i - 1]
      const cur = this.chain[i]
      const dx = prev.x - cur.x
      const dy = prev.y - cur.y
      const d = Math.hypot(dx, dy) || 1
      cur.x = prev.x - (dx / d) * spacing
      cur.y = prev.y - (dy / d) * spacing
    }

    const aura = LOOKS[this.level].aura
    this.sparkDebt += dt * aura * 9
    while (this.sparkDebt >= 1) {
      this.sparkDebt--
      const seg = this.chain[Math.floor(Math.random() * this.chain.length)]
      this.sparks.push({ x: seg.x + rand(-8, 8), y: seg.y + rand(-8, 8), vx: rand(-10, 10), vy: -rand(12, 40), life: 0, max: rand(0.8, 2), size: rand(0.8, 2.2) })
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]
      s.life += dt
      if (s.life >= s.max) {
        this.sparks.splice(i, 1)
        continue
      }
      s.x += s.vx * dt
      s.y += s.vy * dt
    }
  }

  private draw(): void {
    const c = this.ctx
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0)
    c.clearRect(0, 0, this.w, this.h)
    c.lineCap = 'round'
    c.lineJoin = 'round'
    this.drawHalo()
    if (this.level === 0) this.drawEgg()
    else if (this.chain.length > 3) this.drawDragon()
  }

  /** Мягкий отсвет за драконом — без него тёмное тело теряется на тёмном фоне. Летит вместе с ним. */
  private drawHalo(): void {
    const c = this.ctx
    const mid = this.chain[Math.floor(this.chain.length / 3)] ?? { x: this.w / 2, y: this.h / 2 }
    const size = 70 + this.radius * 4
    const halo = c.createRadialGradient(mid.x, mid.y, 6, mid.x, mid.y, size)
    // быстро гаснет к краю, чтобы отсвет не обрезался границей холста
    halo.addColorStop(0, rgba(this.palette.accent, 0.2))
    halo.addColorStop(0.5, rgba(this.palette.accent, 0.05))
    halo.addColorStop(1, rgba(this.palette.accent, 0))
    c.fillStyle = halo
    c.fillRect(mid.x - size, mid.y - size, size * 2, size * 2)
  }

  private drawEgg(): void {
    const c = this.ctx
    const P = this.palette
    const pulse = 0.7 + 0.3 * Math.sin(this.t * 1.6)
    // перед вылуплением яйцо начинает вздрагивать
    const shaking = this.ratio > 0.6 && Math.sin(this.t * 0.9) > 0.6
    const tilt = Math.sin(this.t * 1.1) * 0.035 + (shaking ? Math.sin(this.t * 22) * 0.02 : 0)
    const zoom = this.h / 300

    c.save()
    c.translate(this.w / 2, this.h / 2 + 84 * zoom)
    c.rotate(tilt)
    c.scale(1.45 * zoom, 1.45 * zoom)
    c.translate(0, -58)

    const shell = new Path2D()
    shell.moveTo(0, -58)
    shell.bezierCurveTo(34, -58, 46, -8, 44, 14)
    shell.bezierCurveTo(42, 44, 22, 58, 0, 58)
    shell.bezierCurveTo(-22, 58, -42, 44, -44, 14)
    shell.bezierCurveTo(-46, -8, -34, -58, 0, -58)

    const body = c.createRadialGradient(-12, -22, 4, 0, 0, 70)
    body.addColorStop(0, '#2a2631')
    body.addColorStop(1, INK_DEEP)
    c.fillStyle = body
    c.fill(shell)

    c.save()
    c.clip(shell)
    // чешуйчатая фактура скорлупы
    c.strokeStyle = 'rgba(255,255,255,0.07)'
    c.lineWidth = 1
    c.beginPath()
    for (let row = 0; row < 9; row++) {
      const y = -52 + row * 13
      for (let col = -4; col <= 4; col++) {
        const x = col * 13 + (row % 2 ? 6.5 : 0)
        c.moveTo(x - 6.5, y)
        c.arc(x, y, 6.5, Math.PI, 0, true)
      }
    }
    c.stroke()
    // жар изнутри разгорается с ростом опыта
    const glow = c.createRadialGradient(0, 4, 2, 0, 4, 52)
    glow.addColorStop(0, rgba(P.accent, (0.12 + 0.3 * this.ratio) * pulse))
    glow.addColorStop(1, rgba(P.accent, 0))
    c.fillStyle = glow
    c.fillRect(-60, -70, 120, 140)
    c.restore()

    const shown = 1 + Math.floor(this.ratio * (CRACKS.length - 0.01))
    c.shadowColor = P.accent
    c.shadowBlur = 10
    c.strokeStyle = rgba(P.bright, 0.55 + 0.45 * pulse)
    c.lineWidth = 1.6
    c.beginPath()
    for (let i = 0; i < shown; i++) {
      const crack = CRACKS[i]
      c.moveTo(crack[0][0], crack[0][1])
      for (let j = 1; j < crack.length; j++) c.lineTo(crack[j][0], crack[j][1])
    }
    c.stroke()

    c.strokeStyle = rgba(P.accent, 0.6)
    c.lineWidth = 1.1
    c.stroke(shell)
    c.shadowBlur = 0
    c.restore()
  }

  private geometry(): Geo {
    const n = this.chain.length
    const g: Geo = { n, x: [], y: [], ang: [], fx: [], fy: [], nx: [], ny: [], rad: [], tw: [] }
    for (let i = 0; i < n; i++) {
      const j = Math.max(1, i)
      const a = Math.atan2(this.chain[j - 1].y - this.chain[j].y, this.chain[j - 1].x - this.chain[j].x)
      const u = i / (n - 1)
      // шея тоньше, затем самое толстое место, к хвосту тело сходит на нет
      const profile = u < 0.2 ? 0.72 + 0.28 * (u / 0.2) : Math.pow(1 - (u - 0.2) / 0.8, 0.8) * 0.9 + 0.1
      g.x.push(this.chain[i].x)
      g.y.push(this.chain[i].y)
      g.ang.push(a)
      g.fx.push(Math.cos(a))
      g.fy.push(Math.sin(a))
      g.nx.push(Math.sin(a))
      g.ny.push(-Math.cos(a))
      g.rad.push(this.radius * profile)
      g.tw.push(clamp(Math.cos(a) * 1.8, -1, 1))
    }
    return g
  }

  private drawDragon(): void {
    const look = LOOKS[this.level]
    const g = this.geometry()
    const n = g.n
    const shoulder = Math.round(n * 0.2)
    const hip = Math.round(n * 0.55)

    if (look.pearl) this.drawPearl()
    if (look.tail) this.drawTail(g)

    // тело рисуется кусками от хвоста к голове: там, где дракон свивается в кольца,
    // ближняя к голове часть ложится поверх дальней вместе со своими лапами и гребнем
    const CHUNK = 5
    for (let to = n - 1; to > 0; to -= CHUNK) {
      const from = Math.max(0, to - CHUNK)
      const has = (i: number) => i >= from && i < to
      if (look.wings && has(shoulder)) this.drawWing(g, shoulder, true)
      if (look.claws) {
        if (has(shoulder)) this.drawLeg(g, shoulder, true, 0, look)
        if (has(hip)) this.drawLeg(g, hip, true, Math.PI, look)
      }
      this.drawBody(g, from, to)
      if (look.fin) this.drawFin(g, look, from, to)
      if (look.mane) this.drawNeckMane(g, look, from, to)
      if (look.claws) {
        if (has(shoulder)) this.drawLeg(g, shoulder, false, 0, look)
        if (has(hip)) this.drawLeg(g, hip, false, Math.PI, look)
      }
      if (look.wings && has(shoulder)) this.drawWing(g, shoulder, false)
    }

    this.drawHead(look, g.ang[0], g.tw[0])
    this.drawSparks()
  }

  /** Кусок тела от звена from до to: тёмная спина в карповой чешуе, светлые брюшные щитки, контровой свет по кромке. */
  private drawBody(g: Geo, from: number, to: number): void {
    const c = this.ctx
    const P = this.palette
    const n = g.n
    const spacing = this.radius * 0.62
    // заливка заходит на соседний кусок, чтобы на стыке не было просвета
    const end = Math.min(n - 1, to + 1)

    const ax: number[] = []
    const ay: number[] = []
    const bx: number[] = []
    const by: number[] = []
    for (let i = from; i <= end; i++) {
      ax.push(g.x[i] + g.nx[i] * g.rad[i])
      ay.push(g.y[i] + g.ny[i] * g.rad[i])
      bx.push(g.x[i] - g.nx[i] * g.rad[i])
      by.push(g.y[i] - g.ny[i] * g.rad[i])
    }
    const last = end - from
    const shape = new Path2D()
    smooth(shape, ax, ay, 0, last, true)
    if (end === n - 1) shape.lineTo(g.x[end] - g.fx[end] * spacing * 1.5, g.y[end] - g.fy[end] * spacing * 1.5)
    smooth(shape, bx, by, last, 0, false)
    shape.closePath()

    c.fillStyle = INK
    c.fill(shape)

    c.save()
    c.clip(shape)

    // чешуя лежит рядами по окружности тела и поворачивается вместе с ним; у кромки ряды сжимаются
    const near = new Path2D()
    const far = new Path2D()
    for (let i = Math.min(to, n - 2); i >= Math.max(1, from); i--) {
      const r = g.rad[i]
      if (r < 2.2) continue
      const ridge = Math.asin(g.tw[i])
      for (let k = -2; k <= 2; k++) {
        const around = ridge + k * 0.68
        const facing = Math.cos(around)
        if (facing < 0.15) continue
        const across = Math.sin(around)
        const shift = k & 1 ? spacing * 0.5 : 0
        const cx = g.x[i] + g.nx[i] * r * across + g.fx[i] * shift
        const cy = g.y[i] + g.ny[i] * r * across + g.fy[i] * shift
        const rx = spacing * 0.85
        const ry = r * 0.38 * facing
        const pen = facing > 0.7 ? near : far
        pen.moveTo(cx - g.fx[i] * rx * 0.315 - g.nx[i] * ry * 0.949, cy - g.fy[i] * rx * 0.315 - g.ny[i] * ry * 0.949)
        pen.ellipse(cx, cy, rx, ry, g.ang[i], Math.PI - 1.25, Math.PI + 1.25)
      }
    }
    c.lineWidth = 0.9
    c.strokeStyle = rgba(P.bright, 0.22)
    c.stroke(near)
    c.strokeStyle = 'rgba(255,255,255,0.09)'
    c.stroke(far)

    // брюхо: видно только сбоку, на развороте полоса сужается до нуля и переходит на другую кромку
    const ox: number[] = []
    const oy: number[] = []
    const ix: number[] = []
    const iy: number[] = []
    const width: number[] = []
    for (let i = from; i <= end; i++) {
      const s = g.tw[i]
      const side = s >= 0 ? 1 : -1
      const turned = Math.abs(s)
      const inner = turned > BELLY_EDGE ? Math.sin(Math.asin(turned) + BELLY) : 1
      const r = g.rad[i]
      // наружный край с запасом: лишнее срежет контур тела; там, где брюха не видно, запаса нет,
      // иначе на развороте полоса перечеркнула бы тело
      const outer = inner < 1 ? 1.3 : 1
      ox.push(g.x[i] - g.nx[i] * side * r * outer)
      oy.push(g.y[i] - g.ny[i] * side * r * outer)
      ix.push(g.x[i] - g.nx[i] * side * r * inner)
      iy.push(g.y[i] - g.ny[i] * side * r * inner)
      width.push(r * (1 - inner))
    }
    c.beginPath()
    c.moveTo(ox[0], oy[0])
    for (let i = 1; i <= last; i++) c.lineTo(ox[i], oy[i])
    for (let i = last; i >= 0; i--) c.lineTo(ix[i], iy[i])
    c.closePath()
    c.fillStyle = rgba(P.accent, 0.42)
    c.fill()

    // поперечные щитки и граница со спиной
    c.strokeStyle = 'rgba(8,7,10,0.62)'
    c.lineWidth = 1.2
    c.beginPath()
    let drawing = false
    for (let i = 0; i <= last; i++) {
      if (width[i] < 0.6) {
        drawing = false
        continue
      }
      c.moveTo(ox[i], oy[i])
      c.lineTo(ix[i], iy[i])
      if (drawing) {
        c.moveTo(ix[i - 1], iy[i - 1])
        c.lineTo(ix[i], iy[i])
      }
      drawing = true
    }
    c.stroke()
    c.restore()

    // контровой свет по обеим кромкам — на чёрном фоне силуэт держится на нём
    const rim = new Path2D()
    smooth(rim, ax, ay, 0, last, true)
    smooth(rim, bx, by, 0, last, true)
    if (end === n - 1) {
      rim.moveTo(ax[last], ay[last])
      rim.lineTo(g.x[end] - g.fx[end] * spacing * 1.5, g.y[end] - g.fy[end] * spacing * 1.5)
      rim.lineTo(bx[last], by[last])
    }
    c.shadowColor = P.accent
    c.shadowBlur = 8
    c.strokeStyle = rgba(P.accent, 0.66)
    c.lineWidth = 1.1
    c.stroke(rim)
    c.shadowBlur = 0
  }

  /** Гребень из языков пламени вдоль хребта; при виде сверху ложится плашмя по середине спины. */
  private drawFin(g: Geo, look: Look, from: number, to: number): void {
    const c = this.ctx
    const P = this.palette
    const spacing = this.radius * 0.62
    // на шее гребень уступает место гриве
    const first = look.mane ? 2 + look.mane : 3
    // без размытой тени: на телефоне это самая дорогая операция, а свечение даёт кромка тела
    c.fillStyle = rgba(P.accent, 0.92)
    c.beginPath()
    for (let i = Math.max(from, first); i < Math.min(to, g.n - 2); i++) {
      if ((i - first) % 2) continue
      const r = g.rad[i]
      const s = g.tw[i]
      const h = r * look.fin * (0.5 + 0.55 * Math.abs(s))
      const w = spacing * 0.85
      const bx = g.x[i] + g.nx[i] * r * s * 0.9
      const by = g.y[i] + g.ny[i] * r * s * 0.9
      const tx = bx + g.nx[i] * s * h - g.fx[i] * h * 0.95
      const ty = by + g.ny[i] * s * h - g.fy[i] * h * 0.95
      c.moveTo(bx + g.fx[i] * w, by + g.fy[i] * w)
      c.quadraticCurveTo(bx + (tx - bx) * 0.3 + g.fx[i] * w * 0.3, by + (ty - by) * 0.3 + g.fy[i] * w * 0.3, tx, ty)
      c.quadraticCurveTo(bx + (tx - bx) * 0.5 - g.fx[i] * w * 0.9, by + (ty - by) * 0.5 - g.fy[i] * w * 0.9, bx - g.fx[i] * w, by - g.fy[i] * w)
      c.closePath()
    }
    c.fill()
  }

  /** Грива вдоль шеи: длинные пряди, которые относит назад. */
  private drawNeckMane(g: Geo, look: Look, from: number, to: number): void {
    const c = this.ctx
    const P = this.palette
    if (from > look.mane) return
    for (let pass = 0; pass < 2; pass++) {
      // второй проход — раскалённая сердцевина прядей
      const size = pass === 0 ? 1 : 0.55
      c.fillStyle = pass === 0 ? rgba(P.accent, 0.85) : rgba(P.bright, 0.5)
      c.shadowColor = P.accent
      c.shadowBlur = pass === 0 ? 7 : 0
      c.beginPath()
      for (let j = 0; j < look.mane; j++) {
        const i = 1 + j
        if (i < from || i >= to || i >= g.n) continue
        const r = g.rad[i]
        const s = g.tw[i]
        const len = this.radius * (2.1 - j * 0.12) * size * (0.6 + 0.4 * Math.abs(s))
        const wave = Math.sin(this.t * 2.2 + j * 0.9) * this.radius * 0.3
        const bx = g.x[i] + g.nx[i] * r * s * 0.85
        const by = g.y[i] + g.ny[i] * r * s * 0.85
        const lift = s * len * 0.5 + wave * 0.6
        leaf(c, bx, by, bx + g.nx[i] * lift - g.fx[i] * len, by + g.ny[i] * lift - g.fy[i] * len, this.radius * 0.6 * size, wave * 0.5)
      }
      c.fill()
    }
    c.shadowBlur = 0
  }

  /** Хвост заканчивается веером языков пламени. */
  private drawTail(g: Geo): void {
    const c = this.ctx
    const P = this.palette
    const i = g.n - 1
    const back = g.ang[i] + Math.PI
    c.fillStyle = rgba(P.accent, 0.85)
    c.shadowColor = P.accent
    c.shadowBlur = 7
    c.beginPath()
    for (let j = -2; j <= 2; j++) {
      const a = back + j * 0.3 + Math.sin(this.t * 2.4 + j) * 0.12
      const len = this.radius * (3 - Math.abs(j) * 0.45)
      leaf(c, g.x[i], g.y[i], g.x[i] + Math.cos(a) * len, g.y[i] + Math.sin(a) * len, this.radius * 0.6, Math.sin(this.t * 2 + j) * this.radius * 0.25)
    }
    c.fill()
    c.shadowBlur = 0
  }

  /**
   * Лапа тигра с орлиными когтями. Ближняя рисуется поверх тела, дальняя — под ним.
   * При виде сбоку обе тянутся к брюху, при виде сверху расходятся в стороны.
   */
  private drawLeg(g: Geo, i: number, far: boolean, phase: number, look: Look): void {
    const c = this.ctx
    const P = this.palette
    const s = g.tw[i]
    const reach = -s * (far ? 0.85 : 1) + (far ? 1 : -1) * (1 - Math.abs(s))
    const r = g.rad[i]
    const len = r * (look.claws >= 4 ? 2.1 : 1.5)
    const swing = Math.sin(this.t * 2.6 + phase + (far ? Math.PI : 0))
    const lx = g.nx[i] * reach
    const ly = g.ny[i] * reach
    const fx = g.fx[i]
    const fy = g.fy[i]

    const hx = g.x[i] + lx * r * 0.35 + (far ? fx * r * 0.5 : 0)
    const hy = g.y[i] + ly * r * 0.35 + (far ? fy * r * 0.5 : 0)
    const kx = hx + lx * len * 0.55 + fx * len * (0.2 + 0.28 * swing)
    const ky = hy + ly * len * 0.55 + fy * len * (0.2 + 0.28 * swing)
    const px = kx + lx * len * 0.5 - fx * len * 0.42
    const py = ky + ly * len * 0.5 - fy * len * 0.42

    // бедро и голень — два листа: мускулистое бедро и сухая голень, на конце — лапа
    const bulge = (reach >= 0 ? 1 : -1) * (far ? -1 : 1)
    const shape = new Path2D()
    leaf(shape, hx - (kx - hx) * 0.25, hy - (ky - hy) * 0.25, kx + (kx - hx) * 0.12, ky + (ky - hy) * 0.12, r * 0.95, r * 0.18 * bulge)
    leaf(shape, kx - (px - kx) * 0.12, ky - (py - ky) * 0.12, px, py, r * 0.5, -r * 0.1 * bulge)
    shape.moveTo(px + r * 0.2, py)
    shape.arc(px, py, r * 0.2, 0, Math.PI * 2)
    c.fillStyle = far ? INK_DEEP : INK
    c.fill(shape)
    c.strokeStyle = rgba(P.accent, far ? 0.22 : 0.6)
    c.lineWidth = 0.9
    c.stroke(shape)

    // когти смотрят вперёд и чуть наружу
    const out = reach >= 0 ? 1 : -1
    const base = Math.atan2(fy * 0.8 + g.ny[i] * out * 0.6, fx * 0.8 + g.nx[i] * out * 0.6)
    c.strokeStyle = far ? rgba(P.bright, 0.4) : P.bright
    c.lineWidth = 1.2
    if (!far) {
      c.shadowColor = P.accent
      c.shadowBlur = 5
    }
    c.beginPath()
    for (let q = 0; q < look.claws; q++) {
      const a = base + (q - (look.claws - 1) / 2) * 0.36
      c.moveTo(px, py)
      c.quadraticCurveTo(px + Math.cos(a) * r * 0.45, py + Math.sin(a) * r * 0.45, px + Math.cos(a + 0.35 * out) * r * 0.78, py + Math.sin(a + 0.35 * out) * r * 0.78)
    }
    c.stroke()
    c.shadowBlur = 0
  }

  /**
   * Крыло ин-луна: рука-дуга от плеча, от неё веером расходятся перья — у тела смотрят назад,
   * к концу крыла разворачиваются наружу. Медленно машет.
   */
  private drawWing(g: Geo, i: number, far: boolean): void {
    const c = this.ctx
    const P = this.palette
    const s = g.tw[i]
    const reach = s + (far ? -1 : 1) * (1 - Math.abs(s))
    const r = g.rad[i]
    const span = r * 6.2 * (far ? 0.9 : 1)
    const flap = Math.sin(this.t * 1.7 + (far ? 0.5 : 0))
    const ox = g.x[i] + g.nx[i] * reach * r * 0.5
    const oy = g.y[i] + g.ny[i] * reach * r * 0.5
    // точка крыла: «вверх» от спины и «назад» вдоль тела, в долях размаха
    const at = (up: number, back: number): [number, number] => [
      ox + (g.nx[i] * reach * up - g.fx[i] * back) * span,
      oy + (g.ny[i] * reach * up - g.fy[i] * back) * span,
    ]
    const lift = 0.85 + 0.2 * flap
    const arm: [number, number][] = [[0, 0], [0.3 * lift, -0.1], [0.56 * lift, 0.1]]

    const feathers = new Path2D()
    const COUNT = 11
    for (let j = 0; j < COUNT; j++) {
      const u = j / (COUNT - 1)
      const seg = u < 0.5 ? 0 : 1
      const k = u < 0.5 ? u * 2 : u * 2 - 1
      const up = lerp(arm[seg][0], arm[seg + 1][0], k)
      const back = lerp(arm[seg][1], arm[seg + 1][1], k)
      // угол пера от «вверх» к «назад»
      const turn = lerp(2.45, 0.5, Math.pow(u, 0.8)) - flap * 0.14
      const len = lerp(0.36, 0.62, u)
      const [bx, by] = at(up, back)
      const [tx, ty] = at(up + Math.cos(turn) * len, back + Math.sin(turn) * len)
      leaf(feathers, bx, by, tx, ty, span * 0.15, span * 0.035 * (reach >= 0 ? -1 : 1))
    }
    c.fillStyle = rgba(P.accent, far ? 0.16 : 0.3)
    if (!far) {
      c.shadowColor = P.accent
      c.shadowBlur = 8
    }
    c.fill(feathers)
    c.shadowBlur = 0
    c.strokeStyle = rgba(P.bright, far ? 0.22 : 0.55)
    c.lineWidth = 0.8
    c.stroke(feathers)

    const bone = new Path2D()
    const [sx, sy] = at(arm[0][0], arm[0][1])
    const [ex, ey] = at(arm[1][0], arm[1][1])
    const [wx, wy] = at(arm[2][0], arm[2][1])
    bone.moveTo(sx, sy)
    bone.quadraticCurveTo(ex, ey, wx, wy)
    c.strokeStyle = far ? INK_DEEP : INK
    c.lineWidth = r * 0.3
    c.stroke(bone)
    c.strokeStyle = rgba(P.bright, far ? 0.3 : 0.8)
    c.lineWidth = 1
    c.stroke(bone)
  }

  private drawPearl(): void {
    const c = this.ctx
    const P = this.palette
    const p = this.path(this.t + 0.9)
    const glow = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 26)
    glow.addColorStop(0, rgba(P.bright, 0.7))
    glow.addColorStop(1, rgba(P.accent, 0))
    c.fillStyle = glow
    c.fillRect(p.x - 26, p.y - 26, 52, 52)
    c.shadowColor = P.bright
    c.shadowBlur = 16
    c.fillStyle = '#ffffff'
    c.beginPath()
    c.arc(p.x, p.y, 4.5, 0, Math.PI * 2)
    c.fill()
    c.shadowBlur = 0
  }

  /** Голова: сбоку — профиль, на развороте (тело видно сверху) — вид сверху; между ними короткий переход. */
  private drawHead(look: Look, angle: number, twist: number): void {
    const c = this.ctx
    const turned = Math.abs(twist)
    const profile = clamp((turned - 0.12) / 0.1, 0, 1)
    if (profile < 1) {
      c.globalAlpha = 1 - profile
      this.drawHeadTop(look, angle)
    }
    if (profile > 0) {
      c.globalAlpha = profile
      this.drawHeadSide(look, angle, twist >= 0 ? 1 : -1, 0.85 + 0.15 * turned)
    }
    c.globalAlpha = 1
  }

  /** Олений рог в профиль; дальний рисуется бледнее и со сдвигом. */
  private antler(level: number, ox: number, oy: number, alpha: number): void {
    const c = this.ctx
    const P = this.palette
    const long = level === 1 ? 7 : level === 2 ? 15 : 25
    const x = -1 + ox
    const y = -10 + oy
    const horn = new Path2D()
    horn.moveTo(x, y)
    horn.quadraticCurveTo(x - long * 0.12, y - long * 0.5, x - long * 0.7, y - long * 0.72)
    if (level >= 3) horn.quadraticCurveTo(x - long * 0.95, y - long * 0.8, x - long * 1.05, y - long * 1.15)
    if (level >= 2) {
      horn.moveTo(x - long * 0.23, y - long * 0.43)
      horn.quadraticCurveTo(x - long * 0.2, y - long * 0.75, x - long * 0.02, y - long * 0.98)
    }
    if (level >= 3) {
      horn.moveTo(x - long * 0.49, y - long * 0.62)
      horn.quadraticCurveTo(x - long * 0.52, y - long * 0.95, x - long * 0.36, y - long * 1.2)
      horn.moveTo(x - long * 0.03, y - long * 0.14)
      horn.quadraticCurveTo(x + long * 0.12, y - long * 0.3, x + long * 0.3, y - long * 0.34)
    }
    c.strokeStyle = INK_DEEP
    c.lineWidth = 3.4
    c.stroke(horn)
    c.shadowColor = P.accent
    c.shadowBlur = 6
    c.strokeStyle = rgba(P.bright, alpha)
    c.lineWidth = 1.8
    c.stroke(horn)
    c.shadowBlur = 0
  }

  /**
   * Голова в профиль по «девяти подобиям»: длинная верблюжья морда, оленьи рога, коровье ухо, глаз демона.
   * Нарисована для радиуса тела 10, смотрит вдоль +x, верх — в сторону −y; flip переворачивает её при полёте влево.
   */
  private drawHeadSide(look: Look, angle: number, flip: number, squash: number): void {
    const c = this.ctx
    const P = this.palette
    const t = this.t
    const k = (this.radius / 10) * 1.2
    const jaw = (look.fangs ? 0.2 : 0.07) + 0.05 * Math.sin(t * 1.3)

    c.save()
    c.translate(this.chain[0].x, this.chain[0].y)
    c.rotate(angle)
    c.scale(k, k * flip * squash)

    if (look.horns) this.antler(look.horns, 2.6, 0.9, 0.45)

    if (look.whiskers) {
      const len = 30 * look.whiskers
      const wave = Math.sin(t * 1.9 + 1) * 3
      c.strokeStyle = rgba(P.bright, 0.45)
      c.lineWidth = 0.7
      c.beginPath()
      c.moveTo(23, -3.2)
      c.bezierCurveTo(32, -5 + wave, 24 - len * 0.45, 20 - wave, 14 - len * 0.9, 12 + wave)
      c.stroke()
    }

    if (look.mane) {
      for (let pass = 0; pass < 2; pass++) {
        const size = pass === 0 ? 1 : 0.55
        c.fillStyle = pass === 0 ? rgba(P.accent, 0.85) : rgba(P.bright, 0.5)
        c.shadowColor = P.accent
        c.shadowBlur = pass === 0 ? 6 : 0
        c.beginPath()
        for (let j = 0; j < Math.min(look.mane, MANE.length); j++) {
          const [bx, by, long] = MANE[j]
          const wave = Math.sin(t * 2.1 + j * 1.3) * 3
          leaf(c, bx, by, bx - long * size, by * 1.7 + wave, 5 * size, wave * 0.6 + by * 0.15)
        }
        c.fill()
      }
      c.shadowBlur = 0
    }

    // жар в пасти
    c.fillStyle = rgba(P.accent, 0.55)
    c.beginPath()
    c.moveTo(3, 3)
    c.lineTo(22, 0.8)
    c.lineTo(2 + 19 * Math.cos(jaw), 3.5 + 19 * Math.sin(jaw))
    c.closePath()
    c.fill()

    // нижняя челюсть ходит на шарнире
    c.save()
    c.translate(2, 3.5)
    c.rotate(jaw)
    c.translate(-2, -3.5)
    const lower = new Path2D()
    lower.moveTo(0, 3)
    lower.quadraticCurveTo(10, 4.6, 19.5, 3.4)
    lower.quadraticCurveTo(22, 3.6, 21.2, 5.6)
    lower.quadraticCurveTo(14, 8.8, 5, 9.2)
    lower.quadraticCurveTo(-1, 9.8, -5, 9)
    lower.lineTo(-5, 5)
    lower.closePath()
    if (look.beard) {
      c.fillStyle = rgba(P.accent, 0.8)
      c.beginPath()
      const wave = Math.sin(t * 2 + 2) * 2
      leaf(c, 12, 8, 4, 17 - wave, 3.4, 1.5)
      leaf(c, 8, 8.6, -3, 18 + wave, 4, 2)
      leaf(c, 4, 9, -9, 15 + wave, 3.4, 1.5)
      c.fill()
    }
    c.fillStyle = INK
    c.fill(lower)
    c.strokeStyle = rgba(P.accent, 0.7)
    c.lineWidth = 0.9
    c.stroke(lower)
    if (look.fangs) {
      c.fillStyle = BONE
      c.beginPath()
      for (let x = 15.6; x >= 8; x -= 2.6) {
        const y = 3.6 + (19 - x) * 0.07
        c.moveTo(x + 0.8, y)
        c.lineTo(x, y - 1.7)
        c.lineTo(x - 0.8, y)
      }
      c.moveTo(19.2, 3.5)
      c.lineTo(18.4, 0.4)
      c.lineTo(17.4, 3.6)
      c.fill()
    }
    c.restore()

    const skull = new Path2D()
    skull.moveTo(-9, -8)
    skull.quadraticCurveTo(-4, -11.4, 2, -10.6)
    skull.quadraticCurveTo(6, -10, 8.5, -7.6)
    skull.quadraticCurveTo(12.5, -6, 16.5, -7)
    skull.quadraticCurveTo(21.5, -8.6, 24.2, -5.6)
    skull.quadraticCurveTo(25.6, -3, 24, -0.6)
    skull.lineTo(21, 0.8)
    skull.quadraticCurveTo(14, 1.6, 7, 2.6)
    skull.lineTo(2.5, 3.2)
    skull.quadraticCurveTo(-1, 6.5, -5, 9.4)
    skull.lineTo(-9, 8.2)
    skull.closePath()
    c.fillStyle = INK
    c.fill(skull)
    c.shadowColor = P.accent
    c.shadowBlur = 8
    c.strokeStyle = rgba(P.accent, 0.75)
    c.lineWidth = 0.9
    c.stroke(skull)
    c.shadowBlur = 0

    if (look.fangs) {
      c.fillStyle = BONE
      c.beginPath()
      for (let x = 17; x >= 8; x -= 2.6) {
        const y = 0.9 + (21 - x) * 0.118
        c.moveTo(x + 0.9, y)
        c.lineTo(x, y + 2)
        c.lineTo(x - 0.9, y + 0.15)
      }
      c.moveTo(21, 0.8)
      c.lineTo(20, 5)
      c.lineTo(19.2, 1.1)
      c.fill()
    }

    // чешуя на щеке и складка вдоль морды
    c.strokeStyle = 'rgba(255,255,255,0.14)'
    c.lineWidth = 0.6
    c.beginPath()
    for (const [x, y] of [[-1, -3], [-4, 1], [0, 2.5], [-5, -5], [-2, 5.5]]) {
      c.moveTo(x + 2.4 * Math.cos(Math.PI - 1.1), y + 2.4 * Math.sin(Math.PI - 1.1))
      c.arc(x, y, 2.4, Math.PI - 1.1, Math.PI + 1.1)
    }
    c.moveTo(10, -4.6)
    c.quadraticCurveTo(16, -4, 22, -5.4)
    c.stroke()

    if (look.claws) {
      const flick = Math.sin(t * 1.4) * 1.2
      c.beginPath()
      leaf(c, -2.5, -8.2, -12, -13.5 + flick, 4.4, -1.6)
      c.fillStyle = INK
      c.fill()
      c.strokeStyle = rgba(P.accent, 0.65)
      c.lineWidth = 0.7
      c.stroke()
    }

    // надбровная дуга
    c.strokeStyle = INK_DEEP
    c.lineWidth = 1.7
    c.beginPath()
    c.moveTo(4, -8.4)
    c.quadraticCurveTo(8, -9.6, 11.8, -6.4)
    c.stroke()
    c.strokeStyle = rgba(P.bright, 0.55)
    c.lineWidth = 0.5
    c.beginPath()
    c.moveTo(4, -9.1)
    c.quadraticCurveTo(8, -10.3, 11.8, -7.1)
    c.stroke()

    // глаз — самое яркое место всей фигуры
    c.shadowColor = P.bright
    c.shadowBlur = 12
    c.fillStyle = P.bright
    c.beginPath()
    c.ellipse(8.2, -5.9, 2.5, 1.35, -0.2, 0, Math.PI * 2)
    c.fill()
    c.shadowBlur = 0
    c.fillStyle = INK_DEEP
    c.beginPath()
    c.ellipse(8.5, -5.9, 0.5, 1.2, -0.2, 0, Math.PI * 2)
    c.fill()

    c.fillStyle = rgba(P.accent, 0.9)
    c.beginPath()
    c.arc(22.6, -5.2, 0.8, 0, Math.PI * 2)
    c.fill()

    if (look.bump) {
      c.beginPath()
      c.ellipse(3.6, -11, 2.4, 1.6, 0, 0, Math.PI * 2)
      if (look.mark) {
        c.shadowColor = P.bright
        c.shadowBlur = 10
        c.fillStyle = P.bright
        c.fill()
        c.shadowBlur = 0
      } else {
        c.fillStyle = INK
        c.fill()
        c.strokeStyle = rgba(P.accent, 0.7)
        c.lineWidth = 0.7
        c.stroke()
      }
    }

    if (look.horns) this.antler(look.horns, 0, 0, 0.95)

    if (look.whiskers) {
      const len = 30 * look.whiskers
      const wave = Math.sin(t * 1.9) * 3
      c.strokeStyle = rgba(P.bright, 0.9)
      c.lineWidth = 0.9
      c.shadowColor = P.accent
      c.shadowBlur = 4
      c.beginPath()
      c.moveTo(23, -2.4)
      c.bezierCurveTo(33, -6 + wave, 26 - len * 0.5, 15 + wave, 16 - len, 6 - wave * 1.5)
      c.stroke()
      c.shadowBlur = 0
    }
    c.restore()
  }

  /** Голова сверху — её видно на разворотах. Нарисована для радиуса тела 10 и смотрит вдоль +x. */
  private drawHeadTop(look: Look, angle: number): void {
    const c = this.ctx
    const P = this.palette
    const s = (this.radius / 10) * 1.2
    const jowls = look.claws > 0
    c.save()
    c.translate(this.chain[0].x, this.chain[0].y)
    c.rotate(angle)
    c.scale(s, s)

    if (look.horns) {
      const long = look.horns === 1 ? 10 : look.horns === 2 ? 17 : 24
      const horn = new Path2D()
      for (const side of [-1, 1]) {
        horn.moveTo(-3, 5 * side)
        horn.quadraticCurveTo(-3 - long * 0.5, 13 * side, -3 - long, 9 * side)
        if (look.horns >= 2) {
          horn.moveTo(-3 - long * 0.45, 10.6 * side)
          horn.lineTo(-3 - long * 0.75, 17 * side)
        }
        if (look.horns >= 3) {
          horn.moveTo(-3 - long * 0.72, 10.6 * side)
          horn.lineTo(-3 - long * 1.02, 15.5 * side)
        }
      }
      c.strokeStyle = INK_DEEP
      c.lineWidth = 3.4
      c.stroke(horn)
      c.shadowColor = P.accent
      c.shadowBlur = 6
      c.strokeStyle = rgba(P.bright, 0.95)
      c.lineWidth = 1.8
      c.stroke(horn)
      c.shadowBlur = 0
    }

    if (look.whiskers) {
      const len = 26 * look.whiskers
      c.strokeStyle = rgba(P.bright, 0.85)
      c.lineWidth = 0.9
      c.shadowColor = P.accent
      c.shadowBlur = 4
      c.beginPath()
      for (const side of [-1, 1]) {
        const wave = Math.sin(this.t * 1.9 + side) * 4
        c.moveTo(15, 3.5 * side)
        c.bezierCurveTo(24, (9 + wave) * side, 16 - len * 0.5, (17 + wave) * side, 10 - len, (13 - wave) * side)
      }
      c.stroke()
      c.shadowBlur = 0
    }

    if (look.mane) {
      c.fillStyle = rgba(P.accent, 0.85)
      c.shadowColor = P.accent
      c.shadowBlur = 6
      c.beginPath()
      for (let j = 0; j < Math.min(look.mane, 8); j++) {
        const side = j % 2 ? 1 : -1
        const row = Math.floor(j / 2)
        const wave = Math.sin(this.t * 2.1 + j * 1.3) * 3
        leaf(c, -5 - row, (7 - row * 1.4) * side, -22 - row * 3, (11 - row * 2) * side + wave, 5, wave * 0.5)
      }
      c.fill()
      c.shadowBlur = 0
    }

    const skull = new Path2D()
    skull.moveTo(24, 0)
    skull.quadraticCurveTo(23.5, 3.6, 19, 4)
    skull.quadraticCurveTo(12, 3.8, 7, 6)
    skull.quadraticCurveTo(2, 8.8, -4, 8.6)
    if (jowls) skull.lineTo(-9.5, 11.5)
    skull.quadraticCurveTo(-7, 4, -6.5, 0)
    skull.quadraticCurveTo(-7, -4, jowls ? -9.5 : -4, jowls ? -11.5 : -8.6)
    if (jowls) skull.lineTo(-4, -8.6)
    skull.quadraticCurveTo(2, -8.8, 7, -6)
    skull.quadraticCurveTo(12, -3.8, 19, -4)
    skull.quadraticCurveTo(23.5, -3.6, 24, 0)
    c.fillStyle = INK
    c.fill(skull)
    c.shadowColor = P.accent
    c.shadowBlur = 8
    c.strokeStyle = rgba(P.accent, 0.75)
    c.lineWidth = 0.9
    c.stroke(skull)
    c.shadowBlur = 0

    // гребень по переносице и надбровные дуги
    c.strokeStyle = 'rgba(255,255,255,0.16)'
    c.lineWidth = 0.7
    c.beginPath()
    c.moveTo(21, 0)
    c.lineTo(-5, 0)
    c.moveTo(11, 2.8)
    c.quadraticCurveTo(6, 3.2, 1.5, 6.6)
    c.moveTo(11, -2.8)
    c.quadraticCurveTo(6, -3.2, 1.5, -6.6)
    c.stroke()

    c.fillStyle = rgba(P.accent, 0.9)
    c.beginPath()
    c.arc(21.4, 1.7, 0.7, 0, Math.PI * 2)
    c.arc(21.4, -1.7, 0.7, 0, Math.PI * 2)
    c.fill()

    c.shadowColor = P.bright
    c.shadowBlur = 12
    c.fillStyle = P.bright
    for (const side of [-1, 1]) {
      c.beginPath()
      c.ellipse(6, 5 * side, 2.5, 1.25, 0.5 * side, 0, Math.PI * 2)
      c.fill()
    }
    if (look.mark) {
      c.beginPath()
      c.ellipse(1, 0, 2.2, 1.6, 0, 0, Math.PI * 2)
      c.fill()
    }
    c.shadowBlur = 0
    c.restore()
  }

  private drawSparks(): void {
    const c = this.ctx
    c.globalCompositeOperation = 'lighter'
    for (const s of this.sparks) {
      c.fillStyle = rgba(this.palette.bright, (1 - s.life / s.max) * 0.9)
      c.beginPath()
      c.arc(s.x, s.y, s.size, 0, Math.PI * 2)
      c.fill()
    }
    c.globalCompositeOperation = 'source-over'
  }
}
