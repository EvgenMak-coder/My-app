import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Shape,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  type Object3D,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Clay, openness } from './sculpt'

/**
 * Статуэтки титанов — фигуры, вылепленные кодом из тел вращения, складок ткани и выдавленных пластин.
 * Каждая отлита из одного материала в двух тонах: main — тело и доспех, accent — ткань, волосы, оружие.
 * Узнаётся фигура по силуэту: у каждой свой крупный признак (щит и гребень, секира, три меча, шляпа и плащ).
 * После сборки все детали сплавляются в две сетки (по одной на тон) — так телефону легче их рисовать.
 */
export interface StatueMaterials {
  main: MeshStandardMaterial
  accent: MeshStandardMaterial
}

type V3 = [number, number, number]

const RAD = Math.PI / 180
const TURN = Math.PI * 2

const ball = (radius: number): SphereGeometry => new SphereGeometry(radius, 18, 12)
const box = (w: number, h: number, d: number): BoxGeometry => new BoxGeometry(w, h, d)
const tube = (top: number, bottom: number, height: number, sides = 12): CylinderGeometry =>
  new CylinderGeometry(top, bottom, height, sides)

/** Тело вращения по профилю: пары «радиус, высота» снизу вверх. */
function lathe(profile: [number, number][], sides = 22): LatheGeometry {
  return new LatheGeometry(
    profile.map(([r, y]) => new Vector2(Math.max(r, 0.0005), y)),
    sides,
  )
}

/** Конечность: свисает вниз от сустава, радиусы заданы через равные промежутки — так получаются мышцы. */
function limb(radii: number[], length: number): LatheGeometry {
  const last = radii.length - 1
  // профиль идёт снизу вверх, от кисти к плечу
  return lathe(radii.map((r, i): [number, number] => [r, -(length * i) / last]).reverse(), 16)
}

/**
 * Ткань: воронка от верхнего края вниз, с вертикальными складками, которые расходятся к подолу.
 * arc меньше полного круга даёт плащ; from — где складки начинаются (0 — спереди, π — со спины).
 */
function drape(
  top: number,
  bottom: number,
  height: number,
  o: { arc?: number; from?: number; folds?: number; depth?: number } = {},
): BufferGeometry {
  const arc = o.arc ?? TURN
  const from = o.from ?? 0
  const folds = o.folds ?? 8
  const depth = o.depth ?? 0.07
  const rows = 7
  const cols = Math.max(8, Math.round((folds * 5 * arc) / TURN))
  const positions: number[] = []
  const indices: number[] = []
  for (let row = 0; row <= rows; row++) {
    const v = row / rows
    const radius = top + (bottom - top) * Math.pow(v, 0.85)
    for (let col = 0; col <= cols; col++) {
      const a = from + (arc * col) / cols
      const r = radius * (1 + depth * v * Math.sin(a * folds))
      positions.push(Math.sin(a) * r, -height * v, Math.cos(a) * r)
    }
  }
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const a = row * (cols + 1) + col
      const b = a + cols + 1
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/** Пластина по контуру (x, y) заданной толщины, с серединой в плоскости z = 0. */
function plate(points: [number, number][], thickness: number): ExtrudeGeometry {
  const shape = new Shape()
  points.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)))
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false })
  geometry.translate(0, 0, -thickness / 2)
  return geometry
}

/** Клинок вдоль +x: curve — насколько он выгнут, как у катаны; остриё сведено к обуху. */
function bladeShape(length: number, width: number, curve: number): [number, number][] {
  const steps = 10
  const bow = (t: number): number => curve * 4 * t * (1 - t)
  const edge: [number, number][] = []
  const spine: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    edge.push([length * t, -width / 2 + bow(t)])
    // последние 8% длины — скос к острию
    if (t <= 0.92) spine.push([length * t, width / 2 + bow(t)])
  }
  return [...edge, ...spine.reverse()]
}

function add(
  parent: Object3D,
  geometry: BufferGeometry,
  material: MeshStandardMaterial,
  at: V3 = [0, 0, 0],
  turn: V3 = [0, 0, 0],
  scale: V3 = [1, 1, 1],
): Mesh {
  const mesh = new Mesh(geometry, material)
  mesh.position.set(...at)
  mesh.rotation.set(turn[0] * RAD, turn[1] * RAD, turn[2] * RAD)
  mesh.scale.set(...scale)
  parent.add(mesh)
  return mesh
}

function joint(parent: Object3D, at: V3, turn: V3 = [0, 0, 0]): Group {
  const group = new Group()
  group.position.set(...at)
  group.rotation.set(turn[0] * RAD, turn[1] * RAD, turn[2] * RAD)
  parent.add(group)
  return group
}

/** Поворот сустава в градусах */
const pose = (g: Group, x: number, y = 0, z = 0): void => void g.rotation.set(x * RAD, y * RAD, z * RAD)

/** Одинаковые детали по полному кругу: build получает опору, повёрнутую на свой угол. */
function around(parent: Object3D, at: V3, count: number, build: (spoke: Group, i: number) => void, from = 0): void {
  for (let i = 0; i < count; i++) build(joint(parent, at, [0, from + (360 * i) / count, 0]), i)
}

interface Limb {
  root: Group
  mid: Group
  end: Group
}

interface Rig {
  root: Group
  hips: Group
  chest: Group
  head: Group
  /** левая рука и нога фигуры — со стороны +x (фигура смотрит на +z) */
  armL: Limb
  armR: Limb
  legL: Limb
  legR: Limb
  /** Что вылепить после того, как поза встала: волосы, бороду, одежду по фигуре */
  later: ((put: (geometry: BufferGeometry, tone: keyof StatueMaterials) => void) => void)[]
  /** множитель ширины: телосложение */
  b: number
}

/**
 * Скелет: таз, корпус, голова, руки и ноги на суставах. Рука и нога в покое висят вниз.
 * Само тело лепится позже, одним куском, по положению суставов (см. sculptBody).
 * Знаки поворотов: плечо и бедро x < 0 — вперёд; локоть x < 0 — сгиб вперёд; колено x > 0 — сгиб назад;
 * z > 0 отводит левую конечность в сторону, z < 0 — правую.
 */
