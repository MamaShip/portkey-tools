// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 进入页面时先展示的示例模型：一份固定的「像真的一样」的一年数据。
// 用定种子的伪随机数，每次打开都一样，README 里的截图也能对得上。
import type { SkylineInput } from "./model/skyline";
import type { DailyValues } from "./sources/daily";

export const EXAMPLE_YEAR = 2026;

/** mulberry32：小而稳定的伪随机数发生器 */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 工作日多、周末少，随季节起伏，偶尔休息几天、偶尔爆发一下 */
export function exampleValues(year = EXAMPLE_YEAR): DailyValues {
  const rand = rng(year);
  const values: DailyValues = {};
  const start = Date.UTC(year, 0, 1);
  const days = (Date.UTC(year + 1, 0, 1) - start) / 86_400_000;
  let rest = 0;
  for (let i = 0; i < days; i++) {
    const date = new Date(start + i * 86_400_000);
    const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
    if (rest > 0) {
      rest--;
      continue;
    }
    if (rand() < 0.012) rest = 2 + Math.floor(rand() * 6); // 一段假期
    if (rand() < (weekend ? 0.45 : 0.08)) continue;
    const season = 1 + 0.55 * Math.sin((2 * Math.PI * (i - 40)) / days);
    let v = (weekend ? 2 : 6) * season * (0.4 + rand() * 1.2);
    if (rand() < 0.04) v *= 2.5 + rand() * 2; // 偶尔特别忙的一天
    values[date.toISOString().slice(0, 10)] = Math.max(1, Math.round(v));
  }
  return values;
}

export const EXAMPLE_INPUT: SkylineInput = {
  year: EXAMPLE_YEAR,
  label: "Example",
  userName: "",
  values: exampleValues(),
  scale: "linear",
};
