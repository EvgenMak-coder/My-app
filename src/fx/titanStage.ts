import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  DoubleSide,
  Fog,
  Group,
  HemisphereLight,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  PointLight,
  Scene,
  SpotLight,
  TorusGeometry,
  Vector2,
  WebGLRenderer,
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { Material } from '../game/titans'
import { buildStatue, isSculpted, type StatueMaterials } from './statues'
import { prefersReducedMotion } from './util'

type MaterialKey = Material['key']

interface Cast {
  color: number
  accent: number
  metalness: number
  roughness: number
  glow: number
  /** фактура: 0 — дерево, 1 — металл, 2 — нефрит */
  kind: number
  /** чем затянуты потёртые места металла и насколько сильно (0…1) */
  patina: number
  patinaMix: number
  /** высота рельефа поверхности */
  relief: number
}

/** Из чего отлита статуэтка: основной тон, тёмный тон для ткани и оружия, блеск и фактура. */
const CAST: Record<MaterialKey, Cast> = {
  wood: { color: 0xb07a45, accent: 0x633e20, metalness: 0, roughness: 0.68, glow: 0, kind: 0, patina: 0, patinaMix: 0, relief: 0.006 },
  // бронза с зеленоватой патиной в углублениях
  bronze: { color: 0xc8843f, accent: 0x7a4a1f, metalness: 1, roughness: 0.36, glow: 0, kind: 1, patina: 0x2f5d4c, patinaMix: 0.36, relief: 0.004 },
  // серебро темнеет, но не зеленеет
  silver: { color: 0xe3e7ee, accent: 0x8a939e, metalness: 1, roughness: 0.26, glow: 0, kind: 1, patina: 0x2c2f36, patinaMix: 0.4, relief: 0.003 },
  gold: { color: 0xfacb55, accent: 0xb47d18, metalness: 1, roughness: 0.24, glow: 0, kind: 1, patina: 0x6e4a10, patinaMix: 0.35, relief: 0.0025 },
  // нефрит не металл: гладкий камень с облачными прожилками, слегка светится изнутри
  jade: { color: 0x49c690, accent: 0x1f7558, metalness: 0.1, roughness: 0.16, glow: 0x0b3a28, kind: 2, patina: 0, patinaMix: 0, relief: 0 },
}

interface SurfaceUniforms {
  uKind: { value: number }
  uPatina: { value: Color }
  uPatinaMix: { value: number }
  uRelief: { value: number }
}

const SURFACE_DECLARE = /* glsl */ `
uniform float uKind;
uniform vec3 uPatina;
uniform float uPatinaMix;
uniform float uRelief;
varying vec3 vObj;

float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i), hash31(i + vec3(1, 0, 0)), f.x), mix(hash31(i + vec3(0, 1, 0)), hash31(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash31(i + vec3(0, 0, 1)), hash31(i + vec3(1, 0, 1)), f.x), mix(hash31(i + vec3(0, 1, 1)), hash31(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}

float fbm(vec3 p) {
  float amount = 0.5;
  float sum = 0.0;
  for (int i = 0; i < 3; i++) {
    sum += amount * vnoise(p);
    p = p * 2.03 + 7.1;
    amount *= 0.5;
  }
  return sum / 0.875;
}

// x — узор цвета (0…1), y — высота рельефа (0…1)
vec2 surfacePattern(vec3 p) {
  if (uKind < 0.5) {
    // дерево: годовые кольца, вытянутые вдоль фигуры, и мелкое волокно
    float warp = fbm(vec3(p.x * 4.0, p.y * 1.1, p.z * 4.0));
    float rings = 0.5 + 0.5 * sin((p.x * 7.0 + p.z * 5.0 + warp * 4.5) * 6.2831);
    float fibre = vnoise(vec3(p.x * 34.0, p.y * 4.0, p.z * 34.0));
    return vec2(mix(rings, fibre, 0.35), rings * 0.55 + fibre * 0.45);
  }
  if (uKind < 1.5) {
    // металл: крупные потёртости и мелкая чеканка
    return vec2(fbm(p * 5.5), fbm(p * 15.0));
  }
  // нефрит: облака и тёмные прожилки
  float cloud = fbm(p * 3.0);
  float vein = pow(1.0 - abs(sin(p.y * 4.5 + p.x * 2.0 + cloud * 7.0)), 6.0);
  return vec2(clamp(cloud - vein * 0.45, 0.0, 1.0), 0.0);
}
`

