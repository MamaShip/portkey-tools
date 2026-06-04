// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 时间轴站点登记表：每个站点对应一张已配准的历史图（按 order 升序，左旧 → 右新）。
// 「纯现代底图」不再设独立站点（原 `present`/「现今」已移除），改由地图上的「隐/显」
// 按钮与按住空格速看获取。Phase 2 起配准新图后在此继续追加。

import type { Epoch } from "./schema";

export const epochs: Epoch[] = [
  {
    id: "1903",
    label: "1903",
    order: 38,
    kind: "historical",
    mapId: "chengdu-1903",
  },
  {
    id: "1911",
    label: "1911",
    order: 40,
    kind: "historical",
    mapId: "chengdu-1911",
  },
  {
    id: "1915",
    label: "1915",
    order: 45,
    kind: "historical",
    mapId: "chengdu-1915",
  },
  {
    id: "1933",
    label: "1933",
    order: 50,
    kind: "historical",
    mapId: "chengdu-1933",
    default: true, // 首屏默认：1933 街市图分辨率好；1944 分辨率偏低，不作开局展示
  },
  {
    id: "1944",
    label: "1944",
    order: 55,
    kind: "historical",
    mapId: "chengdu-1944",
  },
  {
    id: "1947",
    label: "1947",
    order: 57,
    kind: "historical",
    mapId: "chengdu-1947",
  },
  {
    id: "1979",
    label: "1979",
    order: 58,
    kind: "historical",
    mapId: "chengdu-1979",
  },
  {
    id: "1989",
    label: "1989",
    order: 60,
    kind: "historical",
    mapId: "chengdu-1989",
  },
];
