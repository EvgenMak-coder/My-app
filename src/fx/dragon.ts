import { lerp, prefersReducedMotion, rand, rgba, type Palette } from './util'

/** Логическая высота сцены; ширина подстраивается под холст, чтобы дракону было где развернуться. */
const H = 300
const INK = '#121016'
const INK_DEEP = '#08070a'

/** Что есть у дракона на каждой стадии (индекс = номер стадии из game/xp.ts). */
interface Look {
  segments: number
  radius: number
  /** 0 — нет, 1 — рожки, 2 — с отростком, 3 — ветвистые */
  horns: number
  /** длина усов, 0 — нет */
  whiskers: number
  /** число прядей гривы */
  mane: number
  ridge: boolean
  legs: boolean
  tuft: boolean
  fangs: boolean
  /** искры вокруг тела: 0…3 */
  aura: number
  /** светящийся знак на лбу */
  mark: boolean
  pearl: boolean
}

const LOOKS: Look[] = [
  { segments: 0, radius: 0, horns: 0, whiskers: 0, mane: 0, ridge: false, legs: false, tuft: false, fangs: false, aura: 0, mark: false, pearl: false },
  { segments: 12, radius: 6, horns: 0, whiskers: 0, mane: 0, ridge: false, legs: false, tuft: false, fangs: false, aura: 0, mark: false, pearl: false },
  { segments: 18, radius: 8, horns: 0, whiskers: 0, mane: 0, ridge: true, legs: false, tuft: false, fangs: false, aura: 0, mark: false, pearl: false },
  { segments: 23, radius: 9.5, horns: 1, whiskers: 0.6, mane: 4, ridge: true, legs: false, tuft: true, fangs: false, aura: 0, mark: false, pearl: false },
  { segments: 28, radius: 11, horns: 1, whiskers: 0.8, mane: 8, ridge: true, legs: true, tuft: true, fangs: false, aura: 0, mark: false, pearl: false },
  { segments: 33, radius: 12.5, horns: 2, whiskers: 1, mane: 12, ridge: true, legs: true, tuft: true, fangs: true, aura: 0, mark: false, pearl: false },
  { segments: 38, radius: 14, horns: 2, whiskers: 1.2, mane: 16, ridge: true, legs: true, tuft: true, fangs: true, aura: 1, mark: false, pearl: false },
  { segments: 42, radius: 15.5, horns: 3, whiskers: 1.4, mane: 20, ridge: true, legs: true, tuft: true, fangs: true, aura: 2, mark: true, pearl: false },
  { segments: 46, radius: 17, horns: 3, whiskers: 1.6, mane: 24, ridge: true, legs: true, tuft: true, fangs: true, aura: 3, mark: true, pearl: true },
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

interface Vec { x: number; y: number }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number }

