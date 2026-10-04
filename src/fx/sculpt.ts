import { BufferGeometry, Float32BufferAttribute, Matrix4, Vector3 } from 'three'
import { edgeTable, triTable } from 'three/examples/jsm/objects/MarchingCubes.js'

// в описании типов таблицы названы массивами массивов, на деле это два плоских массива чисел
const EDGES = edgeTable as unknown as Int32Array
const TRIS = triTable as unknown as Int32Array

type V3 = [number, number, number]

/** Кусок «глины»: эллипсоид или кость — капсула с разными радиусами на концах. */
export type Lump =
  | { kind: 'ball'; at: V3; r: V3 | number }
  | { kind: 'bone'; a: V3; b: V3; ra: number; rb: number }

const FAR = 1
// вершины куба и пары вершин на каждом из 12 рёбер — в порядке, которого ждут таблицы
const CORNER = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]
const EDGE_ENDS = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]

/**
 * Лепка из одного куска. Тело описывается как набор мягко сливающихся комков (поле расстояний на сетке),
 * а потом с поля снимается сплошная поверхность — без швов и стыков между частями, как у литой фигуры.
 * То же поле отвечает, насколько точка зажата соседними формами: из этого получаются тени в складках.
 */
export class Clay {
  private nx: number
  private ny: number
  private nz: number
  private data: Float32Array
  private inverse = new Matrix4()

  constructor(
    private min: Vector3,
    max: Vector3,
    private cell: number,
  ) {
    this.nx = Math.ceil((max.x - min.x) / cell) + 1
    this.ny = Math.ceil((max.y - min.y) / cell) + 1
    this.nz = Math.ceil((max.z - min.z) / cell) + 1
    this.data = new Float32Array(this.nx * this.ny * this.nz).fill(FAR)
  }

  /** Прилепить комок: k — насколько плавно он сливается с уже вылепленным. */
  add(frame: Matrix4 | null, lump: Lump, k = 0.03): void {
    this.apply(frame, lump, k, false)
  }

  /** Вынуть комок: углубление с мягкими краями. */
  carve(frame: Matrix4 | null, lump: Lump, k = 0.012): void {
    this.apply(frame, lump, k, true)
  }

