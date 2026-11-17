// SPDX-License-Identifier: MIT
// Copyright (c) 2026 MamaShip
//
// 你自己的数据：JSON {"YYYY-MM-DD": 数值} 或带日期列的 CSV。JSON 部分参考 GitHubPoster 的 json_loader.py。

import { addTo, type DailyValues } from "./daily";

const DAY = /^(\d{4})-(\d{2})-(\d{2})/;

/** 接受 "2025-03-01"、"2025-03-01T08:00:00"、"2025-03-01 08:00"；认不出时为 null */
export function dayOf(text: string): string | null {
  const m = DAY.exec(text.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3]
    ? m[0]
    : null;
}

export function parseJsonValues(text: string): DailyValues {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("这不是有效的 JSON 文件");
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error('JSON 应该是 {"2025-01-01": 3, ...} 这样的对象');
  }
  const values: DailyValues = {};
  for (const [k, v] of Object.entries(raw)) {
    const day = dayOf(k);
    const n = Number(v);
    if (!day) throw new Error(`「${k}」不是日期`);
    if (!Number.isFinite(n))
      throw new Error(`${k} 的值「${String(v)}」不是数字`);
    addTo(values, day, n);
  }
  return values;
}

/** 最小的 CSV 解析：支持引号、引号内的逗号与换行、"" 转义 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const s = text.startsWith(String.fromCharCode(0xfeff)) ? text.slice(1) : text; // 去掉 BOM
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

/**
 * CSV 行 → 每日数值。第一行是表头；valueColumn 为 null 时每行计 1。
 * 日期认不出、数值不是数字的行会被跳过并计数。
 */
export function csvValues(
  rows: string[][],
  dateColumn: number,
  valueColumn: number | null,
) {
  const values: DailyValues = {};
  let skipped = 0;
  for (const row of rows.slice(1)) {
    const day = dayOf(row[dateColumn] ?? "");
    const v =
      valueColumn === null
        ? 1
        : Number((row[valueColumn] ?? "").replace(/,/g, ""));
    if (!day || !Number.isFinite(v)) {
      skipped++;
      continue;
    }
    addTo(values, day, v);
  }
  return { values, skipped };
}

/** 猜哪一列是日期：第一列里多数行能认出日期的 */
export function guessDateColumn(rows: string[][]): number {
  const body = rows.slice(1, 50);
  const width = rows[0]?.length ?? 0;
  for (let c = 0; c < width; c++) {
    const ok = body.filter((r) => dayOf(r[c] ?? "")).length;
    if (body.length && ok >= body.length / 2) return c;
  }
  return 0;
}
