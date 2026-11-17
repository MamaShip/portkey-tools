// SPDX-License-Identifier: MIT
// Copyright (c) 2021 yihong (GitHubPoster, https://github.com/yihong0618/GitHubPoster)
// Copyright (c) 2026 Li Song (keyin)
//
// 直接构造三角网格（不做体素采样），移植自 keyin/model/mesh.py。
// 这里产出的每个实体单独都是闭合的二维流形：每条边恰好被两个三角形共用。
// 实体之间可以相互重叠（柱子和文字嵌进底座），切片软件会合并重叠的壳，
// 但会拒绝非流形边。

export type Vec3 = readonly [number, number, number];

/** 三角形顶点，平铺存放：每个三角形 9 个数 */
export class Triangles {
  data: Float32Array;
  length = 0; // 已写入的浮点数个数

  constructor(capacity = 1024) {
    this.data = new Float32Array(capacity * 9);
  }

  get count() {
    return this.length / 9;
  }

  private reserve(n: number) {
    if (this.length + n <= this.data.length) return;
    let size = this.data.length * 2;
    while (size < this.length + n) size *= 2;
    const next = new Float32Array(size);
    next.set(this.data.subarray(0, this.length));
    this.data = next;
  }

  push(a: Vec3, b: Vec3, c: Vec3) {
    this.reserve(9);
    this.data.set(
      [a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]],
      this.length,
    );
    this.length += 9;
  }

  /** 四边形（角点按环绕顺序给出）绕期望的外法线逆时针排列后，拆成两个三角形 */
  quad(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, normal: Vec3) {
    const ux = p1[0] - p0[0];
    const uy = p1[1] - p0[1];
    const uz = p1[2] - p0[2];
    const vx = p2[0] - p0[0];
    const vy = p2[1] - p0[1];
    const vz = p2[2] - p0[2];
    const cx = uy * vz - uz * vy;
    const cy = uz * vx - ux * vz;
    const cz = ux * vy - uy * vx;
    if (cx * normal[0] + cy * normal[1] + cz * normal[2] < 0) {
      [p0, p1, p2, p3] = [p3, p2, p1, p0];
    }
    this.push(p0, p1, p2);
    this.push(p0, p2, p3);
  }

  append(other: Triangles) {
    this.reserve(other.length);
    this.data.set(other.data.subarray(0, other.length), this.length);
    this.length += other.length;
  }

  /** 对每个顶点做变换（原地） */
  transform(f: (x: number, y: number, z: number) => Vec3) {
    const d = this.data;
    for (let i = 0; i < this.length; i += 3) {
      const [x, y, z] = f(d[i], d[i + 1], d[i + 2]);
      d[i] = x;
      d[i + 1] = y;
      d[i + 2] = z;
    }
  }

  toArray() {
    return this.data.slice(0, this.length);
  }
}

type Rect = readonly [number, number, number, number];

/** 两个轴对齐矩形之间的闭合实体；矩形为 [x0, y0, x1, y1] */
export function frustum(
  out: Triangles,
  bottom: Rect,
  top: Rect,
  z0: number,
  z1: number,
) {
  const [bx0, by0, bx1, by1] = bottom;
  const [tx0, ty0, tx1, ty1] = top;
  const b: Vec3[] = [
    [bx0, by0, z0],
    [bx1, by0, z0],
    [bx1, by1, z0],
    [bx0, by1, z0],
  ];
  const t: Vec3[] = [
    [tx0, ty0, z1],
    [tx1, ty0, z1],
    [tx1, ty1, z1],
    [tx0, ty1, z1],
  ];
  const faces: Vec3[][] = [b, t];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    faces.push([b[i], b[j], t[j], t[i]]);
  }
  // 凸体：外法线 = 远离中心的方向
  const all = faces.flat();
  const mean = (pts: Vec3[], k: number) =>
    pts.reduce((s, p) => s + p[k], 0) / pts.length;
  const center = [mean(all, 0), mean(all, 1), mean(all, 2)];
  for (const f of faces) {
    const n: Vec3 = [
      mean(f, 0) - center[0],
      mean(f, 1) - center[1],
      mean(f, 2) - center[2],
    ];
    out.quad(f[0], f[1], f[2], f[3], n);
  }
}

/** 一个独立的闭合轴对齐长方体 */
export function box(
  out: Triangles,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  z0: number,
  z1: number,
) {
  out.quad([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [0, 0, -1]);
  out.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
  out.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
  out.quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0]);
  out.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
  out.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0]);
}

/** 二维像素掩码，按行存放（data[row * width + col]），第 0 行在最下方 */
export interface Mask {
  width: number;
  height: number;
  data: Uint8Array;
}

/**
 * 只在角上相接的两个像素会让一条竖边被四个面共用（非流形）。
 * 给每对这样的像素补上一个邻居，让它们通过整条边相连。只增不减，必然终止。
 */
