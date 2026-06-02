// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 时间轴站点登记表。Phase 1 有两个站点：`present`（仅现代底图）与 `1933`
// （叠加《1933年成都街市图》）。Phase 2 配准其余各图后在此继续追加。

import type { Epoch } from "./schema";

export const epochs: Epoch[] = [
  { id: "present", label: "现今", order: 100, kind: "basemap" },
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
];
