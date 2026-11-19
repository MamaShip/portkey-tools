// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// URL hash 深链接的纯逻辑（单元测试主战场，plan §8）。把「当前视图」
// （epoch + 经纬度 + zoom + 透明度）序列化进 URL hash，便于分享「某条街
// 1949 vs 现今」。不依赖 DOM / MapLibre，便于往返单测。
//
// hash 形如：`epoch=1933&c=30.6601,104.0633&z=14.2&o=0.70`
// （前导 `#` 不属于本模块职责，由调用方读写 location.hash 时增删）。

import { clampOpacity } from "./opacity";

/** 一份可分享的视图状态。各字段独立可选（解析时缺啥丢啥）。 */
export interface View {
  epochId: string;
  lng: number;
  lat: number;
  zoom: number;
  opacity: number; // 0–1
}

// 序列化精度：经纬度 ~1e-4°（≈10m，够定位街区且短）；zoom 1 位；透明度 2 位。
const COORD_DECIMALS = 4;
const ZOOM_DECIMALS = 2;
const OPACITY_DECIMALS = 2;

/** 去掉定点小数尾随的 0（"14.20"→"14.2"，"0.70"→"0.7"），保持 hash 简洁。 */
function trimNum(n: number, decimals: number): string {
  return String(Number(n.toFixed(decimals)));
}

/**
 * 把（部分）视图状态序列化为 hash 字符串（不含前导 `#`）。
 * 仅写出提供且为有限数的字段，键顺序固定（epoch,c,z,o）便于稳定与可读。
 */
export function serializeView(view: Partial<View>): string {
  const params = new URLSearchParams();
  if (view.epochId) params.set("epoch", view.epochId);
  if (
    view.lng !== undefined &&
    view.lat !== undefined &&
    Number.isFinite(view.lng) &&
    Number.isFinite(view.lat)
  ) {
    params.set(
      "c",
      `${trimNum(view.lat, COORD_DECIMALS)},${trimNum(view.lng, COORD_DECIMALS)}`,
    );
  }
  if (view.zoom !== undefined && Number.isFinite(view.zoom)) {
    params.set("z", trimNum(view.zoom, ZOOM_DECIMALS));
  }
  if (view.opacity !== undefined && Number.isFinite(view.opacity)) {
    params.set("o", trimNum(view.opacity, OPACITY_DECIMALS));
  }
  return params.toString();
}

export interface ParseOptions {
  /** 合法的 epoch id 集合；hash 里的 epoch 不在其中则丢弃（防断链/脏值）。 */
  validEpochIds?: readonly string[];
}

/**
 * 宽松解析 hash → 部分视图状态。**永不抛错**：任何非法/越界/缺失字段都丢弃，
 * 调用方对缺失字段沿用各自默认值。
 * - epoch：仅当在 validEpochIds 内才保留（未给该选项时不校验）。
 * - c：形如 `lat,lng`，两数均须有限。
 * - z：有限数。
 * - o：经 clampOpacity 夹到 [0,1]（NaN 则丢弃）。
 */
export function parseView(
  hash: string,
  options: ParseOptions = {},
): Partial<View> {
  const result: Partial<View> = {};
  // 容忍前导 `#`。
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);

  const epoch = params.get("epoch");
  if (epoch) {
    if (!options.validEpochIds || options.validEpochIds.includes(epoch)) {
      result.epochId = epoch;
    }
  }

  const c = params.get("c");
  if (c) {
    const [latStr, lngStr] = c.split(",");
    const lat = Number(latStr);
    const lng = Number(lngStr);
    if (
      latStr !== undefined &&
      lngStr !== undefined &&
      Number.isFinite(lat) &&
      Number.isFinite(lng)
    ) {
      result.lat = lat;
      result.lng = lng;
    }
  }

  const z = params.get("z");
  if (z !== null) {
    const zoom = Number(z);
    if (z !== "" && Number.isFinite(zoom)) result.zoom = zoom;
  }

  const o = params.get("o");
  if (o !== null && o !== "") {
    const opacity = Number(o);
    if (Number.isFinite(opacity)) result.opacity = clampOpacity(opacity);
  }

  return result;
}
