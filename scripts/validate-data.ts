// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// CI 数据闸门（`pnpm validate`）。无需任何 secrets，fork PR 也能跑。
// 拦住：标注/登记表结构损坏、epoch 引用不存在的 mapId、标注文件缺失。
// 配准是否「贴得准」无法在此断言（靠预览 URL 肉眼看 + tests/georef 的 sanity）。

import { existsSync, readFileSync } from "node:fs";
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

// 2b) 首屏默认站点至多一个（多个 default:true 会让开局展示不确定）
const defaultEpochs = epochs.filter((e) => e.default);
if (defaultEpochs.length > 1)
  fail(
    `有多个 default:true 的 epoch: ${defaultEpochs.map((e) => e.id).join(", ")}`,
  );

// 3) 每张 map 的 Allmaps 标注文件必须存在，且其 target.source.id 必须等于
//    iiifInfoUrl 去掉末尾 /info.json 的基址（拦住 SOP 附录列的「断链」常见坑：
//    标注指向的 IIIF 基址与登记的 info.json 不一致时，浏览器取不到瓦片）。
for (const m of maps) {
  if (!existsSync(m.annotationPath)) {
    fail(`map ${m.id} 的标注文件缺失: ${m.annotationPath}`);
    continue;
  }
  const expectedBase = m.iiifInfoUrl.replace(/\/info\.json$/, "");
  // 同一工具下所有图幅共享的 IIIF 前缀（截到 .../iiif/，含末尾斜杠）。
  const iiifPrefix = expectedBase.replace(/[^/]+$/, "");
  try {
    const ann = JSON.parse(readFileSync(m.annotationPath, "utf8")) as {
      items?: { target?: { source?: { id?: string } } }[];
    };
    const items = ann.items ?? [];
    if (items.length === 0) {
      fail(`map ${m.id} 标注无 items`);
      continue;
    }
    // items[0] 是登记的主图幅：其 source.id 必须等于 iiifInfoUrl 基址（断链主锚点）。
    const primaryId = items[0]?.target?.source?.id;
    if (primaryId !== expectedBase)
      fail(
        `map ${m.id} 标注 items[0] source.id (${primaryId}) ≠ iiifInfoUrl 基址 (${expectedBase})`,
      );
    // 拼幅图（多 items，如 1915 左右两半）：其余每幅 source.id 也须指向同一 /iiif/ 前缀，
    // 防止某一幅断链（指错桶/拼错 id）悄悄漏过 CI。
    items.forEach((it, i) => {
      const sid = it?.target?.source?.id;
      if (typeof sid !== "string" || !sid.startsWith(iiifPrefix))
        fail(
          `map ${m.id} 标注 items[${i}] source.id (${sid}) 不在 IIIF 前缀 ${iiifPrefix} 下`,
        );
    });
  } catch (e) {
    fail(`map ${m.id} 标注 JSON 解析失败: ${m.annotationPath}（${String(e)}）`);
  }
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