function rig(m: StatueMaterials, b = 1): Rig {
  const root = new Group()
  const hips = joint(root, [0, 1.0, 0])
  const chest = joint(hips, [0, 0.12, 0])
  const head = joint(chest, [0, 0.64, 0])
  // зрачки тёмным тоном — в глазницах, которые вылепит sculptBody
  for (const side of [1, -1]) add(head, ball(0.0125), m.accent, [0.037 * side, 0.004, 0.089], [0, 0, 0], [1.1, 0.8, 0.8])

  const arm = (side: 1 | -1): Limb => {
    const shoulder = joint(chest, [0.225 * b * side, 0.4, 0])
    const elbow = joint(shoulder, [0, -0.3, 0])
    const hand = joint(elbow, [0, -0.27, 0])
    return { root: shoulder, mid: elbow, end: hand }
  }
  const leg = (side: 1 | -1): Limb => {
    const hip = joint(hips, [0.095 * b * side, -0.06, 0])
    const knee = joint(hip, [0, -0.45, 0])
    const ankle = joint(knee, [0, -0.4, 0])
    return { root: hip, mid: knee, end: ankle }
  }
  return { root, hips, chest, head, armL: arm(1), armR: arm(-1), legL: leg(1), legR: leg(-1), later: [], b }
}

/** Кусок «глины» вокруг перечисленных суставов — для волос, бороды и одежды по фигуре. */
function clayAround(joints: Object3D[], pad: number, cell: number): Clay {
  const bounds = new Box3()
  for (const g of joints) bounds.expandByPoint(new Vector3(...spot(g)))
  bounds.expandByScalar(pad)
  return new Clay(bounds.min, bounds.max, cell)
}

/** Точка сустава (или точка рядом с ним, в его координатах) в координатах статуэтки. */
const spot = (g: Object3D, local: V3 = [0, 0, 0]): V3 => new Vector3(...local).applyMatrix4(g.matrixWorld).toArray() as V3

/**
 * Лепит тело одним куском по готовой позе: мышцы и суставы плавно сливаются, швов между частями нет.
 * Голова лепится отдельно и мельче — на лице важны нос, скулы, глазницы и губы.
 */
function sculptBody(r: Rig): { clays: Clay[]; parts: BufferGeometry[] } {
  const b = r.b
  const bounds = new Box3()
  for (const g of [r.hips, r.chest, r.head, ...[r.armL, r.armR, r.legL, r.legR].flatMap((l) => [l.root, l.mid, l.end])]) {
    bounds.expandByPoint(new Vector3(...spot(g)))
  }
  bounds.expandByScalar(0.26)

  const body = new Clay(bounds.min, bounds.max, 0.019)
  const hips = r.hips.matrixWorld
  const chest = r.chest.matrixWorld
  // корпус: таз, талия, грудная клетка, грудные мышцы, спина
  body.add(hips, { kind: 'ball', at: [0, -0.01, 0], r: [0.168 * b, 0.14, 0.115 * b] })
  body.add(chest, { kind: 'ball', at: [0, 0.08, 0], r: [0.148 * b, 0.17, 0.1 * b] })
  body.add(chest, { kind: 'ball', at: [0, 0.29, 0], r: [0.2 * b, 0.2, 0.128 * b] })
  for (const side of [1, -1]) {
    body.add(chest, { kind: 'ball', at: [0.088 * b * side, 0.335, 0.075], r: [0.1 * b, 0.072, 0.06] }, 0.02)
    body.add(chest, { kind: 'ball', at: [0.1 * b * side, 0.3, -0.07], r: [0.11 * b, 0.16, 0.06] })
    body.add(hips, { kind: 'ball', at: [0.085 * b * side, -0.07, -0.07], r: [0.1 * b, 0.105, 0.09] })
  }
  // шея и трапеции
  body.add(null, { kind: 'bone', a: spot(r.chest, [0, 0.46, 0]), b: spot(r.head, [0, -0.06, 0]), ra: 0.06, rb: 0.052 })
  for (const arm of [r.armL, r.armR]) {
    body.add(null, { kind: 'bone', a: spot(r.chest, [0, 0.5, -0.01]), b: spot(arm.root, [0, 0.02, 0]), ra: 0.058, rb: 0.062 * b })
    body.add(arm.root.matrixWorld, { kind: 'ball', at: [0, 0, 0], r: 0.085 * b })
    body.add(null, { kind: 'bone', a: spot(arm.root), b: spot(arm.mid), ra: 0.066 * b, rb: 0.05 * b })
    body.add(arm.root.matrixWorld, { kind: 'ball', at: [0, -0.14, 0.014], r: [0.058 * b, 0.1, 0.06 * b] }, 0.02)
    body.add(null, { kind: 'bone', a: spot(arm.mid), b: spot(arm.end), ra: 0.05 * b, rb: 0.036 * b })
    body.add(arm.mid.matrixWorld, { kind: 'ball', at: [0, -0.08, 0.006], r: [0.05 * b, 0.09, 0.052 * b] }, 0.02)
    body.add(arm.end.matrixWorld, { kind: 'ball', at: [0, -0.045, 0], r: [0.04, 0.054, 0.035] }, 0.02)
  }
  for (const leg of [r.legL, r.legR]) {
    body.add(null, { kind: 'bone', a: spot(leg.root), b: spot(leg.mid), ra: 0.098 * b, rb: 0.066 * b })
    body.add(leg.root.matrixWorld, { kind: 'ball', at: [0, -0.2, 0.026], r: [0.085 * b, 0.18, 0.085 * b] })
    body.add(leg.mid.matrixWorld, { kind: 'ball', at: [0, 0, 0.02], r: 0.056 * b }, 0.02)
    body.add(null, { kind: 'bone', a: spot(leg.mid), b: spot(leg.end), ra: 0.06 * b, rb: 0.04 * b })
    body.add(leg.mid.matrixWorld, { kind: 'ball', at: [0, -0.13, -0.026], r: [0.058 * b, 0.12, 0.06 * b] }, 0.02)
    body.add(leg.end.matrixWorld, { kind: 'ball', at: [0, -0.04, 0.065], r: [0.05, 0.04, 0.12] }, 0.02)
    body.add(leg.end.matrixWorld, { kind: 'ball', at: [0, -0.03, -0.02], r: 0.045 }, 0.02)
  }

  const centre = new Vector3(...spot(r.head))
  const face = new Clay(centre.clone().subScalar(0.2), centre.clone().addScalar(0.2), 0.0075)
  const head = r.head.matrixWorld
  const k = 0.012
  face.add(head, { kind: 'ball', at: [0, 0.012, -0.008], r: [0.092, 0.116, 0.108] }, k)
  face.add(head, { kind: 'ball', at: [0, -0.058, 0.018], r: [0.074, 0.07, 0.078] }, 0.02)
  face.add(head, { kind: 'ball', at: [0, -0.105, 0.052], r: [0.036, 0.03, 0.034] }, 0.02)
  face.add(head, { kind: 'bone', a: [0, -0.07, -0.005], b: [0, -0.2, -0.02], ra: 0.054, rb: 0.056 }, 0.02)
  for (const side of [1, -1]) {
    face.add(head, { kind: 'ball', at: [0.052 * side, -0.022, 0.066], r: [0.03, 0.024, 0.03] }, k)
    face.add(head, { kind: 'ball', at: [0.097 * side, -0.004, -0.006], r: [0.012, 0.03, 0.02] }, 0.008)
    face.carve(head, { kind: 'ball', at: [0.038 * side, 0.004, 0.108], r: [0.022, 0.016, 0.02] }, 0.012)
  }
  face.add(head, { kind: 'bone', a: [-0.05, 0.03, 0.082], b: [0.05, 0.03, 0.082], ra: 0.016, rb: 0.016 }, k)
  face.add(head, { kind: 'bone', a: [0, 0.012, 0.097], b: [0, -0.036, 0.121], ra: 0.011, rb: 0.016 }, 0.01)
  face.add(head, { kind: 'ball', at: [0, -0.041, 0.121], r: [0.019, 0.014, 0.015] }, 0.008)
  face.add(head, { kind: 'bone', a: [-0.02, -0.071, 0.093], b: [0.02, -0.071, 0.093], ra: 0.01, rb: 0.01 }, 0.008)
  face.carve(head, { kind: 'bone', a: [-0.022, -0.072, 0.106], b: [0.022, -0.072, 0.106], ra: 0.003, rb: 0.003 }, 0.004)

  return { clays: [body, face], parts: [body.build(), face.build()] }
}

