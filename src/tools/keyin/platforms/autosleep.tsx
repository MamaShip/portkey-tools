// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
import { parseAutoSleep } from "../sources/sport";
import { FileField, Row } from "./fields";
import type { Platform } from "./types";

export const autosleep: Platform = {
  id: "autosleep",
  name: "AutoSleep",
  blurb: "每天的睡眠时长",
  group: "sport",
  guide: {
    steps: [
      "在 AutoSleep App 里把睡眠记录导出成 CSV（在设置或历史页的导出 / 分享里，不同版本位置略有不同），存到电脑上。",
      "在下面选择这个 CSV 文件。",
    ],
    measures: "每天的睡眠时长（小时），取 CSV 里的「asleep / 睡眠时间」列。",
    privacy: { kind: "local" },
    tips: [
      "直接用 App 导出的文件就行，不用改。它需要有日期列（`ISO8601`）和睡眠时长列（`asleep`，中文版叫「睡眠时间」）。",
    ],
  },
  Form({ run }) {
    return (
      <Row>
        <FileField
          label="选择 AutoSleep 导出的 CSV"
          accept=".csv,text/csv"
          onFile={(f) =>
            run("正在读取睡眠记录…", async () => ({
              values: parseAutoSleep(await f.text()),
              label: "AutoSleep",
              unit: "小时",
              scale: "linear",
            }))
          }
        />
      </Row>
    );
  },
};
