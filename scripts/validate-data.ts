// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// CI 数据闸门（`pnpm validate`）。无需任何 secrets，fork PR 也能跑。
// 拦住：标注/登记表结构损坏、epoch 引用不存在的 mapId、标注文件缺失。
// 配准是否「贴得准」无法在此断言（靠预览 URL 肉眼看 + tests/georef 的 sanity）。

import { existsSync } from "node:fs";
import { z } from "zod";
import { EpochSchema, HistoricalMapSchema } from "../src/data/schema";
import { epochs } from "../src/data/epochs";
import { maps } from "../src/data/maps";

let ok = true;
const fail = (m: string) => {
  console.error("✗", m);
  ok = false;
};

// 1) schema 校验
z.array(EpochSchema).parse(epochs);
z.array(HistoricalMapSchema).parse(maps);

const mapIds = new Set(maps.map((m) => m.id));

// 2) 引用完整性：historical epoch 必须指向存在的 map
for (const e of epochs) {
  if (e.kind === "historical") {
    if (!e.mapId) fail(`epoch ${e.id} 缺 mapId`);
    else if (!mapIds.has(e.mapId))
      fail(`epoch ${e.id} 引用了不存在的 mapId: ${e.mapId}`);
  }
}

// 3) 每张 map 的 Allmaps 标注文件必须存在
for (const m of maps) {
  if (!existsSync(m.annotationPath))
    fail(`map ${m.id} 的标注文件缺失: ${m.annotationPath}`);
}

if (!ok) process.exit(1);
console.log(`✓ 数据校验通过（epochs: ${epochs.length}, maps: ${maps.length}）`);
