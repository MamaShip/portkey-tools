// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 历史地图登记表。瓦片存于 Wasabi（见 docs/object-storage.md 的 key 约定）；
// 仓库内只存 info.json 的 URL 与几 KB 的 Allmaps 标注 JSON。

import type { HistoricalMap } from "./schema";

export const maps: HistoricalMap[] = [
  {
    id: "chengdu-1911",
    title: "宣统三年成都街市图",
    year: 1911,
    iiifInfoUrl:
      "https://s3.ap-southeast-1.wasabisys.com/portkey/tools/chengdu-historical-map/iiif/chengdu-1911/info.json",
    annotationPath: "src/data/annotations/chengdu-1911.json",
    defaultOpacity: 0.7,
    provenance: {
      source:
        "美国驻华使馆武官处（Office of Military Attaché, American Legation, Peking）",
      author: "傅崇渠",
      license: "Public Domain",
      notes:
        "清宣统三年（1911）傅崇渠绘制；来源：Office of Military Attaché, American Legation, Peking。年代久远，视为公共领域。",
    },
    attribution: "《宣统三年成都街市图》· 傅崇渠绘（1911 / 公共领域）",
  },
  {
    id: "chengdu-1915",
    title: "1915年成都街市图",
    year: 1915,
    // 拼幅图：左右两幅各自切片配准，合并为一个双 items 标注。iiifInfoUrl 指主图幅（左/西半）。
    iiifInfoUrl:
      "https://s3.ap-southeast-1.wasabisys.com/portkey/tools/chengdu-historical-map/iiif/chengdu-1915-left/info.json",
    annotationPath: "src/data/annotations/chengdu-1915.json",
    defaultOpacity: 0.7,
    provenance: {
      source: "四川陆军测量局（中华民国四年 / 1915）",
      author: "四川陆军测量局",
      license: "Public Domain",
      notes:
        "中华民国四年（1915）测图、七月制版；制图者为四川陆军测量局（当时政府测绘机构），视为公共领域。图分左右两幅分别扫描，经 Allmaps 各自配准后在地理上拼合（左=城西、右=城东）。",
    },
    attribution: "《1915年成都街市图》· 四川陆军测量局制（公共领域）",
  },
  {
    id: "chengdu-1933",
    title: "1933年成都街市图",
    year: 1933,
    iiifInfoUrl:
      "https://s3.ap-southeast-1.wasabisys.com/portkey/tools/chengdu-historical-map/iiif/chengdu-1933/info.json",
    annotationPath: "src/data/annotations/chengdu-1933.json",
    defaultOpacity: 0.7,
    provenance: {
      source: "参谋本部 四川陆地测量局（中华民国二十二年 / 1933）",
      author: "参谋本部 四川陆地测量局",
      license: "Public Domain",
      notes:
        "中华民国二十二年（1933）参谋本部四川陆地测量局测制：5 月测图、12 月制版；制图者为当时政府测绘机构，视为公共领域。",
    },
    attribution: "《1933年成都街市图》· 参谋本部四川陆地测量局制（公共领域）",
  },
];