export class DragonScene {
  private ctx: CanvasRenderingContext2D
  private scale = 1
  private w = 360
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
    if (prefersReducedMotion()) this.drawStill()
  }

  resize(): void {
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    if (!width || !height) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.width = Math.round(width * dpr)
    this.canvas.height = Math.round(height * dpr)
    this.scale = this.canvas.height / H
    this.w = this.canvas.width / this.scale
    if (prefersReducedMotion()) this.drawStill()
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

  /** Неподвижный кадр для тех, у кого анимации отключены. */
  private drawStill(): void {
    this.draw()
  }

  /** Траектория головы: плавная «восьмёрка» на всю ширину поля. */
  private path(t: number): Vec {
    const reach = Math.max(60, this.w / 2 - 90)
    return {
      x: this.w / 2 + Math.sin(t * 0.5) * reach * 0.84 + Math.sin(t * 1.27 + 1) * reach * 0.16,
      y: H / 2 + Math.sin(t + 0.4) * 76 + Math.cos(t * 0.63) * 20,
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
    c.clearRect(0, 0, this.w, H)
    c.lineCap = 'round'
    c.lineJoin = 'round'
    this.drawHalo()
    if (this.level === 0) this.drawEgg()
    else this.drawDragon()
  }

  /** Мягкий отсвет за драконом — без него тёмное тело теряется на тёмном фоне. Летит вместе с ним. */
  private drawHalo(): void {
    const c = this.ctx
    const mid = this.chain[Math.floor(this.chain.length / 3)] ?? { x: this.w / 2, y: H / 2 }
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

    c.save()
    c.translate(this.w / 2, H / 2 + 84)
    c.rotate(tilt)
    c.scale(1.45, 1.45)
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

  private drawDragon(): void {
    const c = this.ctx
    const P = this.palette
    const look = LOOKS[this.level]
    const n = this.chain.length
    const spacing = this.radius * 0.62

    // направление и толщина тела в каждом звене
    const ang: number[] = new Array(n)
    const rad: number[] = new Array(n)
    for (let i = 1; i < n; i++) {
      ang[i] = Math.atan2(this.chain[i - 1].y - this.chain[i].y, this.chain[i - 1].x - this.chain[i].x)
    }
    ang[0] = ang[1]
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1)
      const profile = u < 0.2 ? 0.72 + 0.28 * (u / 0.2) : Math.pow(1 - (u - 0.2) / 0.8, 0.8) * 0.9 + 0.1
      rad[i] = this.radius * profile
    }
    const dirX = (i: number) => Math.cos(ang[i])
    const dirY = (i: number) => Math.sin(ang[i])

    if (look.pearl) this.drawPearl()
    if (look.tuft) this.drawTuft(n - 1, ang[n - 1])
    if (look.legs) {
      this.drawLegs(Math.round(n * 0.2), ang, rad, 0)
      this.drawLegs(Math.round(n * 0.55), ang, rad, Math.PI)
    }

    // контур тела: левая кромка от головы к хвосту, обратно по правой
    const outline = new Path2D()
    for (let i = 0; i < n; i++) {
      const x = this.chain[i].x - dirY(i) * rad[i]
      const y = this.chain[i].y + dirX(i) * rad[i]
      if (i === 0) outline.moveTo(x, y)
      else outline.lineTo(x, y)
    }
    outline.lineTo(this.chain[n - 1].x - dirX(n - 1) * spacing * 1.5, this.chain[n - 1].y - dirY(n - 1) * spacing * 1.5)
    for (let i = n - 1; i >= 0; i--) {
      outline.lineTo(this.chain[i].x + dirY(i) * rad[i], this.chain[i].y - dirX(i) * rad[i])
    }
    outline.closePath()
    c.fillStyle = INK
    c.fill(outline)

    // чешуя: три ряда дужек, обращённых к хвосту
    c.strokeStyle = 'rgba(255,255,255,0.11)'
    c.lineWidth = 0.8
    c.beginPath()
    for (let i = n - 2; i >= 1; i--) {
      const r = rad[i]
      if (r < 2.2) continue
      const back = ang[i] + Math.PI
      const { x, y } = this.chain[i]
      c.moveTo(x + Math.cos(back - 1.2) * r * 0.9, y + Math.sin(back - 1.2) * r * 0.9)
      c.arc(x, y, r * 0.9, back - 1.2, back + 1.2)
      for (const side of [-1, 1]) {
        const sx = x - dirY(i) * r * 0.5 * side + dirX(i) * spacing * 0.5
        const sy = y + dirX(i) * r * 0.5 * side + dirY(i) * spacing * 0.5
        c.moveTo(sx + Math.cos(back - 1.3) * r * 0.45, sy + Math.sin(back - 1.3) * r * 0.45)
        c.arc(sx, sy, r * 0.45, back - 1.3, back + 1.3)
      }
    }
    c.stroke()

    // светящийся гребень вдоль хребта
    if (look.ridge) {
      c.fillStyle = rgba(P.accent, 0.9)
      c.shadowColor = P.accent
      c.shadowBlur = 6
      c.beginPath()
      for (let i = 2; i < n - 2; i += 2) {
        const r = rad[i]
        const { x, y } = this.chain[i]
        c.moveTo(x - dirY(i) * r * 0.24, y + dirX(i) * r * 0.24)
        c.lineTo(x - dirX(i) * spacing * 1.7, y - dirY(i) * spacing * 1.7)
        c.lineTo(x + dirY(i) * r * 0.24, y - dirX(i) * r * 0.24)
        c.closePath()
      }
      c.fill()
    }

    // контровой свет по кромке — на чёрном фоне силуэт держится на нём
    c.shadowColor = P.accent
    c.shadowBlur = 9
    c.strokeStyle = rgba(P.accent, 0.62)
    c.lineWidth = 1.1
    c.stroke(outline)
    c.shadowBlur = 0

    if (look.mane) this.drawMane(look.mane, ang, rad)
    this.drawHead(look, ang[0])
    this.drawSparks()
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

  private drawTuft(index: number, angle: number): void {
    const c = this.ctx
    const { x, y } = this.chain[index]
    const back = angle + Math.PI
    const len = this.radius * 2.6
    for (let pass = 0; pass < 2; pass++) {
      c.strokeStyle = pass === 0 ? INK_DEEP : rgba(this.palette.accent, 0.6)
      c.lineWidth = pass === 0 ? 2.6 : 0.8
      c.beginPath()
      for (let j = -3; j <= 3; j++) {
        const a = back + j * 0.2 + Math.sin(this.t * 2.4 + j) * 0.12
        const l = len * (1 - Math.abs(j) * 0.12)
        c.moveTo(x, y)
        c.quadraticCurveTo(
          x + Math.cos(back + j * 0.1) * l * 0.5,
          y + Math.sin(back + j * 0.1) * l * 0.5,
          x + Math.cos(a) * l,
          y + Math.sin(a) * l,
        )
      }
      c.stroke()
    }
  }

  private drawLegs(index: number, ang: number[], rad: number[], phase: number): void {
    const c = this.ctx
    const P = this.palette
    const { x, y } = this.chain[index]
    const fx = Math.cos(ang[index])
    const fy = Math.sin(ang[index])
    const r = rad[index]
    const len = r * 1.7

    for (const side of [-1, 1]) {
      const swing = Math.sin(this.t * 2.6 + phase + (side > 0 ? 0 : Math.PI)) * 0.5
      const nx = -fy * side
      const ny = fx * side
      const sx = x + nx * r * 0.7
      const sy = y + ny * r * 0.7
      const kx = sx + nx * len * 0.9 + fx * len * 0.45 * swing
      const ky = sy + ny * len * 0.9 + fy * len * 0.45 * swing
      const px = kx + nx * len * 0.45 - fx * len * 0.7
      const py = ky + ny * len * 0.45 - fy * len * 0.7

      c.strokeStyle = INK
      c.lineWidth = r * 0.6
      c.beginPath()
      c.moveTo(sx, sy)
      c.lineTo(kx, ky)
      c.lineTo(px, py)
      c.stroke()
      c.strokeStyle = rgba(P.accent, 0.5)
      c.lineWidth = 0.8
      c.stroke()

      // когти
      const heading = Math.atan2(py - ky, px - kx)
      c.strokeStyle = P.bright
      c.shadowColor = P.accent
      c.shadowBlur = 5
      c.lineWidth = 1.1
      c.beginPath()
      for (let k = -1; k <= 1; k++) {
        const a = heading + k * 0.55
        c.moveTo(px, py)
        c.lineTo(px + Math.cos(a) * r * 0.75, py + Math.sin(a) * r * 0.75)
      }
      c.stroke()
      c.shadowBlur = 0
    }
  }

  private drawMane(count: number, ang: number[], rad: number[]): void {
    const c = this.ctx
    for (let pass = 0; pass < 2; pass++) {
      c.strokeStyle = pass === 0 ? INK_DEEP : rgba(this.palette.accent, 0.5)
      c.lineWidth = pass === 0 ? this.radius * 0.3 : 0.8
      c.beginPath()
      for (let j = 0; j < count; j++) {
        const i = Math.min(this.chain.length - 1, 1 + Math.floor(j / 2))
        const side = j % 2 ? 1 : -1
        const fx = Math.cos(ang[i])
        const fy = Math.sin(ang[i])
        const nx = -fy * side
        const ny = fx * side
        const len = this.radius * (2.6 - i * 0.12)
        const wave = Math.sin(this.t * 2.2 + j) * this.radius * 0.4
        const sx = this.chain[i].x + nx * rad[i] * 0.7
        const sy = this.chain[i].y + ny * rad[i] * 0.7
        c.moveTo(sx, sy)
        c.quadraticCurveTo(
          sx - fx * len * 0.4 + nx * (len * 0.55 + wave),
          sy - fy * len * 0.4 + ny * (len * 0.55 + wave),
          sx - fx * len + nx * (len * 0.4 - wave),
          sy - fy * len + ny * (len * 0.4 - wave),
        )
      }
      c.stroke()
    }
  }

  /** Голова — вид сверху, нарисована для радиуса тела 10 и смотрит вдоль +x. */
  private drawHead(look: Look, angle: number): void {
    const c = this.ctx
    const P = this.palette
    const s = (this.radius / 10) * 1.3
    c.save()
    c.translate(this.chain[0].x, this.chain[0].y)
    c.rotate(angle)
    c.scale(s, s)

    if (look.horns) {
      const long = look.horns === 1 ? 12 : look.horns === 2 ? 19 : 25
      c.shadowColor = P.accent
      c.shadowBlur = 5
      for (const side of [-1, 1]) {
        c.strokeStyle = '#2b2733'
        c.lineWidth = 2.6
        c.beginPath()
        c.moveTo(-3, 5 * side)
        c.quadraticCurveTo(-3 - long * 0.5, 13 * side, -3 - long, 9 * side)
        if (look.horns >= 2) {
          c.moveTo(-3 - long * 0.45, 10.6 * side)
          c.lineTo(-3 - long * 0.75, 17 * side)
        }
        if (look.horns >= 3) {
          c.moveTo(-3 - long * 0.72, 10.6 * side)
          c.lineTo(-3 - long * 1.02, 15.5 * side)
        }
        c.stroke()
        c.strokeStyle = rgba(P.bright, 0.7)
        c.lineWidth = 0.6
        c.stroke()
      }
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
        c.moveTo(13, 3.5 * side)
        c.bezierCurveTo(22, (9 + wave) * side, 14 - len * 0.5, (17 + wave) * side, 8 - len, (13 - wave) * side)
      }
      c.stroke()
      c.shadowBlur = 0
    }

    const skull = new Path2D()
    skull.moveTo(17, 0)
    skull.quadraticCurveTo(16.5, 3.4, 13, 3.8)
    skull.quadraticCurveTo(9, 3.6, 6, 6)
    skull.quadraticCurveTo(2, 8.8, -4, 8.6)
    if (look.legs) skull.lineTo(-9.5, 11.5)
    skull.quadraticCurveTo(-7, 4, -6.5, 0)
    skull.quadraticCurveTo(-7, -4, look.legs ? -9.5 : -4, look.legs ? -11.5 : -8.6)
    if (look.legs) skull.lineTo(-4, -8.6)
    skull.quadraticCurveTo(2, -8.8, 6, -6)
    skull.quadraticCurveTo(9, -3.6, 13, -3.8)
    skull.quadraticCurveTo(16.5, -3.4, 17, 0)
    c.fillStyle = INK
    c.fill(skull)
    c.shadowColor = P.accent
    c.shadowBlur = 8
    c.strokeStyle = rgba(P.accent, 0.7)
    c.lineWidth = 0.9
    c.stroke(skull)
    c.shadowBlur = 0

    // гребень по переносице и надбровные дуги
    c.strokeStyle = 'rgba(255,255,255,0.16)'
    c.lineWidth = 0.7
    c.beginPath()
    c.moveTo(15, 0)
    c.lineTo(-5, 0)
    c.moveTo(9, 2.6)
    c.quadraticCurveTo(5, 3.2, 1.5, 6.6)
    c.moveTo(9, -2.6)
    c.quadraticCurveTo(5, -3.2, 1.5, -6.6)
    c.stroke()

    if (look.fangs) {
      c.fillStyle = '#e9e2d4'
      for (const side of [-1, 1]) {
        c.beginPath()
        c.moveTo(12, 3.6 * side)
        c.lineTo(10.4, 6.4 * side)
        c.lineTo(9.6, 3.6 * side)
        c.fill()
      }
    }

    c.fillStyle = rgba(P.accent, 0.9)
    c.beginPath()
    c.arc(14.6, 1.5, 0.6, 0, Math.PI * 2)
    c.arc(14.6, -1.5, 0.6, 0, Math.PI * 2)
    c.fill()

    // глаза — самое яркое место всей фигуры
    c.shadowColor = P.bright
    c.shadowBlur = 12
    for (const side of [-1, 1]) {
      c.fillStyle = P.bright
      c.beginPath()
      c.ellipse(4.6, 4.9 * side, 2.5, 1.25, 0.5 * side, 0, Math.PI * 2)
      c.fill()
    }
    c.shadowBlur = 0
    c.fillStyle = INK_DEEP
    for (const side of [-1, 1]) {
      c.beginPath()
      c.ellipse(4.9, 4.9 * side, 0.45, 1.15, 0.5 * side, 0, Math.PI * 2)
      c.fill()
    }

    if (look.mark) {
      c.shadowColor = P.bright
      c.shadowBlur = 10
      c.fillStyle = P.bright
      c.beginPath()
      c.moveTo(1.5, 0)
      c.lineTo(-0.5, 1.5)
      c.lineTo(-2.5, 0)
      c.lineTo(-0.5, -1.5)
      c.closePath()
      c.fill()
      c.shadowBlur = 0
    }
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
