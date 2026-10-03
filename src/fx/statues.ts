import {
  BoxGeometry,
  Box3,
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from 'three'

/**
 * Статуэтки титанов — низкополигональные фигуры, собранные кодом из простых тел.
 * Каждая отлита из одного материала в двух тонах: main — тело и доспех, accent — ткань, волосы, оружие.
 * Узнаётся фигура по силуэту: у каждой свой крупный признак (щит и гребень, секира, три меча, шляпа и плащ).
 */
export interface StatueMaterials {
  main: MeshStandardMaterial
  accent: MeshStandardMaterial
}

type V3 = [number, number, number]

const RAD = Math.PI / 180

const cyl = (top: number, bottom: number, height: number, sides = 8): CylinderGeometry =>
  new CylinderGeometry(top, bottom, height, sides)
const box = (w: number, h: number, d: number): BoxGeometry => new BoxGeometry(w, h, d)

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
  feet: Mesh[]
}

/**
 * Манекен: таз, корпус, голова, руки и ноги на суставах. Рука и нога в покое висят вниз.
 * Знаки поворотов: плечо и бедро x < 0 — вперёд; локоть x < 0 — сгиб вперёд; колено x > 0 — сгиб назад;
 * z > 0 отводит левую конечность в сторону, z < 0 — правую.
 */
function rig(m: StatueMaterials, bulk = 1): Rig {
  const root = new Group()
  const feet: Mesh[] = []
  const hips = joint(root, [0, 0.98, 0])
  add(hips, cyl(0.17 * bulk, 0.15 * bulk, 0.2), m.main, [0, 0.02, 0], [0, 0, 0], [1, 1, 0.68])
  const chest = joint(hips, [0, 0.12, 0])
  add(chest, cyl(0.21 * bulk, 0.155 * bulk, 0.44), m.main, [0, 0.22, 0], [0, 0, 0], [1, 1, 0.66])
  add(chest, cyl(0.055, 0.065, 0.1, 6), m.main, [0, 0.49, 0])
  const head = joint(chest, [0, 0.61, 0])
  add(head, new IcosahedronGeometry(0.115, 1), m.main, [0, 0, 0], [0, 0, 0], [0.92, 1.12, 1])

  const arm = (side: 1 | -1): Limb => {
    const shoulder = joint(chest, [0.235 * bulk * side, 0.4, 0])
    add(shoulder, new IcosahedronGeometry(0.078 * bulk, 0), m.main)
    add(shoulder, cyl(0.062 * bulk, 0.05 * bulk, 0.3, 6), m.main, [0, -0.15, 0])
    const elbow = joint(shoulder, [0, -0.3, 0])
    add(elbow, cyl(0.05 * bulk, 0.038 * bulk, 0.27, 6), m.main, [0, -0.135, 0])
    const hand = joint(elbow, [0, -0.27, 0])
    add(hand, box(0.07, 0.09, 0.045), m.main, [0, -0.04, 0])
    return { root: shoulder, mid: elbow, end: hand }
  }
  const leg = (side: 1 | -1): Limb => {
    const hip = joint(hips, [0.095 * bulk * side, -0.06, 0])
    add(hip, cyl(0.088 * bulk, 0.065 * bulk, 0.45, 6), m.main, [0, -0.225, 0])
    const knee = joint(hip, [0, -0.45, 0])
    add(knee, cyl(0.062 * bulk, 0.045 * bulk, 0.4, 6), m.main, [0, -0.2, 0])
    const ankle = joint(knee, [0, -0.4, 0])
    feet.push(add(ankle, box(0.095, 0.07, 0.24), m.main, [0, -0.035, 0.06]))
    return { root: hip, mid: knee, end: ankle }
  }
  return { root, hips, chest, head, armL: arm(1), armR: arm(-1), legL: leg(1), legR: leg(-1), feet }
}

/** Ставит фигуру ступнями на землю, какой бы ни была поза. */
function ground(r: Rig): Group {
  r.root.updateMatrixWorld(true)
  const bounds = new Box3()
  for (const foot of r.feet) bounds.expandByObject(foot)
  r.root.position.y -= bounds.min.y
  return r.root
}