export function closeDiagonals(mask: Mask): Mask {
  const { width: w, height: h } = mask;
  const m = mask.data.slice();
  for (;;) {
    // 与 Python 版一致：先找出本轮所有对角对，再统一补
    const fill: number[] = [];
    for (let r = 0; r + 1 < h; r++) {
      for (let c = 0; c + 1 < w; c++) {
        const a = m[r * w + c];
        const b = m[r * w + c + 1];
        const cc = m[(r + 1) * w + c];
        const d = m[(r + 1) * w + c + 1];
        if (a && d && !b && !cc) fill.push(r * w + c + 1);
        else if (b && cc && !a && !d) fill.push(r * w + c);
      }
    }
    if (!fill.length) return { width: w, height: h, data: m };
    for (const i of fill) m[i] = 1;
  }
}

/**
 * 把二维像素掩码挤出成 z0..z1 之间一个闭合的流形实体。
 * 面保持每像素 / 每条像素边一个，这样每条边恰好被两个面共用。
 */
export function extrudeMask(
  out: Triangles,
  mask: Mask,
  size: number,
  z0: number,
  z1: number,
) {
  const { width: w, height: h, data } = closeDiagonals(mask);
  const at = (r: number, c: number) =>
    r >= 0 && r < h && c >= 0 && c < w ? data[r * w + c] : 0;
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (!data[r * w + c]) continue;
      const x0 = c * size;
      const x1 = (c + 1) * size;
      const y0 = r * size;
      const y1 = (r + 1) * size;
      out.quad(
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
        [0, 0, 1],
      );
      out.quad(
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y1, z0],
        [x0, y1, z0],
        [0, 0, -1],
      );
    }
  }
  // 竖直网格线 x = c * size 上的墙（左像素 vs 右像素）
  for (let r = 0; r < h; r++) {
    for (let c = 0; c <= w; c++) {
      const left = at(r, c - 1);
      if (left === at(r, c)) continue;
      const x = c * size;
      const ya = r * size;
      const yb = (r + 1) * size;
      out.quad(
        [x, ya, z0],
        [x, yb, z0],
        [x, yb, z1],
        [x, ya, z1],
        [left ? 1 : -1, 0, 0],
      );
    }
  }
  // 水平网格线 y = r * size 上的墙（下像素 vs 上像素）
  for (let r = 0; r <= h; r++) {
    for (let c = 0; c < w; c++) {
      const below = at(r - 1, c);
      if (below === at(r, c)) continue;
      const y = r * size;
      const xa = c * size;
      const xb = (c + 1) * size;
      out.quad(
        [xa, y, z0],
        [xb, y, z0],
        [xb, y, z1],
        [xa, y, z1],
        [0, below ? 1 : -1, 0],
      );
    }
  }
}

/** 没有被恰好一对方向相反的半边共用的边的数量（0 = 流形） */
export function nonManifoldEdgeCount(tris: Float32Array, decimals = 4) {
  const f = 10 ** decimals;
  const ids = new Map<string, number>();
  const vid = (i: number) => {
    const k = `${Math.round(tris[i] * f)},${Math.round(tris[i + 1] * f)},${Math.round(tris[i + 2] * f)}`;
    let id = ids.get(k);
    if (id === undefined) {
      id = ids.size;
      ids.set(k, id);
    }
    return id;
  };
  const directed = new Map<string, number>();
  const undirected = new Map<string, number>();
  for (let t = 0; t < tris.length; t += 9) {
    const v = [vid(t), vid(t + 3), vid(t + 6)];
    for (let e = 0; e < 3; e++) {
      const a = v[e];
      const b = v[(e + 1) % 3];
      const dk = `${a}>${b}`;
      directed.set(dk, (directed.get(dk) ?? 0) + 1);
      const uk = a < b ? `${a}-${b}` : `${b}-${a}`;
      undirected.set(uk, (undirected.get(uk) ?? 0) + 1);
    }
  }
  let bad = 0;
  for (const n of undirected.values()) if (n !== 2) bad++;
  for (const n of directed.values()) if (n !== 1) bad++;
  return bad;
}

/** 二进制 STL：80 字节头、三角形个数、每个三角形 50 字节 */
export function binaryStl(
  tris: Float32Array,
  header = "keyin skyline",
): ArrayBuffer {
  const n = tris.length / 9;
  const buf = new ArrayBuffer(84 + n * 50);
  const view = new DataView(buf);
  new Uint8Array(buf, 0, 80).set(
    new TextEncoder().encode(header).subarray(0, 80),
  );
  view.setUint32(80, n, true);
  let o = 84;
  for (let t = 0; t < tris.length; t += 9) {
    const ux = tris[t + 3] - tris[t];
    const uy = tris[t + 4] - tris[t + 1];
    const uz = tris[t + 5] - tris[t + 2];
    const vx = tris[t + 6] - tris[t];
    const vy = tris[t + 7] - tris[t + 1];
    const vz = tris[t + 8] - tris[t + 2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len > 0) {
      nx /= len;
      ny /= len;
      nz /= len;
    }
    view.setFloat32(o, nx, true);
    view.setFloat32(o + 4, ny, true);
    view.setFloat32(o + 8, nz, true);
    o += 12;
    for (let k = 0; k < 9; k++, o += 4) view.setFloat32(o, tris[t + k], true);
    view.setUint16(o, 0, true);
    o += 2;
  }
  return buf;
}