/** Фактура материала прямо в шейдере: без картинок-текстур, узор считается по положению точки на фигуре. */
function surface(material: MeshStandardMaterial): SurfaceUniforms {
  const uniforms: SurfaceUniforms = {
    uKind: { value: 1 },
    uPatina: { value: new Color(0) },
    uPatinaMix: { value: 0 },
    uRelief: { value: 0 },
  }
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${SURFACE_DECLARE}`)
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        vec2 sp = surfacePattern(vObj);
        // цвет вершины несёт тень складок: там же, в углублениях, собирается патина
        float cavity = 1.0;
        #ifdef USE_COLOR
          cavity = smoothstep(0.3, 0.9, vColor.r);
        #endif
        float worn = smoothstep(0.24, 0.6, sp.x) * mix(0.25, 1.0, cavity);
        if (uKind < 0.5) diffuseColor.rgb *= mix(0.6, 1.14, sp.x);
        else if (uKind < 1.5) diffuseColor.rgb = mix(mix(diffuseColor.rgb * 0.55, uPatina, uPatinaMix), diffuseColor.rgb * 1.05, worn);
        else diffuseColor.rgb *= mix(0.62, 1.32, sp.x);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `#include <roughnessmap_fragment>
        if (uKind < 0.5) roughnessFactor = clamp(roughnessFactor + (0.5 - sp.x) * 0.3, 0.05, 1.0);
        else if (uKind < 1.5) roughnessFactor = clamp(roughnessFactor + (1.0 - worn) * 0.4, 0.05, 1.0);`,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        /* glsl */ `#include <metalnessmap_fragment>
        if (uKind > 0.5 && uKind < 1.5) metalnessFactor *= mix(1.0 - uPatinaMix * 0.7, 1.0, worn);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `#include <normal_fragment_maps>
        if (uRelief > 0.0) {
          // рельеф поверхности: наклоняем нормаль по перепаду высоты узора
          float height = sp.y * uRelief;
          vec3 sigmaX = dFdx(-vViewPosition);
          vec3 sigmaY = dFdy(-vViewPosition);
          vec3 r1 = cross(sigmaY, normal);
          vec3 r2 = cross(normal, sigmaX);
          float det = dot(sigmaX, r1) * faceDirection;
          vec3 grad = sign(det) * (dFdx(height) * r1 + dFdy(height) * r2);
          normal = normalize(abs(det) * normal - grad);
        }`,
      )
  }
  return uniforms
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
  surfaces: SurfaceUniforms[]
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
  /** отложенная лепка остальных статуэток */
  private pending: ReturnType<typeof setTimeout>[] = []
  private still = prefersReducedMotion()

  /** сколько кадров подряд рисовалось медленно — повод снизить чёткость */
  private slow = 0
  private frame = 0

  constructor(
    readonly canvas: HTMLCanvasElement,
    public onIndex: (index: number) => void,
    accent: string,
  ) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true })
    // на телефоне с тройной плотностью экрана полная чёткость стоит слишком дорого
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.15
    // тени от собственных деталей — без них складки и доспех выглядят плоско
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFSoftShadowMap
    // тени пересчитываются через кадр: глаз разницы не видит, а работы вдвое меньше
    this.renderer.shadowMap.autoUpdate = false

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
    // холодный заполняющий свет слева: лепит форму с теневой стороны
    const fill = new DirectionalLight(0x9db8ff, 0.7)
    fill.position.set(-3.5, 2.6, 4)
    this.scene.add(fill)
    const key = new SpotLight(0xfff1dd, 70, 14, 0.42, 0.6, 1.4)
    key.position.set(1.6, 4.4, 5)
    key.target.position.set(0, 1, RADIUS)
    key.castShadow = true
    key.shadow.mapSize.set(768, 768)
    key.shadow.camera.near = 2
    key.shadow.camera.far = 12
    key.shadow.bias = -0.0008
    key.shadow.normalBias = 0.015
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
    const stone = new MeshStandardMaterial({ color: 0x1b1820, roughness: 0.8, metalness: 0.2 })
    // постамент: ступень с фаской и валиком
    const plinth = new LatheGeometry(
      [[0.001, 0], [0.6, 0], [0.61, 0.025], [0.56, 0.05], [0.56, 0.065], [0.52, 0.085], [0.5, 0.1], [0.001, 0.1]].map(([r, y]) => new Vector2(r, y)),
      40,
    )
    const step = (Math.PI * 2) / Math.max(1, specs.length)
    specs.forEach((spec, i) => {
      // двусторонние: плащи и складки ткани — тонкие поверхности, их видно с изнанки
      const materials: StatueMaterials = {
        main: new MeshStandardMaterial({ side: DoubleSide, vertexColors: true }),
        accent: new MeshStandardMaterial({ side: DoubleSide, vertexColors: true }),
      }
      const ring = new MeshStandardMaterial({ color: 0x000000, emissive: this.rim.color, emissiveIntensity: 0 })
      const holder = new Group()
      holder.position.set(Math.sin(i * step) * RADIUS, 0, Math.cos(i * step) * RADIUS)
      holder.rotation.y = i * step
      const base = new Mesh(plinth, stone)
      base.receiveShadow = true
      const glow = new Mesh(new TorusGeometry(0.5, 0.012, 6, 40), ring)
      glow.rotation.x = Math.PI / 2
      glow.position.y = 0.1
      const turn = new Group()
      turn.position.y = 0.1
      // лепка одной фигуры занимает заметное время: выбранную лепим сразу, остальные — по очереди,
      // чтобы страница не замирала при входе
      const sculpt = () => {
        turn.add(buildStatue(spec.key, materials))
        this.render()
      }
      // обычно всё вылеплено заранее, при входе в приложение; иначе выбранную лепим сразу, остальные по очереди
      const order = (i - this.index + specs.length) % specs.length
      if (order === 0 || isSculpted(spec.key)) sculpt()
      else this.pending.push(setTimeout(sculpt, 60 + order * 90))
      holder.add(base, glow, turn)
      this.ring.add(holder)
      this.slots.push({ key: spec.key, holder, turn, materials, surfaces: [surface(materials.main), surface(materials.accent)], ring, spin: 0, size: SIDE_SIZE })
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
    for (const u of slot.surfaces) {
      u.uKind.value = c.kind
      u.uPatina.value.setHex(c.patina)
      u.uPatinaMix.value = c.patinaMix
      u.uRelief.value = c.relief
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
    // повторный запуск не должен плодить второй цикл
    cancelAnimationFrame(this.raf)
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.tick)
  }

  /** Остановить отрисовку, пока витрину не видно. */
  stop(): void {
    cancelAnimationFrame(this.raf)
  }

  private tick = (now: number): void => {
    const elapsed = (now - this.last) / 1000
    const dt = Math.min(0.05, elapsed)
    this.last = now
    this.update(dt)
    this.renderer.shadowMap.needsUpdate = this.frame++ % 2 === 0
    this.renderer.render(this.scene, this.camera)
    // если телефон не успевает (меньше ~40 кадров в секунду полсекунды подряд) — рисуем менее чётко
    this.slow = elapsed > 0.025 ? this.slow + 1 : 0
    if (this.slow > 30 && this.renderer.getPixelRatio() > 1) {
      this.renderer.setPixelRatio(1)
      this.resize()
      this.slow = 0
    }
    this.raf = requestAnimationFrame(this.tick)
  }

  /** Один кадр без анимации: круг и статуэтки сразу встают на места. */
  private render(): void {
    if (this.still) this.update(10)
    this.renderer.shadowMap.needsUpdate = true
    this.renderer.render(this.scene, this.camera)
  }

  /** Собрать шейдеры и один раз нарисовать сцену заранее, чтобы первое открытие витрины было мгновенным. */
  warm(): void {
    this.renderer.setSize(64, 64, false)
    this.renderer.compile(this.scene, this.camera)
    this.render()
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
    for (const timer of this.pending) clearTimeout(timer)
    this.pending = []
    this.ring.traverse((object) => {
      if (object instanceof Mesh) {
        if (!object.userData.keep) object.geometry.dispose()
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

let shared: TitanStage | null = null

/**
 * Одна витрина на всё приложение. Она живёт вместе со своим холстом и не пересоздаётся при переходах
 * между разделами: страница «Тренировки» просто вставляет этот холст к себе.
 * Бросает ошибку, если на устройстве нет WebGL.
 */
export function sharedStage(): TitanStage {
  if (!shared) shared = new TitanStage(document.createElement('canvas'), () => {}, '#ff7a1a')
  return shared
}
