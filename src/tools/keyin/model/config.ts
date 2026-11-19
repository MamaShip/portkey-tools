// SPDX-License-Identifier: MIT
// Copyright (c) 2021 yihong (GitHubPoster, https://github.com/yihong0618/GitHubPoster)
// Copyright (c) 2026 MamaShip
//
// 模型尺寸，单位毫米。底座与柱子的尺寸沿用 GitHubPoster 的 skyline。

export const BASE_LENGTH = 150;
export const BASE_TOP_LENGTH = 143;
export const BASE_WIDTH = 30;
export const BASE_TOP_WIDTH = 23;
export const BASE_HEIGHT = 10;
export const BOX_DIMENSION = 2.5;
/** 每天的柱子高度被映射到这个区间 */
export const BOX_MIN_HEIGHT = 1;
export const BOX_MAX_HEIGHT = 21;
/** 相邻柱子间留的缝，让每根柱子是独立的流形实体；切片软件会把这么小的缝合上 */
export const BOX_GAP = 0.02;

/** 文字压印在底座前斜面上 */
export const TEXT_LINE_HEIGHT = 6.5; // 一行文字从上伸部到下伸部的高度
export const TEXT_DEPTH = 0.8; // 文字凸出斜面的高度
export const TEXT_MARGIN = 6; // 距底座左右两端
export const TEXT_GAP = 8; // 平台名与名字之间的间距
export const TEXT_PIXELS_PER_MM = 20; // 字形栅格化精度（0.05 mm）

/** 柱子与文字都向下嵌入底座这么深，切片时能干净地合并 */
export const EMBED_DEPTH = 0.5;
