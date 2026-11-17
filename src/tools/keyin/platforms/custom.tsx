// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
import { useState } from "react";
import {
  csvValues,
  guessDateColumn,
  parseCsv,
  parseJsonValues,
} from "../sources/files";
import { FileField, Row, SelectField } from "./fields";
import type { Platform, Run } from "./types";

interface Csv {
  rows: string[][];
  date: number;
  value: number | null;
}

function readCsv(run: Run, csv: Csv) {
  run("正在读取 CSV…", async () => {
    const { values, skipped } = csvValues(csv.rows, csv.date, csv.value);
    if (!Object.keys(values).length) {
      throw new Error(
        "这一列里没有认出日期（格式应为 YYYY-MM-DD），换一列试试",
      );
    }
    return {
      values,
      label: "",
      unit: "",
      scale: "linear",
      note: skipped ? `跳过了 ${skipped} 行（日期或数值认不出）` : undefined,
    };
  });
}

export const custom: Platform = {
  id: "custom",
  name: "自己的数据",
  blurb: "JSON 或 CSV 文件",
  group: "other",
  guide: {
    steps: [
      "把数据整理成**表格（CSV）**或 **JSON** 文件。Excel、Numbers、WPS 都可以「另存为 CSV」。",
      "表格的第一行写列名，下面每行一条记录，其中一列是日期，写成 `2025-01-01` 这样。",
      "选好文件后，再选哪一列是日期、哪一列是要统计的数字。",
      "如果表格里没有数字（比如每行就是一次打卡），数字那一列选「每行计 1」，就会统计每天有几行。",
    ],
    examples: [
      {
        title: "表格（CSV）：每天跑了几公里，同一天两行会加在一起",
        text: `日期,公里
2025-01-01,5
2025-01-02,3.2
2025-01-02,2`,
      },
      {
        title: "JSON：日期对应数字",
        text: `{
  "2025-01-01": 5,
  "2025-01-02": 5.2
}`,
      },
    ],
    measures: "每天的数字；同一天出现多次会加在一起。",
    privacy: { kind: "local" },
    tips: ["印在左边的平台名默认是空的，记得在第二步填上，比如「跑步」。"],
  },
  Form({ run }) {
    const [csv, setCsv] = useState<Csv | null>(null);
    const header = csv?.rows[0] ?? [];
    const columns = header.map(
      (h, i) => [String(i), h || `第 ${i + 1} 列`] as const,
    );
    const update = (next: Csv) => {
      setCsv(next);
      readCsv(run, next);
    };
    return (
      <Row>
        <FileField
          label="选择 JSON 或 CSV 文件"
          accept=".json,.csv,application/json,text/csv"
          onFile={async (f) => {
            const text = await f.text();
            if (f.name.toLowerCase().endsWith(".csv")) {
              const rows = parseCsv(text);
              update({ rows, date: guessDateColumn(rows), value: null });
              return;
            }
            setCsv(null);
            run("正在读取 JSON…", async () => ({
              values: parseJsonValues(text),
              label: "",
              unit: "",
              scale: "linear",
            }));
          }}
        />
        {csv && (
          <>
            <SelectField
              label="日期列"
              value={String(csv.date)}
              options={columns}
              onChange={(v) => update({ ...csv, date: Number(v) })}
            />
            <SelectField
              label="数字列"
              value={csv.value === null ? "" : String(csv.value)}
              options={[["", "每行计 1"], ...columns]}
              onChange={(v) =>
                update({ ...csv, value: v === "" ? null : Number(v) })
              }
            />
          </>
        )}
      </Row>
    );
  },
};