/**
 * Ставит фигуру на землю, лепит тело, затеняет складки и сплавляет все детали в две сетки —
 * по одной на тон материала.
 */
function finish(r: Rig, m: StatueMaterials, size = 1): Group {
  r.root.updateMatrixWorld(true)
  // подошвы: пятка и носок каждой стопы
  let lowest = Infinity
  for (const leg of [r.legL, r.legR]) {
    for (const z of [-0.04, 0.16]) lowest = Math.min(lowest, spot(leg.end, [0, -0.078, z])[1])
  }
  r.root.position.y -= lowest
  r.root.scale.setScalar(size)
  r.root.updateMatrixWorld(true)

  const { clays, parts: flesh } = sculptBody(r)
  const sculpted: Record<keyof StatueMaterials, BufferGeometry[]> = { main: [...flesh], accent: [] }
  for (const shape of r.later) shape((geometry, tone) => sculpted[tone].push(geometry))
  const statue = new Group()
  for (const material of [m.main, m.accent]) {
    const parts: BufferGeometry[] = material === m.main ? sculpted.main : sculpted.accent
    r.root.traverse((object) => {
      if (!(object instanceof Mesh) || object.material !== material) return
      const part: BufferGeometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone()
      part.applyMatrix4(object.matrixWorld)
      for (const name of Object.keys(part.attributes)) {
        if (name !== 'position' && name !== 'normal') part.deleteAttribute(name)
      }
      parts.push(part)
      object.geometry.dispose()
    })
    if (!parts.length) continue
    const merged = mergeGeometries(parts)
    for (const part of parts) part.dispose()

    // тень в складках: чем сильнее точка зажата телом, тем темнее её цвет
    const position = merged.getAttribute('position')
    const normal = merged.getAttribute('normal')
    const shade = new Float32Array(position.count * 3)
    for (let i = 0; i < position.count; i++) {
      const open = openness(clays, position.getX(i), position.getY(i), position.getZ(i), normal.getX(i), normal.getY(i), normal.getZ(i))
      shade.fill(0.3 + 0.7 * open, i * 3, i * 3 + 3)
    }
    merged.setAttribute('color', new Float32BufferAttribute(shade, 3))

    const cast = new Mesh(merged, material)
    cast.castShadow = true
    cast.receiveShadow = true
    statue.add(cast)
  }
  return statue
}

/** Меч в кулаке, клинок вдоль +z: полоса, гарда, оплетённая рукоять с навершием. */
function sword(hand: Object3D, m: StatueMaterials, length: number, turn: V3, curve = 0.035): Group {
  const g = joint(hand, [0, -0.05, 0], turn)
  add(g, plate(bladeShape(length, 0.034, length * curve), 0.009), m.accent, [0, 0, 0.05], [0, -90, 0])
  add(g, tube(0.046, 0.046, 0.012, 10), m.main, [0, 0, 0.045], [90, 0, 0])
  add(g, tube(0.017, 0.015, 0.22, 8), m.accent, [0, 0, -0.07], [90, 0, 0])
  for (let i = 0; i < 4; i++) add(g, new TorusGeometry(0.018, 0.005, 4, 8), m.main, [0, 0, -0.02 - i * 0.045])
  add(g, ball(0.02), m.main, [0, 0, -0.185])
  return g
}

