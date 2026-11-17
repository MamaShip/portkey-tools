// SPDX-License-Identifier: MIT
// Copyright (c) 2021 yihong (GitHubPoster, https://github.com/yihong0618/GitHubPoster)
// Copyright (c) 2026 Li Song (keyin)
//
// Skyline 模型：一年的每日数据 → 可打印的 STL。移植自 keyin/model/skyline.py，
// 设计源自 GitHubPoster 的 skyline（MIT）。

import {
  BASE_HEIGHT,
  BASE_LENGTH,
  BASE_TOP_LENGTH,
  BASE_TOP_WIDTH,
  BASE_WIDTH,
  BOX_DIMENSION,
  BOX_GAP,
  BOX_MAX_HEIGHT,
  BOX_MIN_HEIGHT,
  EMBED_DEPTH,
  TEXT_DEPTH,
  TEXT_GAP,
  TEXT_LINE_HEIGHT,
  TEXT_MARGIN,
  TEXT_PIXELS_PER_MM,
} from "./config";
import { box, extrudeMask, frustum, Triangles, type Mask } from "./mesh";

export type Scale = "linear" | "sqrt" | "log";

/** 每日数值在做最小-最大归一化之前的映射；sqrt / log 压平长尾数据（如 token 数） */
export const SCALES: Record<Scale, (v: number) => number> = {
  linear: (v) => v,
  sqrt: Math.sqrt,
  log: Math.log1p,
};

/** 一行文字的栅格；null 表示没有可见笔画 */
export type RenderedText = { mask: Mask; mmPerPx: number } | null;
export type TextRenderer = (
  text: string,
  lineHeightMm: number,
  pixelsPerMm: number,
) => Promise<RenderedText>;

export interface SkylineInput {
  year: number;
  label: string;
  userName: string;
  /** "YYYY-MM-DD" → 数值；其他年份的键会被忽略 */
  values: Record<string, number>;
  scale: Scale;
}

const INSET_X = (BASE_LENGTH - BASE_TOP_LENGTH) / 2;
const INSET_Y = (BASE_WIDTH - BASE_TOP_WIDTH) / 2;

/** 每日数值 → 柱高（BOX_MIN..BOX_MAX） */
export function boxHeights(input: SkylineInput): Map<string, number> {
  const f = SCALES[input.scale];
  const prefix = `${input.year}-`;
  const scaled = new Map<string, number>();
  for (const [day, v] of Object.entries(input.values)) {
    if (day.startsWith(prefix) && v > 0) scaled.set(day, f(v));
  }
  if (!scaled.size) return scaled;
  const all = [...scaled.values()];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = BOX_MAX_HEIGHT - BOX_MIN_HEIGHT;
  const out = new Map<string, number>();
  for (const [day, v] of scaled) {
    out.set(
      day,
      hi === lo
        ? BOX_MAX_HEIGHT
        : BOX_MIN_HEIGHT + (span * (v - lo)) / (hi - lo),
    );
  }
  return out;
}

function dayIndex(year: number, day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return Math.round(
    (Date.UTC(y, m - 1, d) - Date.UTC(year, 0, 1)) / 86_400_000,
  );
}

/**
 * 每天一根柱子，排布同贡献日历：周从左到右，周日在最后一排，周六在最前一排。
 */
function addBoxes(out: Triangles, input: SkylineInput) {
  const { year } = input;
  const days = dayIndex(year, `${year + 1}-01-01`);
  const offset = new Date(Date.UTC(year, 0, 1)).getUTCDay(); // 周日 = 0
  const cols = Math.floor((days + offset + 6) / 7);
  // 网格居中放在底座顶面上
  const gx = INSET_X + (BASE_TOP_LENGTH - cols * BOX_DIMENSION) / 2;
  const gy = INSET_Y + (BASE_TOP_WIDTH - 7 * BOX_DIMENSION) / 2;
  const half = BOX_GAP / 2;
  for (const [day, height] of boxHeights(input)) {
    const idx = dayIndex(year, day) + offset;
    const col = Math.floor(idx / 7);
    const row = 6 - (idx % 7);
    box(
      out,
      gx + col * BOX_DIMENSION + half,
      gy + row * BOX_DIMENSION + half,
      gx + (col + 1) * BOX_DIMENSION - half,
      gy + (row + 1) * BOX_DIMENSION - half,
      BASE_HEIGHT - EMBED_DEPTH,
      BASE_HEIGHT + height,
    );
  }
}

/** 把一行文字的掩码压印到底座前斜面上，从 x 处开始 */
function addCard(out: Triangles, mask: Mask, mmPerPx: number, xStart: number) {
  const local = new Triangles(mask.width * mask.height);
  extrudeMask(local, mask, mmPerPx, 0, TEXT_DEPTH + EMBED_DEPTH);
  // 局部坐标 → 前斜面：x 沿底座，y 沿斜面向上，z 朝外
  const slope = Math.hypot(INSET_Y, BASE_HEIGHT);
  const up = [0, INSET_Y / slope, BASE_HEIGHT / slope];
  const outward = [0, -BASE_HEIGHT / slope, INSET_Y / slope];
  const cardHeight = mask.height * mmPerPx;
  local.transform((x, y, z) => {
    const u = y + (slope - cardHeight) / 2;
    const w = z - EMBED_DEPTH;
    return [x + xStart, u * up[1] + w * outward[1], u * up[2] + w * outward[2]];
  });
  out.append(local);
}

async function addCards(
  out: Triangles,
  input: SkylineInput,
  render: TextRenderer,
) {
  const texts = [input.label, input.userName, String(input.year)];
  const rendered: RenderedText[] = [];
  for (const t of texts) {
    rendered.push(
      t.trim() ? await render(t, TEXT_LINE_HEIGHT, TEXT_PIXELS_PER_MM) : null,
    );
  }
  const width = (r: RenderedText) => (r ? r.mask.width * r.mmPerPx : 0);
  const [label, name, year] = rendered;
  const left = TEXT_MARGIN;
  const right = BASE_LENGTH - TEXT_MARGIN;
  if (label) addCard(out, label.mask, label.mmPerPx, left);
  if (year) addCard(out, year.mask, year.mmPerPx, right - width(year));
  if (name) {
    const nameLeft = left + width(label) + TEXT_GAP;
    const room = right - width(year) - TEXT_GAP - nameLeft;
    if (room <= 0) throw new Error("平台名太长，已经没有地方放名字了");
    // 名字太长时缩小，保证不会撞上年份
    const s =
      width(name) > room ? (name.mmPerPx * room) / width(name) : name.mmPerPx;
    addCard(out, name.mask, s, nameLeft);
  }
}

/** 构建整个模型，返回平铺的三角形顶点 */
export async function buildSkyline(input: SkylineInput, render: TextRenderer) {
  const out = new Triangles(64 * 1024);
  frustum(
    out,
    [0, 0, BASE_LENGTH, BASE_WIDTH],
    [INSET_X, INSET_Y, BASE_LENGTH - INSET_X, BASE_WIDTH - INSET_Y],
    0,
    BASE_HEIGHT,
  );
  addBoxes(out, input);
  await addCards(out, input, render);
  return out.toArray();
}
