// SPDX-License-Identifier: MIT
// Copyright (c) 2026 MamaShip
//
// 每个数据源最后都变成 {"YYYY-MM-DD": 数值}。

export type DailyValues = Record<string, number>;

const pad = (n: number) => String(n).padStart(2, "0");

/** Date → 本地日历日 "YYYY-MM-DD" */
export function localDay(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addTo(values: DailyValues, day: string, v: number) {
  if (v) values[day] = (values[day] ?? 0) + v;
}

/** 有数据的年份，从新到旧 */
export function yearsOf(values: DailyValues): number[] {
  const years = new Set<number>();
  for (const [day, v] of Object.entries(values))
    if (v > 0) years.add(Number(day.slice(0, 4)));
  return [...years].sort((a, b) => b - a);
}

export interface Summary {
  activeDays: number;
  total: number;
  busiestDay: string | null;
  busiest: number;
}

export function summarize(values: DailyValues, year: number): Summary {
  let activeDays = 0;
  let total = 0;
  let busiestDay: string | null = null;
  let busiest = 0;
  for (const [day, v] of Object.entries(values)) {
    if (!day.startsWith(`${year}-`) || !(v > 0)) continue;
    activeDays++;
    total += v;
    if (v > busiest) {
      busiest = v;
      busiestDay = day;
    }
  }
  return { activeDays, total, busiestDay, busiest };
}
