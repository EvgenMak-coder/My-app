import {
  ACESFilmicToneMapping,
  Color,
  CylinderGeometry,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PMREMGenerator,
  PointLight,
  Scene,
  SpotLight,
  TorusGeometry,
  WebGLRenderer,
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { Material } from '../game/titans'
import { buildStatue, type StatueMaterials } from './statues'
import { prefersReducedMotion } from './util'

type MaterialKey = Material['key']

/** Из чего отлита статуэтка: основной тон, тёмный тон для ткани и оружия, блеск. */
const CAST: Record<MaterialKey, { color: number; accent: number; metalness: number; roughness: number; glow: number }> = {
  wood: { color: 0x9a6a3e, accent: 0x5a3a20, metalness: 0, roughness: 0.78, glow: 0 },
  bronze: { color: 0xb87a3d, accent: 0x6e4722, metalness: 1, roughness: 0.42, glow: 0 },
  silver: { color: 0xd5dae2, accent: 0x7e8791, metalness: 1, roughness: 0.3, glow: 0 },
  gold: { color: 0xf5c451, accent: 0xa87418, metalness: 1, roughness: 0.26, glow: 0 },
  // нефрит не металл: гладкий камень, слегка светится изнутри
  jade: { color: 0x45c08a, accent: 0x1d6e52, metalness: 0.15, roughness: 0.2, glow: 0x0b3a28 },
}

export interface StatueSpec {
  key: string
  material: MaterialKey
}

interface Slot {
  key: string
  holder: Group
  turn: Group
  materials: StatueMaterials
  ring: MeshStandardMaterial
  spin: number
  size: number
}

const RADIUS = 1.5
const FRONT_SIZE = 1.06
const SIDE_SIZE = 0.9

/**
 * Витрина титанов: статуэтки стоят по кругу, круг листается вправо и влево.
 * Ближняя к зрителю статуэтка — выбранная: она освещена, крупнее и медленно поворачивается.
 */
export class TitanStage {
  private renderer: WebGLRenderer
  private scene = new Scene()
  private camera = new PerspectiveCamera(32, 1, 0.1, 40)
  private ring = new Group()
  private rim: PointLight
  private slots: Slot[] = []
  private raf = 0
  private last = 0
  /** на сколько шагов повёрнут круг; может уходить за пределы 0…n−1, чтобы листание шло по кратчайшему пути */
  private place = 0
  private angle = 0
  private drag: { id: number; x: number; shift: number } | null = null
  private still = prefersReducedMotion()

  constructor(
    private canvas: HTMLCanvasElement,
    private onIndex: (index: number) => void,
    accent: string,
  ) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.15

    // отражения для металла: без окружения бронза и золото выглядят чёрными
    const pmrem = new PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environmentIntensity = 0.55
    pmrem.dispose()
    // дальние статуэтки тонут в темноте
    this.scene.fog = new Fog(0x050407, 4.6, 8.4)

    this.camera.position.set(0, 1.5, 5.7)
    this.camera.lookAt(0, 1.12, 0)

    this.scene.add(new HemisphereLight(0x8fa0b8, 0x120d0a, 0.5))
    const key = new SpotLight(0xfff1dd, 70, 14, 0.42, 0.6, 1.4)
    key.position.set(1.6, 4.4, 5)
    key.target.position.set(0, 1, RADIUS)
    this.scene.add(key, key.target)
    // контровой свет цветом стихии — из центра круга, в спину выбранной статуэтке
    this.rim = new PointLight(new Color(accent), 22, 9, 1.6)
    this.rim.position.set(0, 2.1, -0.3)
    this.scene.add(this.rim)
    this.scene.add(this.ring)

    canvas.addEventListener('pointerdown', this.onDown)
    canvas.addEventListener('pointermove', this.onMove)
    canvas.addEventListener('pointerup', this.onUp)
    canvas.addEventListener('pointercancel', this.onUp)
  }

  private get step(): number {
    return (Math.PI * 2) / Math.max(1, this.slots.length)
  }

  get index(): number {
    const n = this.slots.length || 1
    return ((this.place % n) + n) % n
  }

  /** Состав и материалы статуэток. Фигуры строятся один раз, дальше меняется только материал. */
  setStatues(specs: StatueSpec[]): void {
    const same = specs.length === this.slots.length && specs.every((s, i) => s.key === this.slots[i].key)
    if (!same) this.build(specs)
    specs.forEach((spec, i) => this.cast(this.slots[i], spec.material))
    this.render()
  }

  private build(specs: StatueSpec[]): void {
    this.clear()
    const stone = new MeshStandardMaterial({ color: 0x15131a, roughness: 0.9, metalness: 0.1, flatShading: true })
    const step = (Math.PI * 2) / Math.max(1, specs.length)
    specs.forEach((spec, i) => {
      const materials: StatueMaterials = {
        main: new MeshStandardMaterial({ flatShading: true }),
        accent: new MeshStandardMaterial({ flatShading: true }),
      }
      const ring = new MeshStandardMaterial({ color: 0x000000, emissive: this.rim.color, emissiveIntensity: 0 })
      const holder = new Group()
      holder.position.set(Math.sin(i * step) * RADIUS, 0, Math.cos(i * step) * RADIUS)
      holder.rotation.y = i * step
      const base = new Mesh(new CylinderGeometry(0.5, 0.56, 0.1, 24), stone)
      base.position.y = 0.05
      const glow = new Mesh(new TorusGeometry(0.5, 0.012, 6, 40), ring)
      glow.rotation.x = Math.PI / 2
      glow.position.y = 0.1
      const turn = new Group()
      turn.position.y = 0.1
      turn.add(buildStatue(spec.key, materials))
      holder.add(base, glow, turn)
      this.ring.add(holder)
      this.slots.push({ key: spec.key, holder, turn, materials, ring, spin: 0, size: SIDE_SIZE })
    })
    this.angle = -this.place * this.step
  }

  private cast(slot: Slot, material: MaterialKey): void {
    const c = CAST[material]
    slot.materials.main.color.setHex(c.color)
    slot.materials.accent.color.setHex(c.accent)
    for (const m of [slot.materials.main, slot.materials.accent]) {
      m.metalness = c.metalness
      m.roughness = c.roughness
      m.emissive.setHex(c.glow)
    }
  }

  /** Цвет стихии — для контрового света и светящихся колец на постаментах. */
  setAccent(accent: string): void {
    this.rim.color.set(accent)
    for (const slot of this.slots) slot.ring.emissive.set(accent)
    this.render()
  }

  /** Повернуть круг к статуэтке с этим номером — кратчайшим путём. */
  setIndex(index: number): void {
    const n = this.slots.length
    if (!n || index === this.index) return
    let delta = index - this.index
    if (delta > n / 2) delta -= n
    if (delta < -n / 2) delta += n
    this.place += delta
    if (this.still) this.render()
  }

  private move(delta: number): void {
    this.place += delta
    this.onIndex(this.index)
    if (this.still) this.render()
  }

  resize(): void {
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    if (!width || !height) return
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    // на узком экране отходим назад, чтобы выбранная статуэтка помещалась целиком с оружием
    this.camera.position.z = width / height < 0.95 ? 6.3 : 5.7
    this.camera.updateProjectionMatrix()
    this.render()
  }

  start(): void {
    this.resize()
    if (this.still) return
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.tick)
  }

  private tick = (now: number): void => {
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    this.update(dt)
    this.renderer.render(this.scene, this.camera)
    this.raf = requestAnimationFrame(this.tick)
  }

  /** Один кадр без анимации: круг и статуэтки сразу встают на места. */
  private render(): void {
    if (this.still) this.update(10)
    this.renderer.render(this.scene, this.camera)
  }

  private update(dt: number): void {
    const ease = 1 - Math.exp(-dt * 7)
    const target = -this.place * this.step
    this.angle += (target - this.angle) * ease
    this.ring.rotation.y = this.angle + (this.drag?.shift ?? 0)

    const front = this.index
    this.slots.forEach((slot, i) => {
      const chosen = i === front && !this.drag
      // выбранная медленно вращается, остальные возвращаются лицом наружу
      if (chosen && !this.still) slot.spin += dt * 0.55
      else {
        const rest = Math.round(slot.spin / (Math.PI * 2)) * Math.PI * 2
        slot.spin += (rest - slot.spin) * ease
      }
      slot.turn.rotation.y = slot.spin
      slot.size += ((i === front ? FRONT_SIZE : SIDE_SIZE) - slot.size) * ease
      slot.turn.scale.setScalar(slot.size)
      slot.ring.emissiveIntensity += ((i === front ? 2.4 : 0) - slot.ring.emissiveIntensity) * ease
    })
  }

  private onDown = (e: PointerEvent): void => {
    this.drag = { id: e.pointerId, x: e.clientX, shift: 0 }
    this.canvas.setPointerCapture(e.pointerId)
  }

  private onMove = (e: PointerEvent): void => {
    if (!this.drag || e.pointerId !== this.drag.id) return
    // палец тащит круг: вправо — статуэтки едут вправо
    this.drag.shift = ((e.clientX - this.drag.x) / Math.max(1, this.canvas.clientWidth)) * 1.9
    if (this.still) this.render()
  }

  private onUp = (e: PointerEvent): void => {
    if (!this.drag || e.pointerId !== this.drag.id) return
    const moved = e.clientX - this.drag.x
    const shift = this.drag.shift
    this.drag = null
    if (Math.abs(moved) < 8) {
      // короткое касание: по левому краю — предыдущая, по правому — следующая
      const box = this.canvas.getBoundingClientRect()
      const where = (e.clientX - box.left) / Math.max(1, box.width)
      if (where < 0.3) this.move(-1)
      else if (where > 0.7) this.move(1)
      return
    }
    // круг остаётся там, куда его дотянули, и доворачивается до ближайшей статуэтки
    this.angle += shift
    const steps = Math.round(-this.angle / this.step) - this.place
    this.move(steps !== 0 ? steps : moved < -40 ? 1 : moved > 40 ? -1 : 0)
  }

  /** Листать на шаг: 1 — следующая, −1 — предыдущая. */
  shift(direction: 1 | -1): void {
    this.move(direction)
  }

  private clear(): void {
    this.ring.traverse((object) => {
      if (object instanceof Mesh) {
        object.geometry.dispose()
        const material = object.material as MeshStandardMaterial | MeshStandardMaterial[]
        for (const m of Array.isArray(material) ? material : [material]) m.dispose()
      }
    })
    this.ring.clear()
    this.slots = []
  }

  dispose(): void {
    cancelAnimationFrame(this.raf)
    this.canvas.removeEventListener('pointerdown', this.onDown)
    this.canvas.removeEventListener('pointermove', this.onMove)
    this.canvas.removeEventListener('pointerup', this.onUp)
    this.canvas.removeEventListener('pointercancel', this.onUp)
    this.clear()
    this.scene.environment?.dispose()
    this.renderer.dispose()
  }
}
