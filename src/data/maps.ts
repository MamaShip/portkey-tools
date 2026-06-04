// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 历史地图登记表。瓦片存于 Wasabi（见 docs/object-storage.md 的 key 约定）；
// 仓库内只存 info.json 的 URL 与几 KB 的 Allmaps 标注 JSON。

import type { HistoricalMap } from "./schema";

export const maps: HistoricalMap[] = [
  {
    id: "chengdu-1903",
    title: "1903年四川省城街道图",
    year: 1903,
    iiifInfoUrl:
      "https://s3.ap-southeast-1.wasabisys.com/portkey/tools/chengdu-historical-map/iiif/chengdu-1903/info.json",
    annotationPath: "src/data/annotations/chengdu-1903.json",
    defaultOpacity: 0.7,
    provenance: {
      source: "四川大学图书馆 藏",
      author: "吕兰",
      license: "Public Domain",
      notes:
        "光绪 29 年天彭（今四川彭州市）人氏吕兰，为四川新任总督岑春煊（1861-1933）了解省城情况而实地测绘的地图。本图采用计里画方法绘制，按“每方六十丈，三方得一里”的比例尺绘制，其精度较好，配色美观艳丽，是清末新政过程中一幅非常宝贵的成都古地图。",
    },
    attribution: "《1903年四川省城街道图》· 吕兰绘（1903 / 公共领域）",
  },
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
  {
    id: "chengdu-1944",
    title: "成都市郊外地图",
    year: 1944,
    iiifInfoUrl:
      "https://s3.ap-southeast-1.wasabisys.com/portkey/tools/chengdu-historical-map/iiif/chengdu-1944/info.json",
    annotationPath: "src/data/annotations/chengdu-1944.json",
    defaultOpacity: 0.7,
    provenance: {
      source: "内政部图书馆 藏",
      license: "Public Domain",
      notes:
        "中华民国三十三年九月（1944）出版；成都西御街新中国工程行承印；内政部图书馆藏。年代久远，视为公共领域。",
    },
    attribution: "《成都市郊外地图》· 成都新中国工程行承印（1944 / 公共领域）",
  },
  {
    id: "chengdu-1947",
    title: "1947年成都市郊图",
    year: 1947,
    iiifInfoUrl:
      "https://s3.ap-southeast-1.wasabisys.com/portkey/tools/chengdu-historical-map/iiif/chengdu-1947/info.json",
    annotationPath: "src/data/annotations/chengdu-1947.json",
    defaultOpacity: 0.7,
    provenance: {
      source: "内政部图书馆 藏",
      author: "国防部测量局测量第五队",
      license: "Public Domain",
      notes:
        "中华民国三十六年（1947）测图；国防部测量局测量第五队测制；内政部图书馆藏。年代久远，视为公共领域。",
    },
    attribution:
      "《1947年成都市郊图》· 国防部测量局测量第五队测制（1947 / 公共领域）",
  },
  {
    id: "chengdu-1979",
    title: "1979年成都军用地图（苏联）",
    year: 1979,
    iiifInfoUrl:
      "https://s3.ap-southeast-1.wasabisys.com/portkey/tools/chengdu-historical-map/iiif/chengdu-1979/info.json",
    annotationPath: "src/data/annotations/chengdu-1979.json",
    defaultOpacity: 0.7,
    provenance: {
      source: "美国国会图书馆（Library of Congress）藏",
      author: "苏联总参谋部军事地形局",
      license: "Public Domain",
      notes:
        "苏联总参谋部“城市计划”（Soviet City Plans）系列，1:10,000 比例尺；依据 1974 年资料测编、1979 年出版的机密军用地形图。苏联解体后大量此类地图流出，原件由美国国会图书馆收藏并数字化共享。",
    },
    attribution: "《成都》· 苏联总参谋部制（1979 / 公共领域）",
  },
  {
    id: "chengdu-1989",
    title: "1989年成都地图（美国）",
    year: 1989,
    iiifInfoUrl:
      "https://s3.ap-southeast-1.wasabisys.com/portkey/tools/chengdu-historical-map/iiif/chengdu-1989/info.json",
    annotationPath: "src/data/annotations/chengdu-1989.json",
    defaultOpacity: 0.7,
    provenance: {
      source:
        "Perry-Castañeda Library Map Collection, University of Texas at Austin（德克萨斯大学奥斯汀分校 PCL 地图收藏）",
      author: "美国中央情报局（U.S. Central Intelligence Agency, CIA）",
      license: "Public Domain",
      notes:
        "1989 年美国中央情报局（CIA）绘制；来源：德克萨斯大学奥斯汀分校 Perry-Castañeda 图书馆地图收藏（PCL Map Collection）。依《美国法典》第 17 编第 105 条（17 U.S.C. §105），美国联邦政府机构职务范围内制作的作品不受版权保护，自动进入公有领域。",
    },
    attribution:
      "《1989年成都地图》· 美国中央情报局（CIA）制（1989 / 公共领域）",
  },
];