/** Спартанец-гоплит: коринфский шлем с поперечным гребнем, круглый щит, копьё хватом сверху. */
function spartan(m: StatueMaterials): Group {
  const r = rig(m, 1.12)
  const b = r.b
  pose(r.legL.root, -18, 0, 4)
  pose(r.legL.mid, 14)
  pose(r.legR.root, 14, 0, -6)
  pose(r.legR.mid, 6)
  pose(r.chest, 0, 14, 0)
  pose(r.armL.root, -22, 0, 28)
  pose(r.armL.mid, -70)
  // правая рука занесена: плечо в сторону и вверх, предплечье вертикально
  pose(r.armR.root, 0, 0, -100)
  pose(r.armR.mid, 0, 0, -90)

  // анатомическая кираса с грудными пластинами и наплечными ремнями
  add(
    r.chest,
    lathe([[0.16 * b, -0.01], [0.172 * b, 0.07], [0.19 * b, 0.17], [0.222 * b, 0.3], [0.228 * b, 0.38], [0.2 * b, 0.44], [0.12 * b, 0.475]]),
    m.accent,
    [0, 0, 0],
    [0, 0, 0],
    [1, 1, 0.7],
  )
  add(r.chest, ball(0.095 * b), m.accent, [0.09 * b, 0.33, 0.105], [0, 0, 0], [1.1, 0.82, 0.5])
  add(r.chest, ball(0.095 * b), m.accent, [-0.09 * b, 0.33, 0.105], [0, 0, 0], [1.1, 0.82, 0.5])
  add(r.chest, box(0.012, 0.2, 0.012), m.main, [0, 0.14, 0.132 * b])
  add(r.chest, box(0.07, 0.03, 0.34), m.main, [0.13 * b, 0.465, 0], [0, 0, -12])
  add(r.chest, box(0.07, 0.03, 0.34), m.main, [-0.13 * b, 0.465, 0], [0, 0, 12])
  add(r.hips, new TorusGeometry(0.168 * b, 0.022, 6, 16), m.main, [0, 0.12, 0], [90, 0, 0], [1, 0.72, 1])

  // птеруги: два ряда кожаных полос по подолу и короткие — на плечах
  around(r.hips, [0, 0.08, 0], 14, (spoke) => void add(spoke, box(0.066, 0.2, 0.014), m.accent, [0, -0.1, 0.165 * b], [-13, 0, 0]))
  around(r.hips, [0, 0.08, 0], 14, (spoke) => void add(spoke, box(0.06, 0.29, 0.012), m.main, [0, -0.14, 0.15 * b], [-9, 0, 0]), 13)
  for (const arm of [r.armL, r.armR]) {
    around(arm.root, [0, 0.01, 0], 7, (spoke) => void add(spoke, box(0.045, 0.13, 0.012), m.accent, [0, -0.06, 0.09 * b], [-16, 0, 0]))
  }

  // поножи с наколенником
  for (const leg of [r.legL, r.legR]) {
    add(leg.mid, limb([0.066 * b, 0.08 * b, 0.06 * b, 0.05 * b], 0.36), m.accent, [0, -0.02, 0.004])
    add(leg.mid, ball(0.07 * b), m.accent, [0, 0, 0.012], [0, 0, 0], [1, 1.1, 0.9])
    add(leg.end, new TorusGeometry(0.05, 0.012, 5, 10), m.accent, [0, 0, 0], [90, 0, 0])
  }

  // плащ со складками, заколот на плечах
  add(r.chest, drape(0.21 * b, 0.4, 1.02, { arc: 2.7, from: Math.PI - 1.35, folds: 9, depth: 0.11 }), m.accent, [0, 0.47, -0.02], [6, 0, 0])
  add(r.chest, ball(0.03), m.main, [0.15 * b, 0.47, 0.06])
  add(r.chest, ball(0.03), m.main, [-0.15 * b, 0.47, 0.06])

  // коринфский шлем: купол, наносник, нащёчники с прорезью, назатыльник и поперечный гребень
  add(r.head, new SphereGeometry(0.128, 16, 8, 0, TURN, 0, Math.PI * 0.5), m.accent, [0, 0.005, 0], [0, 0, 0], [0.96, 1.12, 1.06])
  add(r.head, box(0.02, 0.1, 0.02), m.accent, [0, -0.045, 0.128])
  for (const side of [1, -1]) {
    add(r.head, new CylinderGeometry(0.128, 0.118, 0.13, 8, 1, true, side > 0 ? 0.12 : -1.95, 1.83), m.accent, [0, -0.105, 0.004], [0, 0, 0], [0.96, 1, 1.06])
  }
  add(r.head, new CylinderGeometry(0.128, 0.14, 0.11, 8, 1, true, Math.PI - 1.2, 2.4), m.accent, [0, -0.05, 0.004], [0, 0, 0], [0.96, 1, 1.06])
  add(r.head, new TorusGeometry(0.126, 0.008, 4, 18), m.main, [0, 0.005, 0.004], [90, 0, 0], [0.96, 1.06, 1])
  add(r.head, box(0.34, 0.03, 0.04), m.accent, [0, 0.14, 0])
  add(r.head, new CylinderGeometry(0.23, 0.23, 0.03, 20, 1, false, Math.PI / 2, Math.PI), m.main, [0, 0.14, 0], [90, 0, 0])
  // пряди конского волоса на гребне
  for (let i = 0; i < 11; i++) {
    const a = -80 + i * 16
    add(r.head, box(0.012, 0.1, 0.04), m.accent, [Math.sin(a * RAD) * 0.185, 0.14 + Math.cos(a * RAD) * 0.185, 0], [0, 0, -a])
  }

  // аспис: выпуклый круг с ободом и личной эмблемой-солнцем вместо киношной лямбды
  const shield = joint(r.chest, [0.4, 0.12, 0.2], [0, 32, 0])
  shield.scale.setScalar(0.86)
  const dome = joint(shield, [0, 0, 0], [90, 0, 0])
  add(dome, new SphereGeometry(0.75, 28, 6, 0, TURN, 0, 0.6), m.main, [0, -0.62, 0])
  add(shield, new TorusGeometry(0.42, 0.026, 8, 28), m.accent)
  add(shield, new TorusGeometry(0.355, 0.008, 4, 28), m.accent, [0, 0, 0.045])
  add(shield, ball(0.06), m.accent, [0, 0, 0.115], [0, 0, 0], [1, 1, 0.6])
  for (let i = 0; i < 8; i++) {
    const a = (i * TURN) / 8
    add(shield, new ConeGeometry(0.03, 0.15, 4), m.accent, [Math.sin(a) * 0.17, Math.cos(a) * 0.17, 0.1], [0, 0, -a / RAD], [1, 1, 0.3])
  }

  // дори: древко, листовидный наконечник со втулкой и подток
  const spear = joint(r.chest, [-0.52, 0.8, 0.2], [98, 0, 0])
  add(spear, tube(0.014, 0.014, 2.0, 8), m.accent)
  add(spear, tube(0.02, 0.016, 0.1, 8), m.main, [0, 1.03, 0])
  add(spear, new ConeGeometry(0.05, 0.3, 8), m.main, [0, 1.22, 0], [0, 0, 0], [1, 1, 0.3])
  add(spear, new ConeGeometry(0.05, 0.08, 8), m.main, [0, 1.04, 0], [180, 0, 0], [1, 1, 0.3])
  add(spear, new ConeGeometry(0.022, 0.12, 6), m.main, [0, -1.06, 0], [180, 0, 0])

  // ксифос в ножнах на левом боку
  const xiphos = joint(r.hips, [0.2 * b, 0.02, -0.02], [18, 0, 14])
  add(xiphos, box(0.045, 0.42, 0.022), m.accent, [0, -0.2, 0])
  add(xiphos, box(0.1, 0.02, 0.03), m.main, [0, 0.02, 0])
  add(xiphos, tube(0.014, 0.014, 0.1, 6), m.main, [0, 0.08, 0])
  add(xiphos, ball(0.022), m.main, [0, 0.14, 0])
  return finish(r, m)
}

