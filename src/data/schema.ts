// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 数据登记表的 schema（zod）。被 scripts/validate-data.ts（CI 数据闸门）与
// 应用代码共用：epochs（时间轴站点）与 maps（历史地图）都以此校验。
// 设计见 plan.md §5：以「时间(epoch)」为中心驱动一切状态。

import { z } from "zod";

/** 时间轴上的一个站点（离散快照，而非连续年份）。 */
export const EpochSchema = z.object({
  id: z.string(), // 'present' | '1933' | 'xuantong' ...
  label: z.string(), // 显示名，如 '宣统 (1909–1911)'
  order: z.number(), // 时间轴排序（大=新）
  kind: z.enum(["basemap", "historical"]),
  mapId: z.string().optional(), // kind=historical 时指向 maps 登记表
});
export type Epoch = z.infer<typeof EpochSchema>;

/** 一张历史地图的登记项（含来源/版权元数据，供版权页与合规用）。 */
export const HistoricalMapSchema = z.object({
  id: z.string(),
  title: z.string(), // 图名
  year: z.number().int(), // 或起始年
  iiifInfoUrl: z.url(), // 对象存储(Wasabi)上 IIIF info.json 的 URL
  annotationPath: z.string(), // src/data/annotations/<id>.json（Allmaps 标注）
  defaultOpacity: z.number().min(0).max(1),
  minZoom: z.number().optional(),
  maxZoom: z.number().optional(),
  provenance: z.object({
    source: z.string(), // 收藏机构 / 出处
    author: z.string().optional(), // 制图者（多为当时政府部门）
    license: z.string(), // 例：'Public Domain'
    notes: z.string().optional(),
  }),
  attribution: z.string(), // 地图角标署名
});
export type HistoricalMap = z.infer<typeof HistoricalMapSchema>;
