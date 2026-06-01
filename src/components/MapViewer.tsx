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
import {
  CHENGDU_BOUNDS,
  HISTORICAL_MAP_BOUNDS,
  MIN_ZOOM,
  MAX_ZOOM,
} from "../data/basemap/extent";
import OpacityControl from "./OpacityControl";
import MapLoadingOverlay, { type LoadStage } from "./MapLoadingOverlay";

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
  // 首屏加载层状态：init→historical→done，done 后淡出再由 dismissed 卸载。
  const [stage, setStage] = useState<LoadStage>("init");
  const [dismissed, setDismissed] = useState(false);

  // 初始化地图 + 叠加历史图（仅一次）。
  useEffect(() => {
    if (!ref.current) return;

    // 加载完成判定：去重 + 兜底定时器。任何事件都不触发时，也保证加载层最终淡出，
    // 用户永不被永久遮挡。
    let done = false;
    let dismissTimer: ReturnType<typeof setTimeout> | undefined;
    const markDone = () => {
      if (done) return;
      done = true;
      clearTimeout(safetyTimer);
      setStage("done");
      dismissTimer = setTimeout(() => setDismissed(true), 450);
    };
    const safetyTimer = setTimeout(markDone, 20000);

    const map = new maplibregl.Map({
      container: ref.current,
      style: STYLE,
      // 开局 fitBounds 到 1933 老图覆盖的中心城区（留少量内边距），而非更大的成都全域，
      // 避免老图开局缩成一小块。
      bounds: HISTORICAL_MAP_BOUNDS,
      fitBoundsOptions: { padding: 24 },
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
      // 底图样式 + 初始视口矢量瓦片就绪，进入历史图加载阶段。
      setStage("historical");

      // @allmaps/maplibre 的 WarpedMapLayer：浏览器端从 Wasabi 的 IIIF 瓦片实时扭合。
      const warped = new WarpedMapLayer({ layerId: "warped-chengdu-1933" });
      map.addLayer(warped);

      // @allmaps 事件经 WarpedMapLayer 转发到 map 上（map.fire(event.type,…)）。
      // 在 addGeoreferenceAnnotation 之前注册，避免错过早到的瓦片事件。
      // allrequestedtilesloaded 后续平移/缩放会再次触发，markDone 的 done 守卫保证只首屏生效。
      map.on("firstmaptileloaded", () => setStage("historical"));
      map.on("allrequestedtilesloaded", markDone);

      const results = warped.addGeoreferenceAnnotation(annotation);
      const errors = results.filter((r) => r instanceof Error);
      if (errors.length > 0) {
        console.error("WarpedMapLayer 加载配准标注出错：", errors);
      }
      warped.setOpacity(clampOpacity(INITIAL_OPACITY));
      warpedRef.current = warped;
    });

    return () => {
      done = true;
      clearTimeout(safetyTimer);
      clearTimeout(dismissTimer);
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
      {!dismissed && <MapLoadingOverlay stage={stage} />}
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
