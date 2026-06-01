// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 透明度纯逻辑。WarpedMapLayer.setOpacity 期望 [0,1]；UI 滑块可能给出越界值
// （或 NaN），统一在此夹取，避免渲染层收到非法值。

/** 把任意数值夹取到 [0,1]；非有限数回退到 fallback（默认 1）。 */
export function clampOpacity(value: number, fallback = 1): number {
  if (!Number.isFinite(value)) return fallback;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