/** Викинг: шлем с очковым наносником (без рогов), расписной щит с умбоном, бородатая секира на плече. */
function viking(m: StatueMaterials): Group {
  const r = rig(m, 1.22)
  const b = r.b
  pose(r.legL.root, 0, 0, 9)
  pose(r.legR.root, 0, 0, -9)
  pose(r.chest, 0, -8, 0)
  pose(r.armL.root, -12, 0, 30)
  pose(r.armL.mid, -50)
  pose(r.armR.root, -30, 0, -12)
  pose(r.armR.mid, -125)

  // рубаха со складками до середины бедра, пояс с пряжкой, сакс поперёк пояса
  add(r.hips, drape(0.175 * b, 0.25 * b, 0.42, { folds: 11, depth: 0.07 }), m.main, [0, 0.1, 0], [0, 0, 0], [1, 1, 0.76])
  add(r.hips, new TorusGeometry(0.178 * b, 0.026, 6, 16), m.accent, [0, 0.07, 0], [90, 0, 0], [1, 0.74, 1])
  add(r.hips, box(0.07, 0.07, 0.025), m.main, [0, 0.07, 0.135 * b])
  const sax = joint(r.hips, [0.03, 0.0, 0.15 * b], [0, 0, -10])
  add(sax, box(0.3, 0.045, 0.02), m.accent, [0.02, 0, 0])
  add(sax, tube(0.016, 0.016, 0.11, 6), m.main, [-0.18, 0, 0], [0, 0, 90])

  // плащ на фибуле у правого плеча и меховой ворот
  add(r.chest, drape(0.2 * b, 0.42, 1.04, { arc: 2.9, from: Math.PI - 1.45, folds: 8, depth: 0.11 }), m.accent, [0, 0.47, -0.02], [5, 0, 0])
  add(r.chest, ball(0.035), m.main, [-0.15 * b, 0.46, 0.08], [0, 0, 0], [1, 1, 0.6])
  around(r.chest, [0, 0.47, -0.01], 18, (spoke, i) => {
    add(spoke, new ConeGeometry(0.05, 0.16, 5), m.accent, [0, i % 2 ? 0.01 : -0.015, 0.2 * b], [112, 0, i % 2 ? 9 : -9])
  })

  // шлем из Гьермундбу: купол из четырёх пластин с гребнем, обод, «очки» с наносником
  add(r.head, new SphereGeometry(0.126, 16, 8, 0, TURN, 0, Math.PI * 0.5), m.accent, [0, 0.02, 0], [0, 0, 0], [0.98, 1.06, 1.06])
  add(r.head, new TorusGeometry(0.125, 0.012, 5, 18), m.main, [0, 0.022, 0], [90, 0, 0], [0.98, 1.06, 1])
  add(r.head, new TorusGeometry(0.128, 0.008, 4, 12, Math.PI), m.main, [0, 0.022, 0], [0, 90, 0], [1.06, 1.06, 1])
  add(r.head, new TorusGeometry(0.128, 0.008, 4, 12, Math.PI), m.main, [0, 0.022, 0], [0, 0, 0], [0.98, 1.06, 1])
  add(r.head, new ConeGeometry(0.016, 0.05, 6), m.main, [0, 0.165, 0])
  add(r.head, new TorusGeometry(0.03, 0.008, 5, 10), m.accent, [0.042, 0.0, 0.108])
  add(r.head, new TorusGeometry(0.03, 0.008, 5, 10), m.accent, [-0.042, 0.0, 0.108])
  add(r.head, box(0.02, 0.09, 0.018), m.accent, [0, -0.02, 0.118])
  // борода клином с косой и усы — вылеплены, волосы до плеч
  r.later.push((put) => {
    const head = r.head.matrixWorld
    const beard = clayAround([r.head], 0.4, 0.008)
    beard.add(head, { kind: 'ball', at: [0, -0.1, 0.06], r: [0.078, 0.062, 0.052] }, 0.015)
    beard.add(head, { kind: 'bone', a: [0, -0.13, 0.07], b: [0, -0.31, 0.088], ra: 0.056, rb: 0.018 }, 0.015)
    for (const side of [1, -1]) {
      beard.add(head, { kind: 'bone', a: [0.008 * side, -0.056, 0.104], b: [0.078 * side, -0.1, 0.082], ra: 0.016, rb: 0.007 }, 0.008)
      beard.add(head, { kind: 'bone', a: [0.085 * side, -0.03, 0.03], b: [0.06 * side, -0.12, 0.05], ra: 0.022, rb: 0.03 }, 0.015)
    }
    // перехваты косы
    for (const y of [-0.2, -0.26]) beard.carve(head, { kind: 'bone', a: [-0.07, y, 0.08], b: [0.07, y, 0.08], ra: 0.012, rb: 0.012 }, 0.02)
    put(beard.build(), 'accent')
  })
  add(r.head, drape(0.1, 0.14, 0.26, { arc: 3.4, from: Math.PI - 1.7, folds: 7, depth: 0.12 }), m.accent, [0, 0.02, 0])

  // обручья, наручи, обмотки на голенях и сапоги
  for (const arm of [r.armL, r.armR]) {
    add(arm.root, new TorusGeometry(0.066 * b, 0.011, 5, 12), m.accent, [0, -0.13, 0], [90, 0, 0])
    add(arm.mid, limb([0.05 * b, 0.057 * b, 0.046 * b, 0.04 * b], 0.2), m.accent, [0, -0.06, 0])
  }
  for (const leg of [r.legL, r.legR]) {
    for (let i = 0; i < 5; i++) add(leg.mid, new TorusGeometry((0.068 - i * 0.004) * b, 0.009, 4, 10), m.accent, [0, -0.1 - i * 0.06, 0], [90 + (i % 2 ? 9 : -9), 0, 0])
    add(leg.end, ball(0.07), m.accent, [0, -0.03, 0.06], [0, 0, 0], [0.82, 0.66, 1.9])
  }

  // щит: доски, раскраска четвертями, железный умбон, обод с заклёпками
  const shield = joint(r.chest, [0.5, -0.02, 0.14], [0, 48, 0])
  shield.scale.setScalar(0.84)
  for (let i = 0; i < 4; i++) {
    add(shield, new CylinderGeometry(0.42, 0.42, 0.035, 9, 1, false, (i * Math.PI) / 2, Math.PI / 2), i % 2 ? m.accent : m.main, [0, 0, 0], [90, 0, 0])
  }
  for (let i = -2; i <= 2; i++) add(shield, box(0.006, 0.82 * Math.cos(i * 0.36), 0.04), m.accent, [i * 0.14, 0, 0.002])
  add(shield, new TorusGeometry(0.42, 0.022, 6, 24), m.accent)
  for (let i = 0; i < 12; i++) add(shield, ball(0.016), m.main, [Math.sin((i * TURN) / 12) * 0.38, Math.cos((i * TURN) / 12) * 0.38, 0.02])
  const boss = joint(shield, [0, 0, 0.017], [90, 0, 0])
  add(boss, new SphereGeometry(0.09, 12, 6, 0, TURN, 0, Math.PI / 2), m.accent)
  add(boss, tube(0.115, 0.115, 0.008, 14), m.accent)

  // секира: топорище уходит за плечо, лезвие оттянуто вниз «бородой»
  const axe = joint(r.chest, [-0.3, 0.42, 0.26], [-50, 0, 0])
  add(axe, tube(0.02, 0.024, 0.95, 8), m.accent, [0, 0.3, 0])
  add(axe, ball(0.03), m.main, [0, -0.18, 0])
  add(
    axe,
    plate([[0.03, 0.07], [-0.1, 0.09], [-0.25, 0.13], [-0.285, 0.05], [-0.295, -0.06], [-0.27, -0.17], [-0.2, -0.13], [-0.1, -0.03], [0.03, -0.05]], 0.03),
    m.main,
    [0, 0.68, 0],
  )
  add(axe, tube(0.03, 0.03, 0.13, 8), m.main, [0, 0.69, 0])
  return finish(r, m)
}

