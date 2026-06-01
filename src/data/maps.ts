// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 历史地图登记表。瓦片存于 Wasabi（见 docs/object-storage.md 的 key 约定）；
// 仓库内只存 info.json 的 URL 与几 KB 的 Allmaps 标注 JSON。

import type { HistoricalMap } from "./schema";

export const maps: HistoricalMap[] = [
  {
    id: "chengdu-1933",
    title: "1933年成都街市图",
    year: 1933,
    iiifInfoUrl:
      "https://s3.ap-southeast-1.wasabisys.com/portkey/tools/chengdu-historical-map/iiif/chengdu-1933/info.json",
    annotationPath: "src/data/annotations/chengdu-1933.json",
    defaultOpacity: 0.7,
    provenance: {
      // TODO: 补充确切收藏机构 / 出处，并同步到「来源与版权」页（copyright.astro）。
      source: "待补（收藏机构 / 出处）",
      license: "Public Domain",
      notes:
        "民国二十二年（1933）成都街市测绘图；制图者多为当时政府部门，视为公共领域。",
    },
    attribution: "《1933年成都街市图》（公共领域）",
  },
];
