// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { WarpedMapLayer } from "@allmaps/maplibre";
import annotation from "../data/annotations/chengdu-1933.json";
import { maps } from "../data/maps";
import { clampOpacity } from "../lib/opacity";
import OpacityControl from "./OpacityControl";

// 成都天府广场附近，[lng, lat]（全程 WGS-84）
const CHENGDU: [number, number] = [104.0658, 30.6571];

// OpenFreeMap 公共实例的矢量样式（无 key、无请求上限；MapLibre 自动渲染 OSM 署名）。
// 用 positron（极简浅灰底图）：① 不含 terrain/密集 POI 图层，避免 liberty 样式
// 在 worker 里对可空字段做 filter 求值刷出的 "Expected number, found null" 告警；
// ② 中性浅底更利于半透明历史图叠加层的可读性。
// 备选：…/styles/liberty（全彩详细）、…/styles/bright。⚠️ 若底图空白，核对当前样式名/URL。
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

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
      style: STYLE_URL,
      center: CHENGDU,
      zoom: 12.5,
    });
    map.addControl(new maplibregl.NavigationControl());

    // OpenFreeMap 的 liberty 样式引用了若干其 sprite 中并不存在的 POI 图标
    // （office/gate/atm…），会逐个刷 "Image could not be loaded" 告警。
    // 注册透明占位图消除噪声（不影响渲染；底图本就无这些图标）。
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
