// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { WarpedMapLayer } from "@allmaps/maplibre";
import annotation from "../data/annotations/chengdu-1933.json";
import { maps } from "../data/maps";
import { clampOpacity } from "../lib/opacity";
import positronStyle from "../data/basemap/positron.json";
import { CHENGDU_BOUNDS, MIN_ZOOM, MAX_ZOOM } from "../data/basemap/extent";
import OpacityControl from "./OpacityControl";

// 成都天府广场附近，[lng, lat]（全程 WGS-84）
const CHENGDU: [number, number] = [104.0658, 30.6571];

// 自托管的 positron 矢量样式：瓦片/字形/sprite 均指向 Wasabi（见 docs/object-storage.md），
// 由 scripts/bake-basemap.ts 烘焙生成。原 OpenFreeMap 公共实例（tiles.openfreemap.org）
// 被 GFW 阻断，大陆未翻墙会黑屏；改自托管后大陆免翻墙可用，且零坐标改动（OSM/WGS-84）。
const STYLE = positronStyle as unknown as maplibregl.StyleSpecification;

// Phase 1 只有一张历史图（chengdu-1933）。Phase 2 会从 epochs/maps 登记表泛化为多图 + 时间轴。
const MAP_1933 = maps.find((m) => m.id === "chengdu-1933");
const INITIAL_OPACITY = MAP_1933?.defaultOpacity ?? 0.7;

export default function MapViewer() {
  const ref = useRef<HTMLDivElement>(null);
  const warpedRef = useRef<WarpedMapLayer | null>(null);
  const [opacity, setOpacity] = useState(INITIAL_OPACITY);

  // 初始化地图 + 叠加历史图（仅一次）。
  useEffect(() => {
    if (!ref.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: STYLE,
      center: CHENGDU,
      zoom: 12.5,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      // 把拖拽/缩放锁在成都包围盒内：① 范围外烘焙快照里没有瓦片；
      // ② 限定可达瓦片集合（与 bake 脚本同源 extent，永不漂移）。
      maxBounds: CHENGDU_BOUNDS,
      // CJK 表意文字用浏览器本地字体渲染，不下载汉字字形（只需烘焙拉丁字形）。
      localIdeographFontFamily: "sans-serif",
    });
    map.addControl(new maplibregl.NavigationControl());

    // OpenFreeMap 样式可能引用其 sprite 中并不存在的 POI 图标（office/gate/atm…），
    // 会逐个刷 "Image could not be loaded" 告警。注册透明占位图消除噪声
    // （不影响渲染；底图本就无这些图标）。
    map.on("styleimagemissing", (e) => {
      if (map.hasImage(e.id)) return;
      map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
    });

    map.on("load", () => {
      // @allmaps/maplibre 的 WarpedMapLayer：浏览器端从 Wasabi 的 IIIF 瓦片实时扭合。
      const warped = new WarpedMapLayer({ layerId: "warped-chengdu-1933" });
      map.addLayer(warped);
      const results = warped.addGeoreferenceAnnotation(annotation);
      const errors = results.filter((r) => r instanceof Error);
      if (errors.length > 0) {
        console.error("WarpedMapLayer 加载配准标注出错：", errors);
      }
      warped.setOpacity(clampOpacity(INITIAL_OPACITY));
      warpedRef.current = warped;
    });

    return () => {
      warpedRef.current = null;
      map.remove();
    };
  }, []);

  // 滑块变化 → 同步到叠加层透明度。
  useEffect(() => {
    warpedRef.current?.setOpacity(clampOpacity(opacity));
  }, [opacity]);

  return (
    <>
      <div ref={ref} style={{ position: "absolute", inset: 0 }} />
      {MAP_1933 && (
        <OpacityControl
          title={MAP_1933.title}
          value={opacity}
          onChange={setOpacity}
          attribution={MAP_1933.attribution}
        />
      )}
    </>
  );
}
