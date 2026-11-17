// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
import { useState } from "react";
import {
  parseStravaCsv,
  STRAVA_METRICS,
  stravaValues,
  type StravaMetric,
  type StravaRow,
} from "../sources/sport";
import { FileField, Row, SelectField } from "./fields";
import type { Platform, Run } from "./types";

const METRICS = Object.entries(STRAVA_METRICS) as [StravaMetric, string][];
const UNITS: Record<StravaMetric, string> = {
  distance: "公里",
  count: "次",
  time: "小时",
};

const result = (rows: StravaRow[], metric: StravaMetric, type: string) => ({
  values: stravaValues(rows, metric, type),
  label: "Strava",
  unit: UNITS[metric],
  scale: "linear" as const,
  note: `共 ${rows.length} 次活动`,
});

function show(run: Run, rows: StravaRow[], metric: StravaMetric, type: string) {
  run("正在整理活动…", async () => result(rows, metric, type));
}

export const strava: Platform = {
  id: "strava",
  name: "Strava",
  blurb: "官方导出的活动记录",
  group: "sport",
  guide: {
    steps: [
      "在电脑上登录 Strava，打开 [我的账户](https://www.strava.com/account)，在「下载或删除你的账户」里点「开始」，再点「申请你的存档」。",
      "Strava 会把下载链接发到邮箱（一般几小时内），下载压缩包并解压。",
      "在下面选择里面的 `activities.csv`，再选统计方式和运动类型。",
    ],
    measures:
      "每天的运动距离（公里）、次数或运动时长（小时），可以只算某一种运动。",
    privacy: { kind: "local" },
    tips: ["日期按 Strava 记录的时间换算成你电脑所在时区的日期。"],
  },
  Form({ run }) {
    const [rows, setRows] = useState<StravaRow[] | null>(null);
    const [metric, setMetric] = useState<StravaMetric>("distance");
    const [type, setType] = useState("");
    const types = rows
      ? [...new Set(rows.map((r) => r.type).filter(Boolean))].sort()
      : [];
    return (
      <Row>
        <FileField
          label="选择 activities.csv"
          accept=".csv,text/csv"
          onFile={(f) =>
            run("正在读取 Strava 活动…", async () => {
              const parsed = parseStravaCsv(await f.text());
              setRows(parsed);
              setType("");
              return result(parsed, metric, "");
            })
          }
        />
        {rows && (
          <>
            <SelectField
              label="统计"
              value={metric}
              options={METRICS}
              onChange={(m) => {
                setMetric(m);
                show(run, rows, m, type);
              }}
            />
            <SelectField
              label="运动类型"
              value={type}
              options={[["", "全部"], ...types.map((t) => [t, t] as const)]}
              onChange={(t) => {
                setType(t);
                show(run, rows, metric, t);
              }}
            />
          </>
        )}
      </Row>
    );
  },
};