/** Клинок вдоль +z от кисти: полоса, гарда и рукоять. */
function sword(hand: Object3D, m: StatueMaterials, length: number, turn: V3 = [0, 0, 0]): Group {
  const g = joint(hand, [0, -0.05, 0], turn)
  add(g, box(0.012, 0.036, length), m.accent, [0, 0, 0.05 + length / 2])
  add(g, cyl(0.042, 0.042, 0.012, 8), m.main, [0, 0, 0.045], [90, 0, 0])
  add(g, box(0.022, 0.03, 0.2), m.accent, [0, 0, -0.06])
  return g
}

/** Спартанец-гоплит: коринфский шлем с поперечным гребнем, круглый щит, копьё хватом сверху. */
function spartan(m: StatueMaterials): Group {
  const r = rig(m, 1.12)
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

  // кираса, птеруги, поножи, плащ
  add(r.chest, cyl(0.25, 0.19, 0.46), m.accent, [0, 0.22, 0], [0, 0, 0], [1, 1, 0.7])
  add(r.hips, cyl(0.2, 0.28, 0.24, 10), m.accent, [0, -0.06, 0], [0, 0, 0], [1, 1, 0.76])
  add(r.legL.mid, cyl(0.08, 0.058, 0.36, 6), m.accent, [0, -0.19, 0])
  add(r.legR.mid, cyl(0.08, 0.058, 0.36, 6), m.accent, [0, -0.19, 0])
  add(r.chest, box(0.48, 0.92, 0.035), m.accent, [0, -0.02, -0.18], [8, 0, 0])

  // шлем: купол, наносник, нащёчники и поперечный гребень
  add(r.head, new SphereGeometry(0.13, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.62), m.accent, [0, 0.01, 0], [0, 0, 0], [0.95, 1.1, 1.05])
  add(r.head, box(0.022, 0.11, 0.022), m.accent, [0, -0.03, 0.125])
  add(r.head, box(0.03, 0.12, 0.08), m.accent, [0.088, -0.075, 0.065])
  add(r.head, box(0.03, 0.12, 0.08), m.accent, [-0.088, -0.075, 0.065])
  add(r.head, new CylinderGeometry(0.21, 0.21, 0.035, 14, 1, false, Math.PI / 2, Math.PI), m.main, [0, 0.1, 0], [90, 0, 0])

  // аспис: выпуклый круг с ободом и личной эмблемой вместо киношной лямбды
  // щит сдвинут к левому плечу и развёрнут, чтобы не закрывать фигуру
  const shield = joint(r.chest, [0.4, 0.12, 0.2], [0, 32, 0])
  shield.scale.setScalar(0.86)
  const dome = joint(shield, [0, 0, 0], [90, 0, 0])
  add(dome, new SphereGeometry(0.75, 20, 4, 0, Math.PI * 2, 0, 0.6), m.main, [0, -0.62, 0])
  add(shield, new TorusGeometry(0.42, 0.024, 6, 20), m.accent)
  add(shield, new TorusGeometry(0.2, 0.016, 5, 16), m.accent, [0, 0, 0.1])
  add(shield, new IcosahedronGeometry(0.05, 0), m.accent, [0, 0, 0.125])

  // дори: древко, наконечник и подток
  const spear = joint(r.chest, [-0.52, 0.8, 0.2], [98, 0, 0])
  add(spear, cyl(0.014, 0.014, 2.0, 6), m.accent)
  add(spear, new ConeGeometry(0.04, 0.24, 6), m.main, [0, 1.12, 0])
  add(spear, new ConeGeometry(0.022, 0.1, 5), m.main, [0, -1.05, 0], [180, 0, 0])
  return ground(r)
}