/** Самурай трёх мечей: широкая стойка, хакама, по клинку в каждой руке и третий в зубах. */
function samurai(m: StatueMaterials): Group {
  const r = rig(m, 1.02)
  const b = r.b
  pose(r.legL.root, -14, 0, 20)
  pose(r.legL.mid, 28)
  pose(r.legR.root, -14, 0, -20)
  pose(r.legR.mid, 28)
  pose(r.chest, 6, 0, 0)
  pose(r.armR.root, -20, 0, -112)
  pose(r.armR.mid, -30)
  pose(r.armL.root, -15, 0, 42)
  pose(r.armL.mid, -25)

  // хакама в глубокую складку
  add(r.hips, drape(0.17 * b, 0.46, 0.84, { folds: 12, depth: 0.1 }), m.accent, [0, 0.06, 0], [0, 0, 0], [1, 1, 0.86])
  // кимоно вылеплено по фигуре: запах открывает грудь, рукава до локтя
  r.later.push((put) => {
    const chest = r.chest.matrixWorld
    const robe = clayAround([r.chest, r.hips, r.armL.root, r.armR.root, r.armL.mid, r.armR.mid], 0.2, 0.013)
    robe.add(chest, { kind: 'ball', at: [0, 0.07, 0], r: [0.165 * b, 0.19, 0.118 * b] })
    // с запасом спереди: грудные мышцы не должны проступать сквозь ткань
    robe.add(chest, { kind: 'ball', at: [0, 0.29, 0.012], r: [0.222 * b, 0.214, 0.164 * b] })
    for (const arm of [r.armL, r.armR]) {
      robe.add(arm.root.matrixWorld, { kind: 'ball', at: [0, 0, 0], r: 0.103 * b })
      robe.add(null, { kind: 'bone', a: spot(arm.root), b: spot(arm.mid, [0, 0.04, 0]), ra: 0.09 * b, rb: 0.085 * b })
    }
    // вырез: клин от шеи к поясу и отверстие под шею
    robe.carve(chest, { kind: 'bone', a: [0, 0.54, 0.16], b: [0, 0.17, 0.19], ra: 0.07, rb: 0.006 }, 0.012)
    robe.carve(null, { kind: 'bone', a: spot(r.chest, [0, 0.43, -0.01]), b: spot(r.head, [0, 0.02, 0]), ra: 0.076, rb: 0.072 }, 0.012)
    put(robe.build(), 'accent')
  })
  // широкие рукава
  for (const arm of [r.armL, r.armR]) {
    add(arm.mid, drape(0.062, 0.14, 0.25, { folds: 5, depth: 0.1 }), m.accent, [0, 0.02, 0])
  }
  // широкий пояс-харамаки с узлом и свисающими концами
  add(r.hips, lathe([[0.168 * b, 0], [0.18 * b, 0.02], [0.182 * b, 0.11], [0.17 * b, 0.13]]), m.main, [0, 0.02, 0], [0, 0, 0], [1, 1, 0.74])
  add(r.hips, ball(0.04), m.main, [0.11, 0.08, 0.125])
  add(r.hips, box(0.05, 0.22, 0.014), m.main, [0.13, -0.04, 0.135], [0, 0, 10])
  add(r.hips, box(0.045, 0.17, 0.014), m.main, [0.085, -0.03, 0.14], [0, 0, -6])
  // повязка на левом плече
  add(r.armL.root, new TorusGeometry(0.088 * b, 0.016, 5, 12), m.main, [0, -0.11, 0], [90, 0, 0])
  add(r.armL.root, box(0.03, 0.1, 0.01), m.main, [0.07, -0.17, -0.04], [0, 0, 14])

  // короткие волосы торчком — вылеплены одной массой, и три серьги в левом ухе
  r.later.push((put) => {
    const head = r.head.matrixWorld
    const hair = clayAround([r.head], 0.3, 0.008)
    hair.add(head, { kind: 'ball', at: [0, 0.035, -0.014], r: [0.099, 0.108, 0.113] }, 0.012)
    const spikes: V3[] = [[0, 0.115, 0], [0.055, 0.1, 0.02], [-0.055, 0.1, 0.02], [0.03, 0.105, -0.05], [-0.03, 0.105, -0.05], [0, 0.1, 0.06], [0.07, 0.07, -0.03], [-0.07, 0.07, -0.03], [0, 0.085, -0.085], [0.04, 0.095, 0.055], [-0.04, 0.095, 0.055]]
    for (const [x, y, z] of spikes) {
      hair.add(head, { kind: 'bone', a: [x * 0.8, y * 0.8 + 0.02, z * 0.8], b: [x * 1.75, y * 1.55 + 0.02, z * 1.75], ra: 0.03, rb: 0.004 }, 0.012)
    }
    // лицо остаётся открытым
    hair.carve(head, { kind: 'ball', at: [0, -0.035, 0.095], r: [0.09, 0.085, 0.075] }, 0.012)
    put(hair.build(), 'accent')
  })
  for (let i = 0; i < 3; i++) add(r.head, ball(0.011), m.main, [0.1, -0.035 - i * 0.004, -0.012 + i * 0.016], [0, 0, 0], [0.7, 2.6, 0.7])

  // три пары ножен на правом боку
  for (let i = 0; i < 3; i++) {
    const sheath = joint(r.hips, [-0.17 * b, 0.07 - i * 0.02, 0.02], [68 + i * 7, 0, 12 + i * 4])
    add(sheath, tube(0.017, 0.013, 0.78, 8), m.main, [0, -0.3, 0])
    add(sheath, tube(0.02, 0.02, 0.03, 8), m.accent, [0, 0.09, 0])
  }

  sword(r.armR.end, m, 0.92, [-20, 25, 0])
  sword(r.armL.end, m, 0.92, [10, -30, 0])
  // третий клинок — в зубах, поперёк лица
  sword(r.head, m, 0.82, [0, 90, 0]).position.set(0.06, -0.05, 0.105)
  return finish(r, m)
}

