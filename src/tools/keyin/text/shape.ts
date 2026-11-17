// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Li Song (keyin)
//
// 文字 → 像素掩码，任何文字都行。移植自 keyin/text/shape.py：
// 1. 分段：切成「同一字体、同一嵌入层级」的段
// 2. 重排：按 Unicode 双向算法把段排成视觉顺序（简化到段级）
// 3. 整形：HarfBuzz 处理连写（阿拉伯文）、重排（印度系）、组合符、字距
// 4. 填充：字形轮廓压平成折线，按非零环绕规则填充

import * as hb from "harfbuzzjs";
import type { Mask } from "../model/mesh";
import { embeddingLevels, sticks, visualOrder } from "./bidi";
import { catalog, type CatalogFont } from "./catalog";
import { FontDownloadError, loadFontData, type ProgressFn } from "./fonts";

/** 行框高度，单位 em；Noto Sans 的上伸部 1069、下伸部 293（每 1000） */
const ASCENT = 1.069;
const DESCENT = 0.293;

type Ranges = readonly (readonly [number, number])[];
const KANA: Ranges = [
  [0x3040, 0x30ff],
  [0x31f0, 0x31ff],
  [0xff66, 0xff9f],
];
const HANGUL: Ranges = [
  [0x1100, 0x11ff],
  [0x3130, 0x318f],
  [0xa960, 0xa97f],
  [0xac00, 0xd7af],
];
const hasAny = (text: string, ranges: Ranges) =>
  Array.from(text).some((ch) => {
    const cp = ch.codePointAt(0)!;
    return ranges.some(([a, b]) => a <= cp && cp <= b);
  });

export type HanFace = "ja" | "ko" | "zh-Hans" | "zh-Hant" | "zh-HK";

// --- 语言 -----------------------------------------------------------------

/** BCP 47 / 地区标签 → 想要的中日韩字面，认不出时为 null */
export function normalizeLang(tag: string | null | undefined): HanFace | null {
  if (!tag) return null;
  const t = tag.replace(/_/g, "-").split(".")[0].toLowerCase();
  if (t.startsWith("ja")) return "ja";
  if (t.startsWith("ko")) return "ko";
  if (t.startsWith("zh")) {
    if (/hk|mo/.test(t)) return "zh-HK";
    if (/hant|tw/.test(t)) return "zh-Hant";
    return "zh-Hans";
  }
  return null;
}

/**
 * 同一个汉字在简体、繁体、香港、日本、韩国写法不同。依次看：明确指定的语言、
 * 文字里的假名 / 韩文字母、浏览器语言，最后默认简体中文。
 */
export function hanFace(
  text: string,
  lang?: string | null,
  uiLang?: string | null,
): HanFace {
  return (
    normalizeLang(lang) ??
    (hasAny(text, KANA) ? "ja" : null) ??
    (hasAny(text, HANGUL) ? "ko" : null) ??
    normalizeLang(uiLang) ??
    "zh-Hans"
  );
}

// --- 字体 -----------------------------------------------------------------

class LoadedFont {
  readonly face: hb.Face;
  readonly font: hb.Font;
  readonly upem: number;
  private readonly unicodes: Set<number>;

  constructor(
    readonly name: string,
    data: ArrayBuffer,
    index: number,
    variations: Record<string, number>,
    /** 地区化的中日韩字面也需要语言标签，才能启用 locl 特性 */
    readonly lang: string | null,
  ) {
    this.face = new hb.Face(new hb.Blob(data), index);
    this.font = new hb.Font(this.face);
    const vars = Object.entries(variations).map(
      ([tag, v]) => new hb.Variation(tag, v),
    );
    if (vars.length) this.font.setVariations(vars);
    this.upem = this.face.upem;
    this.unicodes = new Set(this.face.collectUnicodes());
  }

  covers(cp: number) {
    return this.unicodes.has(cp);
  }
}

/** 给每个字符挑字体，第一次用到时才下载 */
export class FontChain {
  readonly cjkLang: HanFace;
  readonly warnings: string[] = [];
  private readonly loaded = new Map<string, LoadedFont>();
  private readonly failed = new Set<string>();

  constructor(
    text: string,
    readonly lang: string | null,
    uiLang: string | null,
    private readonly onProgress?: ProgressFn,
  ) {
    this.cjkLang = hanFace(text, lang, uiLang);
  }

  private async load(entry: CatalogFont) {
    let font = this.loaded.get(entry.id);
    if (!font) {
      const data = await loadFontData(entry, this.onProgress);
      const index = entry.isCjk ? (entry.faces[this.cjkLang] ?? 0) : 0;
      font = new LoadedFont(
        entry.name,
        data,
        index,
        entry.variations,
        entry.isCjk ? this.cjkLang : null,
      );
      this.loaded.set(entry.id, font);
    }
    return font;
  }