/** Викинг: шлем с очковым наносником (без рогов), круглый щит с умбоном, бородатая секира на плече. */
function viking(m: StatueMaterials): Group {
  const r = rig(m, 1.22)
  pose(r.legL.root, 0, 0, 9)
  pose(r.legR.root, 0, 0, -9)
  pose(r.chest, 0, -8, 0)
  pose(r.armL.root, -12, 0, 30)
  pose(r.armL.mid, -50)
  pose(r.armR.root, -30, 0, -12)
  pose(r.armR.mid, -125)

  // рубаха до середины бедра, пояс, плащ и меховой ворот
  add(r.hips, cyl(0.21, 0.3, 0.34, 8), m.main, [0, -0.1, 0], [0, 0, 0], [1, 1, 0.72])
  add(r.hips, new TorusGeometry(0.215, 0.028, 5, 12), m.accent, [0, 0.08, 0], [90, 0, 0], [1, 0.72, 1])
  add(r.chest, box(0.54, 1.0, 0.04), m.accent, [0, -0.06, -0.2], [6, 0, 0])
  add(r.chest, new TorusGeometry(0.2, 0.065, 5, 10), m.accent, [0, 0.46, -0.01], [90, 0, 0])

  // шлем из Гьермундбу: полусфера и «очки» с наносником; борода клином
  add(r.head, new SphereGeometry(0.13, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), m.accent, [0, 0.03, 0], [0, 0, 0], [1, 1.05, 1.05])
  add(r.head, new TorusGeometry(0.03, 0.008, 4, 8), m.accent, [0.042, 0.005, 0.108])
  add(r.head, new TorusGeometry(0.03, 0.008, 4, 8), m.accent, [-0.042, 0.005, 0.108])
  add(r.head, box(0.02, 0.09, 0.016), m.accent, [0, -0.02, 0.12])
  add(r.head, new ConeGeometry(0.09, 0.26, 5), m.accent, [0, -0.16, 0.1], [165, 0, 0])

  const shield = joint(r.chest, [0.5, -0.02, 0.14], [0, 48, 0])
  shield.scale.setScalar(0.84)
  add(shield, cyl(0.42, 0.42, 0.035, 18), m.main, [0, 0, 0], [90, 0, 0])
  add(shield, new TorusGeometry(0.42, 0.02, 5, 18), m.accent)
  const boss = joint(shield, [0, 0, 0.017], [90, 0, 0])
  add(boss, new SphereGeometry(0.09, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), m.accent)

  // секира: топорище уходит за плечо, лезвие оттянуто вниз «бородой»
  const axe = joint(r.chest, [-0.3, 0.42, 0.26], [-50, 0, 0])
  add(axe, cyl(0.02, 0.022, 0.9, 6), m.accent, [0, 0.3, 0])
  add(axe, box(0.24, 0.2, 0.026), m.main, [-0.13, 0.68, 0])
  add(axe, box(0.11, 0.14, 0.026), m.main, [-0.195, 0.53, 0])
  return ground(r)
}

/** Самурай трёх мечей: широкая стойка, хакама, по клинку в каждой руке и третий в зубах. */
function samurai(m: StatueMaterials): Group {
  const r = rig(m, 1.02)
  pose(r.legL.root, -14, 0, 20)
  pose(r.legL.mid, 28)
  pose(r.legR.root, -14, 0, -20)
  pose(r.legR.mid, 28)
  pose(r.chest, 6, 0, 0)
  pose(r.armR.root, -20, 0, -112)
  pose(r.armR.mid, -30)
  pose(r.armL.root, -15, 0, 42)
  pose(r.armL.mid, -25)

  // хакама, пояс с узлом, широкие рукава
  add(r.hips, cyl(0.18, 0.42, 0.8, 8), m.accent, [0, -0.42, 0], [0, 0, 0], [1, 1, 0.82])
  add(r.hips, new TorusGeometry(0.19, 0.036, 5, 12), m.main, [0, 0.1, 0], [90, 0, 0], [1, 0.74, 1])
  add(r.hips, box(0.07, 0.2, 0.04), m.main, [0.1, 0, 0.13], [0, 0, 12])
  add(r.armL.mid, cyl(0.06, 0.11, 0.24, 6), m.accent, [0, -0.12, 0])
  add(r.armR.mid, cyl(0.06, 0.11, 0.24, 6), m.accent, [0, -0.12, 0])

  // короткие волосы торчком
  const spikes: V3[] = [[0, 0.13, 0], [0.06, 0.11, 0.02], [-0.06, 0.11, 0.02], [0.03, 0.11, -0.06], [-0.03, 0.11, -0.06], [0, 0.11, 0.07]]
  for (const [x, y, z] of spikes) add(r.head, new ConeGeometry(0.04, 0.1, 4), m.accent, [x, y, z], [z * 400, 0, -x * 400])

  sword(r.armR.end, m, 0.9, [-20, 25, 0])
  sword(r.armL.end, m, 0.9, [10, -30, 0])
  // третий клинок — в зубах, поперёк лица
  const third = joint(r.head, [0.1, -0.045, 0.115], [0, 90, 0])
  add(third, box(0.012, 0.036, 0.9), m.accent, [0, 0, 0.3])
  add(third, cyl(0.042, 0.042, 0.012, 8), m.main, [0, 0, -0.16], [90, 0, 0])
  add(third, box(0.022, 0.03, 0.2), m.accent, [0, 0, -0.27])
  return ground(r)
}

