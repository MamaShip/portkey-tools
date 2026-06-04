// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 底图快照的共享地理范围 / 缩放约束。MapViewer（运行时）与 scripts/bake-basemap.ts
// （烘焙时）都从这里取值，确保「能拖到哪里」与「烘焙了哪些瓦片」永不漂移。
// 全程 WGS-84。

// 中心城区 + 天府新区连片建成区包围盒，约 72×81km，含 1933 老图全域与兴隆湖/南部新区。
// 南界 30.25 框住兴隆湖（≈30.38）及天府新区核心，东界 104.45 含龙泉驿，西界 103.70 含温江/
// 郫都/新津，北界 30.98 含新都/青白江北缘。形如 [[西, 南], [东, 北]]，与 maplibregl
// LngLatBoundsLike 一致。
export const CHENGDU_BOUNDS: [[number, number], [number, number]] = [
  [103.7, 30.25],
  [104.45, 30.98],
];

// 初始视野：1933 老图实际覆盖的中心城区（取配准 GCP 外包络，约 5×3.5km）。
// 老图只覆盖主城一隅，用 CHENGDU_BOUNDS / zoom 12.5 开局会显得范围过大、老图缩成一小块，
// 故开局 fitBounds 到此处。形如 [[西, 南], [东, 北]]。
export const HISTORICAL_MAP_BOUNDS: [[number, number], [number, number]] = [
  [104.0418, 30.6458],
  [104.0934, 30.677],
];

// 显示缩放下限：再缩小已看不到成都，且会拉取范围外瓦片。范围扩大到天府新区后下调一档（10→9），
// 让用户能一眼看到整个扩展区及自身定位相对位置（z9 仅多个位数瓦片，近乎零成本）。
export const MIN_ZOOM = 9;

// 显示缩放上限：>14 由 MapLibre overzoom 复用 z14 矢量瓦片，不增加底图瓦片量。
export const MAX_ZOOM = 16;

// OpenFreeMap 矢量源原生上限，也是烘焙瓦片的最高层级（z10–14）。
export const SOURCE_MAXZOOM = 14;