  /** 覆盖该码位的字体；没有字体覆盖时为 null */
  async pick(cp: number): Promise<LoadedFont | null> {
    for (const entry of catalog) {
      if (this.failed.has(entry.id) || !entry.covers(cp)) continue;
      try {
        return await this.load(entry);
      } catch (e) {
        if (!(e instanceof FontDownloadError)) throw e;
        this.failed.add(entry.id);
        this.warnings.push(e.message);
      }
    }
    return null;
  }

  default() {
    return this.load(catalog[0]);
  }
}

// --- 分段 ------------------------------------------------------------------

interface Run {
  text: string;
  font: LoadedFont;
  level: number;
}

async function itemize(text: string, chain: FontChain): Promise<Run[]> {
  const chars = Array.from(text);
  const { levels } = embeddingLevels(chars);
  const runs: Run[] = [];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const cp = ch.codePointAt(0)!;
    const current = runs.at(-1);
    let font: LoadedFont | null = null;
    if (current && sticks(ch) && current.font.covers(cp)) font = current.font;
    font ??= await chain.pick(cp);
    if (!font) {
      if (sticks(ch) && current) {
        font = current.font; // 比如没人收录的连接符：无害
      } else {
        const hex = cp.toString(16).toUpperCase().padStart(4, "0");
        chain.warnings.push(`没有字体收录 U+${hex}「${ch}」，它会印成一个方框`);
        font = await chain.default();
      }
    }
    if (current && current.font === font && current.level === levels[i])
      current.text += ch;
    else runs.push({ text: ch, font, level: levels[i] });
  }
  return runs;
}

// --- 轮廓 ------------------------------------------------------------------

type Contour = number[]; // x0, y0, x1, y1, ...

const steps = (length: number) =>
  Math.max(2, Math.min(32, Math.floor(length / 1.5) + 1));

/** 字形轮廓 → 像素坐标下的折线（y 向上） */
function flatten(
  cmds: hb.SvgPathCommand[],
  s: number,
  dx: number,
  dy: number,
): Contour[] {
  const contours: Contour[] = [];
  let cur: Contour = [];
  const close = () => {
    if (cur.length > 4) contours.push(cur);
    cur = [];
  };
  const px = (x: number) => dx + x * s;
  const py = (y: number) => dy + y * s;
  for (const { type, values: v } of cmds) {
    const sx = cur[cur.length - 2];
    const sy = cur[cur.length - 1];
    if (type === "M") {
      close();
      cur.push(px(v[0]), py(v[1]));
    } else if (type === "L") {
      cur.push(px(v[0]), py(v[1]));
    } else if (type === "Q") {
      const [cx, cy, ex, ey] = [px(v[0]), py(v[1]), px(v[2]), py(v[3])];
      const n = steps(
        Math.hypot(cx - sx, cy - sy) + Math.hypot(ex - cx, ey - cy),
      );
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        const u = 1 - t;
        cur.push(
          u * u * sx + 2 * u * t * cx + t * t * ex,
          u * u * sy + 2 * u * t * cy + t * t * ey,
        );
      }
    } else if (type === "C") {
      const [ax, ay, bx, by, ex, ey] = [
        px(v[0]),
        py(v[1]),
        px(v[2]),
        py(v[3]),
        px(v[4]),
        py(v[5]),
      ];
      const n = steps(
        Math.hypot(ax - sx, ay - sy) +
          Math.hypot(bx - ax, by - ay) +
          Math.hypot(ex - bx, ey - by),
      );
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        const u = 1 - t;
        cur.push(
          u * u * u * sx +
            3 * u * u * t * ax +
            3 * u * t * t * bx +
            t * t * t * ex,
          u * u * u * sy +
            3 * u * u * t * ay +
            3 * u * t * t * by +
            t * t * t * ey,
        );
      }
    } else if (type === "Z") {
      close();
    }
  }
  close();
  return contours;
}

/** 把每个像素中心环绕数非零的像素置 1（y 向上，第 0 行在最下方） */
export function fillNonzero(contours: Contour[], mask: Mask) {
  const { width: w, height: h, data } = mask;
  let ymin = Infinity;
  let ymax = -Infinity;
  for (const c of contours) {
    for (let i = 1; i < c.length; i += 2) {
      ymin = Math.min(ymin, c[i]);
      ymax = Math.max(ymax, c[i]);
    }
  }
  const r0 = Math.max(0, Math.floor(ymin));
  const r1 = Math.min(h, Math.ceil(ymax) + 1);
  const xs: number[] = [];
  const ws: number[] = [];
  for (let r = r0; r < r1; r++) {
    const y = r + 0.5;
    xs.length = 0;
    ws.length = 0;
    for (const c of contours) {
      const n = c.length;
      for (let i = 0; i < n; i += 2) {
        const x0 = c[i];
        const y0 = c[i + 1];
        const x1 = c[(i + 2) % n];
        const y1 = c[(i + 3) % n];
        const up = y0 <= y && y1 > y;
        const down = y1 <= y && y0 > y;
        if (!up && !down) continue;
        xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
        ws.push(up ? 1 : -1);
      }
    }
    if (!xs.length) continue;
    const order = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b]);
    let wind = 0;
    for (let k = 0; k + 1 < order.length; k++) {
      wind += ws[order[k]];
      if (!wind) continue;
      const left = xs[order[k]];
      const right = xs[order[k + 1]];
      // 像素中心 c + 0.5 落在 [left, right) 里
      const c0 = Math.max(0, Math.ceil(left - 0.5));
      const c1 = Math.min(w - 1, Math.ceil(right - 0.5) - 1);
      for (let col = c0; col <= c1; col++) data[r * w + col] = 1;
    }
  }
}