/** Охотник: выпад с коротким клинком, широкие штаны, вокруг плеч обвился дух-червь. */
function hunter(m: StatueMaterials): Group {
  const b = 1.15
  const r = rig(m, b)
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

  for (const leg of [r.legL, r.legR]) {
    add(leg.root, cyl(0.11 * b, 0.105 * b, 0.44, 6), m.accent, [0, -0.23, 0])
    add(leg.mid, cyl(0.105 * b, 0.06 * b, 0.36, 6), m.accent, [0, -0.18, 0])
  }
  add(r.hips, cyl(0.185 * b, 0.19 * b, 0.16), m.accent, [0, 0.0, 0], [0, 0, 0], [1, 1, 0.7])

  add(r.head, new SphereGeometry(0.125, 7, 4, 0, Math.PI * 2, 0, Math.PI * 0.5), m.accent, [0, 0.02, -0.005], [0, 0, 0], [1, 1.05, 1.08])
  add(r.head, box(0.16, 0.05, 0.04), m.accent, [0, 0.045, 0.1], [20, 0, 0])

  // клинок с боковым зубцом
  const blade = joint(r.armR.end, [0, -0.05, 0])
  add(blade, box(0.014, 0.05, 0.5), m.accent, [0, 0, 0.3])
  add(blade, box(0.014, 0.03, 0.13), m.accent, [0, -0.04, 0.14], [-25, 0, 0])
  add(blade, box(0.024, 0.032, 0.16), m.main, [0, 0, -0.04])

  const path = new CatmullRomCurve3(
    [[-0.22, 0.02, 0.15], [0.2, 0.14, 0.16], [0.29, 0.42, 0], [0.02, 0.5, -0.15], [-0.29, 0.46, 0], [-0.22, 0.64, 0.13]].map(
      ([x, y, z]) => new Vector3(x, y, z),
    ),
  )
  add(r.chest, new TubeGeometry(path, 26, 0.05, 6), m.accent)
  add(r.chest, new IcosahedronGeometry(0.075, 0), m.accent, [-0.22, 0.66, 0.15])
  return ground(r)
}

/** Вампир-стрелок: широкополая шляпа, длинный плащ до пят, два тяжёлых пистолета. */
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

  // плащ: лиф, длинные полы, высокий ворот и рукава
  add(r.chest, cyl(0.24, 0.185, 0.47), m.accent, [0, 0.22, 0], [0, 0, 0], [1, 1, 0.72])
  add(r.hips, cyl(0.2, 0.46, 0.92, 10), m.accent, [0, -0.47, 0], [0, 0, 0], [1, 1, 0.8])
  add(r.chest, cyl(0.17, 0.125, 0.13), m.accent, [0, 0.5, -0.01])
  add(r.chest, box(0.09, 0.13, 0.03), m.main, [0, 0.35, 0.135])
  for (const arm of [r.armL, r.armR]) {
    add(arm.root, cyl(0.072, 0.062, 0.3, 6), m.accent, [0, -0.15, 0])
    add(arm.mid, cyl(0.062, 0.056, 0.27, 6), m.accent, [0, -0.135, 0])
  }

  // шляпа надвинута на глаза, длинные волосы
  const hat = joint(r.head, [0, 0.08, 0], [10, 0, 0])
  add(hat, cyl(0.31, 0.31, 0.02, 14), m.accent)
  add(hat, cyl(0.115, 0.135, 0.15, 10), m.accent, [0, 0.08, 0])
  add(r.head, box(0.2, 0.3, 0.06), m.accent, [0, -0.12, -0.09])

  // пистолеты продолжают линию предплечья
  for (const arm of [r.armL, r.armR]) {
    add(arm.end, box(0.045, 0.44, 0.075), m.main, [0, -0.27, 0.02])
    add(arm.end, box(0.04, 0.1, 0.07), m.accent, [0, -0.07, -0.05], [25, 0, 0])
  }
  const figure = ground(r)
  figure.scale.setScalar(1.05)
  return figure
}

/** Статуэтка по ключу титана; неизвестному ключу достаётся спартанец. */
export function buildStatue(key: string, materials: StatueMaterials): Group {
  switch (key) {
    case 'strength':
      return viking(materials)
    case 'agility':
      return samurai(materials)
    case 'burst':
      return hunter(materials)
    case 'flexibility':
      return gunslinger(materials)
    default:
      return spartan(materials)
  }
}
