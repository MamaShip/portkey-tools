// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Li Song (keyin)
//
// 字体清单：哪个字体覆盖哪些字符、去哪下载。catalog.json 由 keyin 仓库的
// tools/build_font_catalog.py 生成，按回退顺序排列：第一个覆盖某字符的字体就用它。

import raw from "./catalog.json";

interface RawFont {
  id: string;
  name?: string;
  repo: string;
  commit: string;
  path: string;
  size: number;
  sha256: string;
  bundled?: string;
  faces?: Record<string, number>;
  variations?: Record<string, number>;
  ranges: [number, number][];
}

/** 字体文件在 Wasabi 上的位置：tools/keyin/fonts/<commit 前 12 位>/<文件名>（见 docs/object-storage.md） */
export const FONT_MIRROR =
  "https://s3.ap-southeast-1.wasabisys.com/portkey/tools/keyin/fonts";

export class CatalogFont {
  readonly id: string;
  readonly name: string;
  readonly repo: string;
  readonly commit: string;
  readonly path: string;
  readonly size: number;
  readonly sha256: string;
  readonly bundled: boolean;
  /** 语言 → TTC 里的字面序号（只有中日韩字体有） */
  readonly faces: Record<string, number>;
  readonly variations: Record<string, number>;
  private readonly starts: number[];
  private readonly ends: number[];

  constructor(r: RawFont) {
    this.id = r.id;
    this.name = r.name ?? r.id;
    this.repo = r.repo;
    this.commit = r.commit;
    this.path = r.path;
    this.size = r.size;
    this.sha256 = r.sha256;
    this.bundled = Boolean(r.bundled);
    this.faces = r.faces ?? {};
    this.variations = r.variations ?? {};
    this.starts = r.ranges.map((x) => x[0]);
    this.ends = r.ranges.map((x) => x[1]);
  }

  covers(cp: number) {
    // 二分：最后一个 start <= cp 的区间
    let lo = 0;
    let hi = this.starts.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.starts[mid] <= cp) lo = mid + 1;
      else hi = mid;
    }
    return lo > 0 && cp <= this.ends[lo - 1];
  }

  get filename() {
    return this.path.slice(this.path.lastIndexOf("/") + 1);
  }

  get isCjk() {
    return Object.keys(this.faces).length > 0;
  }

  /** 镜像上的对象 key（相对 FONT_MIRROR） */
  get mirrorKey() {
    return `${this.commit.slice(0, 12)}/${this.filename}`;
  }

  /** 下载地址，按顺序尝试；都指向同一个固定提交的文件，下载后校验 sha256 */
  get urls() {
    const path = this.path.split("/").map(encodeURIComponent).join("/");
    const key = this.mirrorKey.split("/").map(encodeURIComponent).join("/");
    return [
      `${FONT_MIRROR}/${key}`,
      `https://raw.githubusercontent.com/${this.repo}/${this.commit}/${path}`,
      `https://cdn.jsdelivr.net/gh/${this.repo}@${this.commit}/${path}`,
    ];
  }
}

export const catalog: readonly CatalogFont[] = (raw.fonts as RawFont[]).map(
  (f) => new CatalogFont(f),
);

/** 第一个覆盖该码位的清单字体 */
export function fontFor(cp: number) {
  return catalog.find((f) => f.covers(cp));
}