// --- 对外 ------------------------------------------------------------------

export interface RenderOptions {
  lang?: string | null;
  /** 浏览器界面语言，用来猜汉字写法 */
  uiLang?: string | null;
  onProgress?: ProgressFn;
}

/**
 * 栅格化一行文字。掩码第 0 行在最下方；所有文字的行框都是 lineHeightMm 高，
 * 所以共用同一条基线。没有可见笔画时 mask 为 null。
 */
export async function renderTextMask(
  text: string,
  lineHeightMm: number,
  pixelsPerMm: number,
  opts: RenderOptions = {},
): Promise<{ mask: Mask | null; mmPerPx: number; warnings: string[] }> {
  const chain = new FontChain(
    text,
    opts.lang ?? null,
    opts.uiLang ?? null,
    opts.onProgress,
  );
  const runs = visualOrder(await itemize(text, chain));
  const emPx = (lineHeightMm * pixelsPerMm) / (ASCENT + DESCENT);
  const baseline = DESCENT * emPx;
  const glyphs: Contour[][] = [];
  let penX = 0;
  for (const run of runs) {
    const buf = new hb.Buffer();
    buf.addText(run.text);
    buf.guessSegmentProperties();
    buf.setDirection(run.level % 2 ? hb.Direction.RTL : hb.Direction.LTR);
    const lang = run.font.lang ?? chain.lang;
    if (lang) buf.setLanguage(lang);
    hb.shape(run.font.font, buf);
    const s = emPx / run.font.upem;
    const infos = buf.getGlyphInfos();
    const positions = buf.getGlyphPositions();
    infos.forEach((info, i) => {
      const pos = positions[i];
      const cmds = run.font.font.glyphToJson(info.codepoint);
      const contours = flatten(
        cmds,
        s,
        penX + pos.xOffset * s,
        baseline + pos.yOffset * s,
      );
      if (contours.length) glyphs.push(contours);
      penX += pos.xAdvance * s;
    });
  }
  const warnings = [...new Set(chain.warnings)];
  if (!glyphs.length) return { mask: null, mmPerPx: 0, warnings };

  let minX = 0;
  let minY = 0;
  let maxX = penX;
  let maxY = emPx * (ASCENT + DESCENT);
  for (const cs of glyphs) {
    for (const c of cs) {
      for (let i = 0; i < c.length; i += 2) {
        minX = Math.min(minX, c[i]);
        maxX = Math.max(maxX, c[i]);
        minY = Math.min(minY, c[i + 1]);
        maxY = Math.max(maxY, c[i + 1]);
      }
    }
  }
  const pad = 2;
  const shiftX = pad - minX;
  const shiftY = pad - minY;
  const width = Math.ceil(maxX + shiftX) + pad;
  const height = Math.ceil(maxY + shiftY) + pad;
  const full: Mask = { width, height, data: new Uint8Array(width * height) };
  for (const cs of glyphs) {
    fillNonzero(
      cs.map((c) => c.map((v, i) => v + (i % 2 ? shiftY : shiftX))),
      full,
    );
  }

  // 纵向保留完整行框（共用基线），横向裁到笔画
  let c0 = width;
  let c1 = -1;
  let i0 = height;
  let i1 = -1;
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (!full.data[r * width + c]) continue;
      c0 = Math.min(c0, c);
      c1 = Math.max(c1, c);
      i0 = Math.min(i0, r);
      i1 = Math.max(i1, r);
    }
  }
  if (c1 < 0) return { mask: null, mmPerPx: 0, warnings };
  const topOfBox = Math.round(shiftY + emPx * (ASCENT + DESCENT));
  const r0 = Math.min(Math.round(shiftY), i0);
  const r1 = Math.max(topOfBox, i1 + 1);
  const w = c1 - c0 + 1;
  const h = r1 - r0;
  const data = new Uint8Array(w * h);
  for (let r = 0; r < h; r++) {
    data.set(
      full.data.subarray((r0 + r) * width + c0, (r0 + r) * width + c0 + w),
      r * w,
    );
  }
  return {
    mask: { width: w, height: h, data },
    mmPerPx: 1 / pixelsPerMm,
    warnings,
  };
}
