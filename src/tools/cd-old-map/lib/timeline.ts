// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 时间轴纯逻辑（单元测试主战场）。把「currentEpochId → 该显示哪个历史叠加层」
// 的决策收敛到一个纯函数里：v1 用它驱动栅格叠加层，v2 标注层将复用同一钩子
// （plan.md §5）。不依赖 DOM / MapLibre，便于单测。

import type { Epoch } from "../data/schema";

/** 按 order 升序排序（不就地修改入参）。order 越大 = 时间越新。 */
export function sortEpochs(epochs: readonly Epoch[]): Epoch[] {
  return [...epochs].sort((a, b) => a.order - b.order);
}

/** 按 id 取 epoch；找不到返回 undefined。 */
export function getEpochById(
  epochs: readonly Epoch[],
  id: string,
): Epoch | undefined {
  return epochs.find((e) => e.id === id);
}

/**
 * 当前 epoch 决定的叠加层状态。
 * - basemap（或未知 id）：无历史叠加层，mapId 为 null。
 * - historical：返回其 mapId，供应用加载对应的 WarpedMapLayer。
 */
export interface OverlayState {
  kind: Epoch["kind"];
  mapId: string | null;
}

export function resolveOverlay(
  epochs: readonly Epoch[],
  currentEpochId: string,
): OverlayState {
  const epoch = getEpochById(epochs, currentEpochId);
  if (!epoch || epoch.kind === "basemap") {
    return { kind: "basemap", mapId: null };
  }
  return { kind: "historical", mapId: epoch.mapId ?? null };
}

/**
 * 底部时间轴的站点展示顺序：order 升序（左旧 → 右新），最右通常是 `present`。
 * 与 sortEpochs 同序，单列出来语义自解释（UI 直接用它渲染横条）。
 */
export function timelineStations(epochs: readonly Epoch[]): Epoch[] {
  return sortEpochs(epochs);
}

/**
 * 键盘 ←/→ 在相邻站点间移动（方向键二维控制器的「时间轴」轴，见 plan §决策6）。
 * dir = +1 走向更新年代（→，order 增大），-1 走向更旧（←）。
 * 边界**饱和不回绕**：已在最旧/最新再按对应方向，停在原地。
 * 当前 id 不存在时，回退到最旧（dir>0）/最新（dir<0）的端点站点。
 */
export function stepEpoch(
  epochs: readonly Epoch[],
  currentEpochId: string,
  dir: 1 | -1,
): string {
  const ordered = sortEpochs(epochs);
  if (ordered.length === 0) return currentEpochId;
  const idx = ordered.findIndex((e) => e.id === currentEpochId);
  if (idx === -1)
    return (dir > 0 ? ordered[0] : ordered[ordered.length - 1]).id;
  const next = idx + dir;
  if (next < 0 || next >= ordered.length) return currentEpochId; // 饱和
  return ordered[next].id;
}
