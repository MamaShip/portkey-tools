// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
import { useState } from "react";
import {
  HEALTH_METRICS,
  loadAppleHealth,
  type HealthMetric,
} from "../sources/health";
import { FileField, Row, SelectField } from "./fields";
import type { Platform, Run } from "./types";

const METRICS = Object.entries(HEALTH_METRICS).map(([k, v]) => [k, v.name]) as [
  HealthMetric,
  string,
][];

function read(run: Run, file: File, metric: HealthMetric) {
  run("正在读取健康数据（文件较大，请稍候）…", async () => {
    const r = await loadAppleHealth(file, metric);
    if (!r.records) {
      throw new Error(
        metric === "steps" || metric === "distance"
          ? "文件里没有这一项的记录"
          : "文件里没有活动圆环的数据（需要 Apple Watch）",
      );
    }
    return {
      values: r.values,
      label: "Apple Health",
      unit: HEALTH_METRICS[metric].unit,
      scale: "linear",
    };
  });
}

export const appleHealth: Platform = {
  id: "apple-health",
  name: "Apple 健康",
  blurb: "活动圆环、步数、距离",
  group: "sport",
  guide: {
    steps: [
      "在 iPhone 上打开「健康」App，点右上角的头像，滑到底部点「导出所有健康数据」。",
      "把生成的 `export.zip` 传到电脑上（隔空投送、存到「文件」再同步都行），解压。",
      "在下面选择解压出来的 `apple_health_export/export.xml`（不是 `export_cda.xml`），再选要统计的项目。",
    ],
    measures:
      "可选：活动消耗、锻炼时间、站立小时（这三项来自活动圆环，需要 Apple Watch），或步数、步行跑步距离。",
    privacy: { kind: "local" },
    tips: [
      "`export.xml` 常有几百 MB，读取要几十秒，期间页面可以正常使用。换统计项目要重新读一遍文件。",
      "iPhone 和手表会各记一份步数，这里每天取记得最多的那台设备，避免重复相加。",
    ],
  },
  Form({ run }) {
    const [file, setFile] = useState<File | null>(null);
    const [metric, setMetric] = useState<HealthMetric>("move");
    return (
      <Row>
        <FileField
          label="选择 export.xml"
          accept=".xml,text/xml,application/xml"
          onFile={(f) => {
            setFile(f);
            read(run, f, metric);
          }}
        />
        <SelectField
          label="统计"
          value={metric}
          options={METRICS}
          onChange={(m) => {
            setMetric(m);
            if (file) read(run, file, m);
          }}
        />
      </Row>
    );
  },
};
