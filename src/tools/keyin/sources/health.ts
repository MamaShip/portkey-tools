// SPDX-License-Identifier: MIT
// Copyright (c) 2021 yihong (GitHubPoster, https://github.com/yihong0618/GitHubPoster)
// Copyright (c) 2026 MamaShip
//
// Apple 健康的 export.xml 与 WakaTime 的导出文件。
// Apple 健康参考 GitHubPoster 的 apple_health_loader.py：
// - 圆环（活动消耗、锻炼、站立）直接读每天一条的 <ActivitySummary>，最准确；
// - 步数、步行跑步距离读 <Record>。iPhone 和手表会各记一份，直接相加会重复，
//   所以先按「当天 + 来源设备」求和，再取当天最大的那个来源（近似「健康」App 的去重）。
// export.xml 可能有几百 MB，按流读、边读边解析。

import type { DailyValues } from "./daily";

export const HEALTH_METRICS = {
  move: { name: "活动消耗（千卡）", unit: "千卡" },
  exercise: { name: "锻炼时间（分钟）", unit: "分钟" },
  stand: { name: "站立小时", unit: "小时" },
  steps: { name: "步数", unit: "步" },
  distance: { name: "步行跑步距离（公里）", unit: "公里" },
} as const;
export type HealthMetric = keyof typeof HEALTH_METRICS;

const SUMMARY_FIELD: Partial<Record<HealthMetric, string>> = {
  move: "activeEnergyBurned",
  exercise: "appleExerciseTime",
  stand: "appleStandHours",
};
const RECORD_TYPE: Partial<Record<HealthMetric, string>> = {
  steps: "HKQuantityTypeIdentifierStepCount",
  distance: "HKQuantityTypeIdentifierDistanceWalkingRunning",
};

const attr = (tag: string, name: string) =>
  new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

/** 逐块喂入 XML 文本，按指标累计 */
export class HealthParser {
  private readonly bySource = new Map<string, number>(); // "day\0source" → 合计
  private readonly summary: DailyValues = {};
  private carry = "";
  records = 0;

  constructor(readonly metric: HealthMetric) {}

  push(chunk: string) {
    const text = this.carry + chunk;
    const cut = text.lastIndexOf(">") + 1;
    this.carry = text.slice(cut);
    const field = SUMMARY_FIELD[this.metric];
    const type = RECORD_TYPE[this.metric];
    const re = field ? /<ActivitySummary\s[^>]*>/g : /<Record\s[^>]*>/g;
    for (const [tag] of text.slice(0, cut).matchAll(re)) {
      if (field) {
        const day = attr(tag, "dateComponents");
        const v = Number(attr(tag, field));
        if (day && v > 0) {
          this.summary[day] = v;
          this.records++;
        }
        continue;
      }
      if (!tag.includes(`"${type}"`)) continue;
      const day = attr(tag, "startDate")?.slice(0, 10);
      let v = Number(attr(tag, "value"));
      if (!day || !(v > 0)) continue;
      if (this.metric === "distance" && attr(tag, "unit") === "mi")
        v *= 1.609344;
      const key = `${day}\u0000${attr(tag, "sourceName") ?? ""}`;
      this.bySource.set(key, (this.bySource.get(key) ?? 0) + v);
      this.records++;
    }
  }

  result(): DailyValues {
    if (SUMMARY_FIELD[this.metric]) return { ...this.summary };
    const values: DailyValues = {};
    for (const [key, v] of this.bySource) {
      const day = key.slice(0, 10);
      values[day] = Math.max(values[day] ?? 0, v);
    }
    const digits = this.metric === "distance" ? 100 : 1;
    for (const k of Object.keys(values))
      values[k] = Math.round(values[k] * digits) / digits;
    return values;
  }
}

/** 按流读 export.xml；onProgress 收到已读比例（0..1） */
export async function loadAppleHealth(
  file: File,
  metric: HealthMetric,
  onProgress?: (ratio: number) => void,
) {
  if (file.name.toLowerCase().endsWith(".zip")) {
    throw new Error(
      "请先解压 export.zip，再选择里面的 apple_health_export/export.xml",
    );
  }
  const parser = new HealthParser(metric);
  const reader = file.stream().pipeThrough(new TextDecoderStream()).getReader();
  let read = 0;
  let lastReport = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.push(value);
    read += value.length;
    if (onProgress && read - lastReport > 8_000_000) {
      lastReport = read;
      onProgress(Math.min(1, read / file.size));
    }
  }
  return { values: parser.result(), records: parser.records };
}

// --- WakaTime -------------------------------------------------------------

interface WakaDay {
  date?: string;
  range?: { date?: string };
  grand_total?: { total_seconds?: number };
}

/**
 * WakaTime 网站导出的 JSON（{days: [{date, grand_total: {total_seconds}}]}），
 * 也接受 summaries 接口的格式（{data: [{range: {date}, grand_total}]}）→ 每天编程小时数。
 */
export function parseWakaTime(text: string): DailyValues {
  let raw: { days?: WakaDay[]; data?: WakaDay[] };
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("这不是有效的 JSON 文件");
  }
  const days = raw?.days ?? raw?.data;
  if (!Array.isArray(days)) {
    throw new Error(
      "没认出格式：应该是 WakaTime 导出的 JSON（里面有 days 列表）",
    );
  }
  const values: DailyValues = {};
  for (const d of days) {
    const day = d.date ?? d.range?.date;
    const seconds = d.grand_total?.total_seconds ?? 0;
    if (day && seconds > 0)
      values[day.slice(0, 10)] = Math.round((seconds / 3600) * 100) / 100;
  }
  return values;
}