/** Охотник: выпад с коротким клинком, широкие штаны, вокруг плеч обвился дух-червь. */
function hunter(m: StatueMaterials): Group {
  const r = rig(m, 1.15)
  const b = r.b
  pose(r.legL.root, -50, 0, 6)
  pose(r.legL.mid, 55)
  pose(r.legR.root, 25, 0, -6)
  pose(r.legR.mid, 20)
  pose(r.chest, 18, -15, 0)
  pose(r.head, -12, 10, 0)
  pose(r.armR.root, -55, 0, -15)
  pose(r.armR.mid, -20)
  pose(r.armL.root, 40, 0, 20)
  pose(r.armL.mid, -40)

  // пресс: торс обтянут, мышцы читаются
  for (let row = 0; row < 3; row++) {
    for (const side of [1, -1]) add(r.chest, ball(0.036 * b), m.main, [0.036 * b * side, 0.2 - row * 0.068, 0.098 * b - row * 0.004], [0, 0, 0], [1, 0.85, 0.5])
  }

  // широкие штаны, собранные у щиколотки, и пояс с концом
  for (const leg of [r.legL, r.legR]) {
    add(leg.root, limb([0.108 * b, 0.125 * b, 0.122 * b, 0.11 * b], 0.46), m.accent)
    add(leg.mid, limb([0.11 * b, 0.118 * b, 0.1 * b, 0.058 * b], 0.36), m.accent)
    add(leg.mid, ball(0.112 * b), m.accent)
    add(leg.mid, new TorusGeometry(0.052 * b, 0.014, 5, 10), m.main, [0, -0.36, 0], [90, 0, 0])
  }
  add(r.hips, lathe([[0.1 * b, -0.14], [0.175 * b, -0.08], [0.185 * b, 0.02], [0.168 * b, 0.1]]), m.accent, [0, 0, 0], [0, 0, 0], [1, 1, 0.74])
  add(r.hips, new TorusGeometry(0.17 * b, 0.026, 6, 16), m.main, [0, 0.1, 0], [90, 0, 0], [1, 0.72, 1])
  add(r.hips, box(0.05, 0.24, 0.014), m.main, [-0.12, -0.02, 0.12 * b], [0, 0, -8])

  // волосы вылеплены одной массой: шапка, пряди на лоб и у висков
  r.later.push((put) => {
    const head = r.head.matrixWorld
    const hair = clayAround([r.head], 0.3, 0.008)
    hair.add(head, { kind: 'ball', at: [0, 0.036, -0.012], r: [0.1, 0.11, 0.116] }, 0.012)
    hair.carve(head, { kind: 'ball', at: [0, -0.04, 0.095], r: [0.092, 0.09, 0.08] }, 0.012)
    for (let i = -3; i <= 3; i++) {
      hair.add(head, { kind: 'bone', a: [i * 0.022, 0.095, 0.07], b: [i * 0.03, 0.004 + Math.abs(i) * 0.008, 0.109], ra: 0.02, rb: 0.007 }, 0.01)
    }
    for (const side of [1, -1]) {
      hair.add(head, { kind: 'bone', a: [0.088 * side, 0.05, 0.02], b: [0.098 * side, -0.05, 0.03], ra: 0.024, rb: 0.009 }, 0.01)
    }
    put(hair.build(), 'accent')
  })

  // клинок с боковым зубцом и цепь от навершия
  const blade = joint(r.armR.end, [0, -0.05, 0])
  add(blade, plate(bladeShape(0.52, 0.05, 0), 0.012), m.accent, [0, 0, 0.05], [0, -90, 0])
  add(blade, plate([[0, 0], [0.14, 0.035], [0.16, 0.06], [0.02, 0.03]], 0.012), m.accent, [0, -0.025, 0.11], [0, -90, 0])
  add(blade, box(0.03, 0.07, 0.02), m.main, [0, 0, 0.045])
  add(blade, tube(0.018, 0.016, 0.17, 8), m.main, [0, 0, -0.045], [90, 0, 0])
  for (let i = 0; i < 6; i++) add(blade, new TorusGeometry(0.014, 0.004, 4, 8), m.main, [0, -0.005 * i * i, -0.15 - i * 0.022], [i % 2 ? 90 : 0, 0, 0])

  // дух-червь: кольчатое тело вокруг плеч, голова с пастью у правого плеча
  const path = new CatmullRomCurve3(
    [[-0.24, -0.02, 0.15], [0.02, 0.06, 0.2], [0.24, 0.16, 0.14], [0.3, 0.42, -0.02], [0.02, 0.52, -0.16], [-0.3, 0.46, -0.02], [-0.25, 0.62, 0.12]].map(
      ([x, y, z]) => new Vector3(x * b, y, z * b),
    ),
  )
  add(r.chest, new TubeGeometry(path, 40, 0.048, 10), m.accent)
  for (let i = 0; i <= 16; i++) {
    const p = path.getPoint(i / 16)
    add(r.chest, ball(0.0525), m.accent, [p.x, p.y, p.z])
  }
  const tip = path.getPoint(1)
  add(r.chest, ball(0.078), m.accent, [tip.x, tip.y + 0.03, tip.z + 0.03], [0, 0, 0], [1, 0.85, 1.15])
  add(r.chest, new ConeGeometry(0.045, 0.07, 8), m.main, [tip.x, tip.y + 0.025, tip.z + 0.11], [90, 0, 0])
  const tail = path.getPoint(0)
  add(r.chest, new ConeGeometry(0.048, 0.16, 8), m.accent, [tail.x - 0.06, tail.y - 0.03, tail.z - 0.02], [0, 0, 110])
  return finish(r, m)
}

