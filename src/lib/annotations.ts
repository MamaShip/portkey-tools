// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 标注按约定自动装载（决定「零代码新增一张图」）。用 Vite import.meta.glob 把
// src/data/annotations/*.json 全部收成 Record<mapId, annotation>，键 = 文件名去扩展名 = mapId
// （与 maps.ts 的 id、object-storage 的目录约定同源）。MapViewer 与测试都从这里取，
// 不再各自静态 import；新增一张图只要丢一个 <mapId>.json 就被自动纳入。

// eager + default：构建期内联每个 JSON 的默认导出（即标注对象本身）。
const modules = import.meta.glob<{ default: unknown }>(
  "../data/annotations/*.json",
  { eager: true },
);

/** 从 glob 路径取 mapId：'../data/annotations/chengdu-1933.json' → 'chengdu-1933'。 */
function mapIdFromPath(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1).replace(/\.json$/, "");
}

/** mapId → Allmaps Georeference Annotation（原始 JSON 对象）。 */
export const annotationByMapId: Record<string, unknown> = Object.fromEntries(
  Object.entries(modules).map(([path, mod]) => [
    mapIdFromPath(path),
    mod.default,
  ]),
);

/** 取某张图的标注；未登记返回 undefined。 */
export function getAnnotation(mapId: string): unknown {
  return annotationByMapId[mapId];
}
