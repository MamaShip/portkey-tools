// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 底图快照的共享地理范围 / 缩放约束。MapViewer（运行时）与 scripts/bake-basemap.ts
// （烘焙时）都从这里取值，确保「能拖到哪里」与「烘焙了哪些瓦片」永不漂移。
// 全程 WGS-84。

// 成都主城 + 周边区县包围盒，约 60×60km，含 1933 老图全域。
// 形如 [[西, 南], [东, 北]]，与 maplibregl LngLatBoundsLike 一致。
export const CHENGDU_BOUNDS: [[number, number], [number, number]] = [
  [103.75, 30.4],
  [104.4, 30.95],
];

// 显示缩放下限：再缩小已看不到成都，且会拉取范围外瓦片。
export const MIN_ZOOM = 10;

// 显示缩放上限：>14 由 MapLibre overzoom 复用 z14 矢量瓦片，不增加底图瓦片量。
export const MAX_ZOOM = 16;

// OpenFreeMap 矢量源原生上限，也是烘焙瓦片的最高层级（z10–14）。
export const SOURCE_MAXZOOM = 14;