/** Вампир-стрелок: широкополая шляпа, длинный плащ с пелериной, два тяжёлых пистолета. */
function gunslinger(m: StatueMaterials): Group {
  const r = rig(m, 1)
  pose(r.legL.root, 0, 0, 5)
  pose(r.legR.root, 0, 0, -7)
  pose(r.chest, -8, 10, 0)
  pose(r.head, 12, -6, 0)
  // правая рука целится вперёд и в сторону, чтобы пистолет не закрывал лицо
  pose(r.armR.root, -80, 0, -45)
  pose(r.armR.mid, -4)
  pose(r.armL.root, 8, 0, 14)
  pose(r.armL.mid, -12)

  // плащ: лиф, длинные полы в складку, пелерина на плечах, высокий ворот
  add(r.chest, lathe([[0.155, -0.02], [0.165, 0.07], [0.185, 0.17], [0.22, 0.3], [0.225, 0.38], [0.19, 0.45], [0.1, 0.49]]), m.accent, [0, 0, 0], [0, 0, 0], [1, 1, 0.7])
  add(r.hips, drape(0.165, 0.5, 0.98, { folds: 10, depth: 0.12 }), m.accent, [0, 0.12, 0], [0, 0, 0], [1, 1, 0.82])
  add(r.chest, drape(0.11, 0.31, 0.3, { folds: 9, depth: 0.07 }), m.accent, [0, 0.52, 0], [0, 0, 0], [1, 1, 0.8])
  add(r.chest, new CylinderGeometry(0.135, 0.1, 0.15, 12, 1, true, 0.75, TURN - 1.5), m.accent, [0, 0.55, -0.005])
  // пояс с пряжкой и ряд пуговиц
  add(r.hips, new TorusGeometry(0.168, 0.02, 5, 16), m.main, [0, 0.11, 0], [90, 0, 0], [1, 0.74, 1])
  add(r.hips, box(0.06, 0.06, 0.02), m.main, [0, 0.11, 0.128])
  for (let i = 0; i < 4; i++) add(r.chest, ball(0.013), m.main, [0.035, 0.06 + i * 0.07, 0.115 + i * 0.006])
  // бант на шее
  add(r.chest, ball(0.026), m.main, [0, 0.44, 0.115])
  add(r.chest, new ConeGeometry(0.045, 0.1, 5), m.main, [0.055, 0.44, 0.11], [0, 0, 90], [1, 1, 0.4])
  add(r.chest, new ConeGeometry(0.045, 0.1, 5), m.main, [-0.055, 0.44, 0.11], [0, 0, -90], [1, 1, 0.4])
  add(r.chest, box(0.03, 0.12, 0.012), m.main, [0.015, 0.36, 0.125], [0, 0, 8])
  add(r.chest, box(0.03, 0.1, 0.012), m.main, [-0.015, 0.37, 0.125], [0, 0, -8])
  // рукава с обшлагами
  for (const arm of [r.armL, r.armR]) {
    add(arm.root, limb([0.075, 0.078, 0.068, 0.06], 0.3), m.accent)
    add(arm.mid, limb([0.06, 0.064, 0.056, 0.052], 0.25), m.accent)
    add(arm.mid, tube(0.06, 0.066, 0.06, 10), m.accent, [0, -0.235, 0])
    add(arm.mid, ball(0.062), m.accent)
  }
  // сапоги
  for (const leg of [r.legL, r.legR]) add(leg.end, ball(0.068), m.main, [0, -0.03, 0.06], [0, 0, 0], [0.8, 0.66, 1.9])

  // шляпа с изогнутыми полями надвинута на глаза, под ней круглые очки
  const hat = joint(r.head, [0, 0.07, 0], [10, 0, 0])
  add(hat, lathe([[0.1, 0.012], [0.2, 0], [0.29, 0.02], [0.33, 0.055], [0.325, 0.062], [0.28, 0.034], [0.2, 0.014], [0.1, 0.026]], 24), m.accent)
  add(hat, lathe([[0.122, 0.01], [0.126, 0.08], [0.112, 0.15], [0.06, 0.168], [0.0005, 0.17]], 18), m.accent)
  add(hat, new TorusGeometry(0.125, 0.014, 5, 18), m.main, [0, 0.03, 0], [90, 0, 0])
  for (const side of [1, -1]) add(r.head, tube(0.03, 0.03, 0.008, 12), m.main, [0.04 * side, 0.002, 0.102], [90, 0, 0])
  add(r.head, box(0.03, 0.006, 0.006), m.main, [0, 0.006, 0.106])
  // длинные волосы прядями
  add(r.head, drape(0.1, 0.17, 0.46, { arc: 3.8, from: Math.PI - 1.9, folds: 9, depth: 0.16 }), m.accent, [0, 0.04, 0])

  // пистолеты продолжают линию предплечья: затвор, ствол, рамка, рукоять, мушка, скоба
  for (const arm of [r.armL, r.armR]) {
    const gun = joint(arm.end, [0, -0.05, 0.03])
    add(gun, box(0.04, 0.25, 0.05), m.main, [0, -0.165, 0])
    add(gun, tube(0.015, 0.015, 0.1, 10), m.main, [0, -0.33, 0.006])
    add(gun, box(0.036, 0.18, 0.024), m.accent, [0, -0.16, -0.036])
    add(gun, box(0.036, 0.1, 0.05), m.accent, [0, 0.0, -0.04], [22, 0, 0])
    add(gun, box(0.01, 0.024, 0.016), m.accent, [0, -0.27, 0.032])
    add(gun, new TorusGeometry(0.03, 0.007, 4, 10, Math.PI), m.accent, [0, -0.06, -0.07], [0, 90, 180])
  }
  return finish(r, m, 1.05)
}

// метки тонов на время лепки: по ним детали раскладываются на две сетки
const TONES: StatueMaterials = { main: new MeshStandardMaterial(), accent: new MeshStandardMaterial() }

type Sculpted = Partial<Record<keyof StatueMaterials, BufferGeometry>>
const sculptedCache = new Map<string, Sculpted>()

function sculptorOf(key: string): (m: StatueMaterials) => Group {
  switch (key) {
    case 'strength':
      return viking
    case 'agility':
      return samurai
    case 'burst':
      return hunter
    case 'flexibility':
      return gunslinger
    default:
      // неизвестному ключу достаётся спартанец
      return spartan
  }
}

/** Вылеплена ли уже фигура этого титана. */
export const isSculpted = (key: string): boolean => sculptedCache.has(key)

/**
 * Лепит фигуру титана (доли секунды работы) и запоминает до конца сеанса.
 * Вызывается заранее, при входе в приложение, чтобы витрина открывалась без ожидания.
 */
export function sculptStatue(key: string): Sculpted {
  let sculpted = sculptedCache.get(key)
  if (!sculpted) {
    sculpted = {}
    for (const child of sculptorOf(key)(TONES).children) {
      if (child instanceof Mesh) sculpted[child.material === TONES.main ? 'main' : 'accent'] = child.geometry
    }
    sculptedCache.set(key, sculpted)
  }
  return sculpted
}

/** Статуэтка титана из готовой лепки, отлитая в заданные материалы. */
export function buildStatue(key: string, materials: StatueMaterials): Group {
  const sculpted = sculptStatue(key)
  const statue = new Group()
  for (const tone of ['main', 'accent'] as const) {
    const geometry = sculpted[tone]
    if (!geometry) continue
    const cast = new Mesh(geometry, materials[tone])
    cast.castShadow = true
    cast.receiveShadow = true
    // лепка общая на весь сеанс: витрина не должна освобождать её вместе с собой
    cast.userData.keep = true
    statue.add(cast)
  }
  return statue
}
