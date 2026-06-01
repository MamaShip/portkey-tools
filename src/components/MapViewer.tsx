// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// 成都天府广场附近，[lng, lat]（全程 WGS-84）
const CHENGDU: [number, number] = [104.0658, 30.6571];

// OpenFreeMap 公共实例的矢量样式（无 key、无请求上限；MapLibre 自动渲染 OSM 署名）。
// ⚠️ 若底图空白，核对 openfreemap.org 当前样式名/URL。
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export default function MapViewer() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: STYLE_URL,
      center: CHENGDU,
      zoom: 12.5,
    });
    map.addControl(new maplibregl.NavigationControl());
    return () => map.remove();
  }, []);

  return <div ref={ref} style={{ position: "absolute", inset: 0 }} />;
}
