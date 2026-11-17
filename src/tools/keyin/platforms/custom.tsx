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
      '**JSON**：一个对象，键是日期、值是数字，例如 `{"2025-01-01": 3, "2025-01-02": 8}`。',
      "**CSV**：第一行是表头，有一列日期（`2025-01-01` 或 `2025-01-01 08:00` 都行）。选好文件后指定日期列和数值列；不选数值列时每行计 1，适合「每行一条记录」的表格。",
      "可以从任何 App、表格软件或自己的脚本里导出成这两种格式。",
    ],
    measures: "你给的数值；同一天出现多次会相加。",
    privacy: { kind: "local" },
    tips: ["平台名默认为空，记得在第二步填上你想印的文字。"],
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
              label="数值列"
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
