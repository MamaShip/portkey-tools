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
import positronStyle from "../src/data/basemap/positron.json";

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

// 4) 自托管底图样式：必须已改写为指向 Wasabi（拦住误提交未改写 / 仍指向被墙域名的 style）
{
  const style = positronStyle as unknown as {
    version?: number;
    glyphs?: string;
    sprite?: string;
    sources?: { openmaptiles?: { tiles?: string[] } };
  };
  const WASABI_HOST = "s3.ap-southeast-1.wasabisys.com";
  if (style.version !== 8) fail("basemap positron.json: version 应为 8");
  if (JSON.stringify(style).includes("tiles.openfreemap.org"))
    fail(
      "basemap positron.json: 仍含 tiles.openfreemap.org（未改写为自托管 Wasabi）",
    );
  for (const [name, val] of [
    ["glyphs", style.glyphs],
    ["sprite", style.sprite],
    ["tiles", style.sources?.openmaptiles?.tiles?.[0]],
  ] as const) {
    if (typeof val !== "string" || !val.includes(WASABI_HOST))
      fail(`basemap positron.json: ${name} 未指向 Wasabi`);
  }
}

if (!ok) process.exit(1);
console.log(`✓ 数据校验通过（epochs: ${epochs.length}, maps: ${maps.length}）`);
