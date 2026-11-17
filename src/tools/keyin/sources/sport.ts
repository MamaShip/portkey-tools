// SPDX-License-Identifier: MIT
// Copyright (c) 2021 yihong (GitHubPoster, https://github.com/yihong0618/GitHubPoster)
// Copyright (c) 2026 MamaShip
//
// 运动与睡眠：GPX 轨迹、Strava 导出的 activities.csv、AutoSleep 导出的 CSV。
// GPX、AutoSleep 移植自 GitHubPoster 的 gpx_loader.py、autosleep_loader.py。

import { addTo, localDay, type DailyValues } from "./daily";
import { dayOf, parseCsv } from "./files";

// --- GPX ------------------------------------------------------------------

const EARTH_RADIUS_M = 6_371_008.8;
const rad = (d: number) => (d * Math.PI) / 180;

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) *
      Math.cos(rad(lat2)) *
      Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

const attr = (tag: string, name: string) => {
  const m = new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`).exec(tag);
  return m ? Number(m[1]) : NaN;
};

/** 一个 GPX 文件 → 开始时间与平面距离（米）；没有轨迹点时为 null */
export function parseGpx(text: string): { start: Date; meters: number } | null {
  let meters = 0;
  let start: Date | null = null;
  // 每个 <trkseg> 单独算，段与段之间不连线
  for (const seg of text.split(/<trkseg\b/).slice(1)) {
    let prev: [number, number] | null = null;
    for (const m of seg.matchAll(
      /<trkpt\b[^>]*>([\s\S]*?)<\/trkpt>|<trkpt\b[^>]*\/>/g,
    )) {
      const tag = m[0].slice(0, m[0].indexOf(">") + 1);
      const lat = attr(tag, "lat");
      const lon = attr(tag, "lon");
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      if (prev) meters += haversine(prev[0], prev[1], lat, lon);
      prev = [lat, lon];
      if (!start && m[1]) {
        const t = /<time>([^<]+)<\/time>/.exec(m[1]);
        if (t) start = new Date(t[1].trim());
      }
    }
  }
  if (!start) {
    const t = /<metadata>[\s\S]*?<time>([^<]+)<\/time>/.exec(text);
    if (t) start = new Date(t[1].trim());
  }
  if (!start || Number.isNaN(start.getTime())) return null;
  return { start, meters };
}

/** 一个文件夹的 .gpx → 每天的距离（公里） */
export async function loadGpx(files: Iterable<File>) {
  const values: DailyValues = {};
  let tracks = 0;
  let skipped = 0;
  for (const f of files) {
    if (!f.name.toLowerCase().endsWith(".gpx")) continue;
    const r = parseGpx(await f.text());
    if (!r) {
      skipped++;
      continue;
    }
    tracks++;
    addTo(values, localDay(r.start), Math.round(r.meters) / 1000);
  }
  return { values, tracks, skipped };
}

// --- Strava ---------------------------------------------------------------

export const STRAVA_METRICS = {
  distance: "距离（公里）",
  count: "次数",
  time: "运动时长（小时）",
} as const;
export type StravaMetric = keyof typeof STRAVA_METRICS;

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

/** Strava 的「Activity Date」：英文的 "Jan 2, 2024, 7:05:09 AM"（UTC），也接受 ISO 格式 */
export function parseStravaDate(text: string): Date | null {
  const m =
    /^([A-Za-z]{3})\w* (\d{1,2}), (\d{4}),? (\d{1,2}):(\d{2}):(\d{2})\s*([AP]M)?$/i.exec(
      text.trim(),
    );
  if (m) {
    const month = MONTHS.indexOf(m[1].toLowerCase());
    let hour = Number(m[4]);
    const ampm = m[7]?.toUpperCase();
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    if (month >= 0) {
      return new Date(Date.UTC(+m[3], month, +m[2], hour, +m[5], +m[6]));
    }
  }
  const t = new Date(text.replace(" ", "T"));
  return Number.isNaN(t.getTime()) ? null : t;
}

export interface StravaRow {
  date: Date;
  type: string;
  km: number;
  seconds: number;
}

/** activities.csv → 每次活动一行 */
export function parseStravaCsv(text: string): StravaRow[] {
  const rows = parseCsv(text);
  const header = rows[0]?.map((h) => h.trim()) ?? [];
  const col = (name: string) => header.indexOf(name);
  const dateCol = col("Activity Date");
  const typeCol = col("Activity Type");
  const timeCol = col("Elapsed Time");
  // 导出里有两列 Distance：第一列是你设置的单位（公里或英里），后面那列固定是米
  const distCols = header.flatMap((h, i) => (h === "Distance" ? [i] : []));
  if (dateCol < 0) {
    throw new Error(
      "没找到「Activity Date」列，请选择 Strava 导出包里的 activities.csv",
    );
  }
  return rows.slice(1).flatMap((r) => {
    const date = parseStravaDate(r[dateCol] ?? "");
    if (!date) return [];
    const num = (i: number) => Number((r[i] ?? "").replace(/,/g, "")) || 0;
    const km =
      distCols.length > 1
        ? num(distCols[1]) / 1000
        : distCols.length
          ? num(distCols[0])
          : 0;
    return [
      {
        date,
        type: r[typeCol] ?? "",
        km,
        seconds: timeCol >= 0 ? num(timeCol) : 0,
      },
    ];
  });
}

export function stravaValues(
  rows: StravaRow[],
  metric: StravaMetric,
  type: string,
): DailyValues {
  const values: DailyValues = {};
  for (const r of rows) {
    if (type && r.type !== type) continue;
    const v =
      metric === "count" ? 1 : metric === "time" ? r.seconds / 3600 : r.km;
    addTo(values, localDay(r.date), v);
  }
  for (const k of Object.keys(values))
    values[k] = Math.round(values[k] * 100) / 100;
  return values;
}

// --- AutoSleep ------------------------------------------------------------

const toHours = (hms: string) => {
  const m = /^(\d+):(\d{2})(?::(\d{2}))?$/.exec(hms.trim());
  return m ? +m[1] + +m[2] / 60 + (m[3] ? +m[3] / 3600 : 0) : NaN;
};

/** AutoSleep 导出的 CSV → 每天睡了几小时（按记录的日期） */
export function parseAutoSleep(text: string): DailyValues {
  const rows = parseCsv(text);
  const header = rows[0]?.map((h) => h.trim()) ?? [];
  const dateCol = header.indexOf("ISO8601");
  const sleepCol = ["asleep", "睡眠时间", "Asleep"]
    .map((h) => header.indexOf(h))
    .find((i) => i >= 0);
  if (dateCol < 0 || sleepCol === undefined) {
    throw new Error(
      "没找到「ISO8601」和「asleep / 睡眠时间」列，请确认是 AutoSleep 导出的 CSV",
    );
  }
  const values: DailyValues = {};
  for (const r of rows.slice(1)) {
    const day = dayOf(r[dateCol] ?? "");
    const h = toHours(r[sleepCol] ?? "");
    if (day && h > 0) values[day] = Math.round(h * 10) / 10;
  }
  return values;
}