  private apply(frame: Matrix4 | null, lump: Lump, k: number, carve: boolean): void {
    // границы комка в его собственных координатах, с запасом на слияние
    const lo: V3 = [0, 0, 0]
    const hi: V3 = [0, 0, 0]
    let rx = 0
    let ry = 0
    let rz = 0
    let thin = 0
    if (lump.kind === 'ball') {
      ;[rx, ry, rz] = typeof lump.r === 'number' ? [lump.r, lump.r, lump.r] : lump.r
      thin = Math.min(rx, ry, rz)
      const r = [rx, ry, rz]
      for (let i = 0; i < 3; i++) {
        lo[i] = lump.at[i] - r[i] - k
        hi[i] = lump.at[i] + r[i] + k
      }
    } else {
      const r = Math.max(lump.ra, lump.rb) + k
      for (let i = 0; i < 3; i++) {
        lo[i] = Math.min(lump.a[i], lump.b[i]) - r
        hi[i] = Math.max(lump.a[i], lump.b[i]) + r
      }
    }

    // те же границы в координатах сетки
    let x0 = Infinity
    let y0 = Infinity
    let z0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    let z1 = -Infinity
    const corner = new Vector3()
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2])
      if (frame) corner.applyMatrix4(frame)
      x0 = Math.min(x0, corner.x)
      y0 = Math.min(y0, corner.y)
      z0 = Math.min(z0, corner.z)
      x1 = Math.max(x1, corner.x)
      y1 = Math.max(y1, corner.y)
      z1 = Math.max(z1, corner.z)
    }
    const c = this.cell
    const ix0 = Math.max(0, Math.floor((x0 - this.min.x) / c))
    const iy0 = Math.max(0, Math.floor((y0 - this.min.y) / c))
    const iz0 = Math.max(0, Math.floor((z0 - this.min.z) / c))
    const ix1 = Math.min(this.nx - 1, Math.ceil((x1 - this.min.x) / c))
    const iy1 = Math.min(this.ny - 1, Math.ceil((y1 - this.min.y) / c))
    const iz1 = Math.min(this.nz - 1, Math.ceil((z1 - this.min.z) / c))

    const e = frame ? this.inverse.copy(frame).invert().elements : null
    for (let iz = iz0; iz <= iz1; iz++) {
      const wz = this.min.z + iz * c
      for (let iy = iy0; iy <= iy1; iy++) {
        const wy = this.min.y + iy * c
        let index = (iz * this.ny + iy) * this.nx + ix0
        for (let ix = ix0; ix <= ix1; ix++, index++) {
          const wx = this.min.x + ix * c
          const px = e ? e[0] * wx + e[4] * wy + e[8] * wz + e[12] : wx
          const py = e ? e[1] * wx + e[5] * wy + e[9] * wz + e[13] : wy
          const pz = e ? e[2] * wx + e[6] * wy + e[10] * wz + e[14] : wz
          let d: number
          if (lump.kind === 'ball') {
            const qx = (px - lump.at[0]) / rx
            const qy = (py - lump.at[1]) / ry
            const qz = (pz - lump.at[2]) / rz
            d = (Math.sqrt(qx * qx + qy * qy + qz * qz) - 1) * thin
          } else {
            const ax = px - lump.a[0]
            const ay = py - lump.a[1]
            const az = pz - lump.a[2]
            const bx = lump.b[0] - lump.a[0]
            const by = lump.b[1] - lump.a[1]
            const bz = lump.b[2] - lump.a[2]
            const t = Math.min(1, Math.max(0, (ax * bx + ay * by + az * bz) / (bx * bx + by * by + bz * bz || 1)))
            const dx = ax - bx * t
            const dy = ay - by * t
            const dz = az - bz * t
            d = Math.sqrt(dx * dx + dy * dy + dz * dz) - (lump.ra + (lump.rb - lump.ra) * t)
          }
          const old = this.data[index]
          if (carve) {
            // вычитание — то же мягкое слияние, только «наизнанку»
            const h = Math.max(k - Math.abs(old + d), 0) / k
            this.data[index] = Math.max(old, -d) + h * h * k * 0.25
          } else {
            const h = Math.max(k - Math.abs(old - d), 0) / k
            this.data[index] = Math.min(old, d) - h * h * k * 0.25
          }
        }
      }
    }
  }

  /** Расстояние до поверхности в произвольной точке; вне сетки — «далеко». */
  sample(x: number, y: number, z: number): number {
    const gx = (x - this.min.x) / this.cell
    const gy = (y - this.min.y) / this.cell
    const gz = (z - this.min.z) / this.cell
    const ix = Math.floor(gx)
    const iy = Math.floor(gy)
    const iz = Math.floor(gz)
    if (ix < 0 || iy < 0 || iz < 0 || ix >= this.nx - 1 || iy >= this.ny - 1 || iz >= this.nz - 1) return FAR
    const fx = gx - ix
    const fy = gy - iy
    const fz = gz - iz
    const d = this.data
    const row = this.nx
    const slab = this.nx * this.ny
    const i = iz * slab + iy * row + ix
    const lower = (d[i] * (1 - fx) + d[i + 1] * fx) * (1 - fy) + (d[i + row] * (1 - fx) + d[i + row + 1] * fx) * fy
    const upper = (d[i + slab] * (1 - fx) + d[i + slab + 1] * fx) * (1 - fy) + (d[i + slab + row] * (1 - fx) + d[i + slab + row + 1] * fx) * fy
    return lower * (1 - fz) + upper * fz
  }

  /** Снять поверхность с поля: треугольники с гладкими нормалями (способ «шагающих кубиков»). */
  build(): BufferGeometry {
    const { nx, ny, nz, data, cell, min } = this
    const row = nx
    const slab = nx * ny
    const positions: number[] = []
    const normals: number[] = []
    const value = new Float32Array(8)
    const px = new Float32Array(12)
    const py = new Float32Array(12)
    const pz = new Float32Array(12)
    const gx = new Float32Array(12)
    const gy = new Float32Array(12)
    const gz = new Float32Array(12)
    const at = (x: number, y: number, z: number): number =>
      data[Math.min(nz - 1, Math.max(0, z)) * slab + Math.min(ny - 1, Math.max(0, y)) * row + Math.min(nx - 1, Math.max(0, x))]

    for (let z = 0; z < nz - 1; z++) {
      for (let y = 0; y < ny - 1; y++) {
        for (let x = 0; x < nx - 1; x++) {
          const i = z * slab + y * row + x
          value[0] = data[i]
          value[1] = data[i + 1]
          value[2] = data[i + row + 1]
          value[3] = data[i + row]
          value[4] = data[i + slab]
          value[5] = data[i + slab + 1]
          value[6] = data[i + slab + row + 1]
          value[7] = data[i + slab + row]
          let cube = 0
          for (let v = 0; v < 8; v++) if (value[v] < 0) cube |= 1 << v
          const bits = EDGES[cube]
          if (!bits) continue

          for (let edge = 0; edge < 12; edge++) {
            if (!(bits & (1 << edge))) continue
            const [a, b] = EDGE_ENDS[edge]
            const t = value[a] / (value[a] - value[b])
            const ax = x + CORNER[a][0]
            const ay = y + CORNER[a][1]
            const az = z + CORNER[a][2]
            const bx = x + CORNER[b][0]
            const by = y + CORNER[b][1]
            const bz = z + CORNER[b][2]
            px[edge] = min.x + (ax + (bx - ax) * t) * cell
            py[edge] = min.y + (ay + (by - ay) * t) * cell
            pz[edge] = min.z + (az + (bz - az) * t) * cell
            // нормаль — направление, в котором поле растёт: считаем в двух узлах ребра и смешиваем
            const nxA = at(ax + 1, ay, az) - at(ax - 1, ay, az)
            const nyA = at(ax, ay + 1, az) - at(ax, ay - 1, az)
            const nzA = at(ax, ay, az + 1) - at(ax, ay, az - 1)
            const nxB = at(bx + 1, by, bz) - at(bx - 1, by, bz)
            const nyB = at(bx, by + 1, bz) - at(bx, by - 1, bz)
            const nzB = at(bx, by, bz + 1) - at(bx, by, bz - 1)
            let ex = nxA + (nxB - nxA) * t
            let ey = nyA + (nyB - nyA) * t
            let ez = nzA + (nzB - nzA) * t
            const length = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1
            ex /= length
            ey /= length
            ez /= length
            gx[edge] = ex
            gy[edge] = ey
            gz[edge] = ez
          }

          for (let t = cube * 16; TRIS[t] !== -1; t += 3) {
            const a = TRIS[t]
            let b = TRIS[t + 1]
            let c = TRIS[t + 2]
            // обход вершин должен совпадать с нормалью, иначе свет ляжет наизнанку
            const ux = px[b] - px[a]
            const uy = py[b] - py[a]
            const uz = pz[b] - pz[a]
            const vx = px[c] - px[a]
            const vy = py[c] - py[a]
            const vz = pz[c] - pz[a]
            const facing = (uy * vz - uz * vy) * gx[a] + (uz * vx - ux * vz) * gy[a] + (ux * vy - uy * vx) * gz[a]
            if (facing < 0) [b, c] = [c, b]
            for (const e of [a, b, c]) {
              positions.push(px[e], py[e], pz[e])
              normals.push(gx[e], gy[e], gz[e])
            }
          }
        }
      }
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
    return geometry
  }
}

/**
 * Насколько точка открыта (1) или зажата соседними формами (к 0): смотрим, как быстро поле растёт
 * при отходе от поверхности по нормали. В складках и подмышках оно растёт медленно.
 */
export function openness(clays: Clay[], x: number, y: number, z: number, nx: number, ny: number, nz: number): number {
  let open = 1
  for (const step of [0.03, 0.09]) {
    let nearest = FAR
    for (const clay of clays) nearest = Math.min(nearest, clay.sample(x + nx * step, y + ny * step, z + nz * step))
    open = Math.min(open, nearest / step)
  }
  return Math.min(1, Math.max(0, open))
}
