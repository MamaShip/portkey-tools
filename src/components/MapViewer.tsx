// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { WarpedMapLayer } from "@allmaps/maplibre";
import { maps } from "../data/maps";
import { epochs } from "../data/epochs";
import { getAnnotation } from "../lib/annotations";
import { resolveOverlay, stepEpoch, timelineStations } from "../lib/timeline";
import { clampOpacity } from "../lib/opacity";
import { parseView, serializeView, type View } from "../lib/deeplink";
import positronStyle from "../data/basemap/positron.json";
import {
  CHENGDU_BOUNDS,
  HISTORICAL_MAP_BOUNDS,
  MIN_ZOOM,
  MAX_ZOOM,
} from "../data/basemap/extent";
import Timeline from "./Timeline";
import OpacityControl from "./OpacityControl";
import MapInfo from "./MapInfo";
import MapLoadingOverlay, { type LoadStage } from "./MapLoadingOverlay";
import InfoButton from "./InfoButton";
import SourcesModal from "./SourcesModal";
import MapNotice from "./MapNotice";

// 自托管的 positron 矢量样式：瓦片/字形/sprite 均指向 Wasabi（见 docs/object-storage.md），
// 由 scripts/bake-basemap.ts 烘焙生成。原 OpenFreeMap 公共实例（tiles.openfreemap.org）
// 被 GFW 阻断，大陆未翻墙会黑屏；改自托管后大陆免翻墙可用，且零坐标改动（OSM/WGS-84）。
const STYLE = positronStyle as unknown as maplibregl.StyleSpecification;

const mapsById = new Map(maps.map((m) => [m.id, m]));
const STATIONS = timelineStations(epochs); // 已按 order 升序（左旧 → 右新）
const EPOCH_IDS = epochs.map((e) => e.id); // 深链接里校验 hash 中的 epoch 是否合法

// 首屏默认站点：优先显式标记 `default: true` 的 epoch；否则退到最新历史图（保持
// Phase 1「开局即见叠加层」体验）；再无历史图则退到第一个站点。
const INITIAL_EPOCH =
  STATIONS.find((e) => e.default) ??
  [...STATIONS].reverse().find((e) => e.kind === "historical");
const INITIAL_EPOCH_ID = INITIAL_EPOCH?.id ?? STATIONS[0]?.id ?? "";

// 某 epoch 的默认透明度：取其历史图登记的 defaultOpacity；基底/未知 epoch 退到 0.7。
// 深链接带 epoch 但未带 opacity 时，用它给出合理初值。
function defaultOpacityForEpoch(epochId: string): number {
  const { mapId } = resolveOverlay(epochs, epochId);
  return (mapId ? mapsById.get(mapId)?.defaultOpacity : undefined) ?? 0.7;
}

// 键盘 ↑/↓ 每次调透明度的步长（方向键二维控制器的「古今融合」轴，见 plan §决策6）。
const OPACITY_STEP = 0.05;

export default function MapViewer() {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  // mapId → 该图的 WarpedMapLayer。首次切到某历史 epoch 时才懒建（未访问的图永不拉瓦片）。
  const layersRef = useRef<Map<string, WarpedMapLayer>>(new Map());

  // 深链接初值：组件挂载时一次性解析 URL hash（epoch / 经纬度 / zoom / 透明度）。
  // 用惰性 useState 初始化器固化（只在挂载时算一次）；非法/越界字段已在 parseView 内丢弃。
  const [initialView] = useState<Partial<View>>(() =>
    typeof window !== "undefined"
      ? parseView(window.location.hash, { validEpochIds: EPOCH_IDS })
      : {},
  );
  const initialEpochId = initialView.epochId ?? INITIAL_EPOCH_ID;
  const initialOpacity =
    initialView.opacity ?? defaultOpacityForEpoch(initialEpochId);

  const [mapReady, setMapReady] = useState(false);
  const [currentEpochId, setCurrentEpochId] = useState(initialEpochId);
  const [opacity, setOpacity] = useState(initialOpacity);

  // 写回 hash 需读「最新的 epoch / 透明度」，但 moveend 回调注册在只跑一次的初始化
  // effect 里（闭包会定格旧值）。故把两者镜像进 ref（在下方 effect 里同步更新），
  // 由稳定的 writeHash 读取——避免在渲染期读写 ref（react-hooks/refs 规则）。
  const epochIdRef = useRef(initialEpochId);
  const opacityRef = useRef(initialOpacity);
  // 「速看」：按住空格临时隐藏老图直接看底图，抬起即恢复（不改动 opacity 状态）。
  const [peeking, setPeeking] = useState(false);
  // 「隐/显」持久开关：触屏端等价于空格速看，但点按切换、状态可保持（与瞬时 peeking 正交）。
  const [hidden, setHidden] = useState(false);
  // 首屏加载层状态：init→historical→done，done 后淡出再由 dismissed 卸载。
  const [stage, setStage] = useState<LoadStage>("init");
  const [dismissed, setDismissed] = useState(false);
  // 「来源与版权」弹窗开关。infoOpenRef 镜像供初始化 effect 里的全局键盘回调读到最新值
  // （该 effect 依赖 [] 只跑一次，不能把 infoOpen 加入依赖——会重建地图）。
  const [infoOpen, setInfoOpen] = useState(false);
  const infoOpenRef = useRef(false);
  const openInfo = () => {
    infoOpenRef.current = true;
    setInfoOpen(true);
  };
  const closeInfo = () => {
    infoOpenRef.current = false;
    setInfoOpen(false);
  };

  // 定位反馈轻提示（默认 3 秒自动消失；sticky 时常驻，供调试从容截图）。useState 的 setter
  // 引用稳定，可在只跑一次的初始化 effect 里安全调用；showNotice 用 useCallback([]) 固化，
  // 作为该 effect 的稳定依赖。
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const showNotice = useCallback((msg: string, sticky = false) => {
    setNotice(msg);
    clearTimeout(noticeTimerRef.current);
    if (!sticky)
      noticeTimerRef.current = setTimeout(() => setNotice(null), 3000);
  }, []);

  // 把当前视图（epoch + 视野 + 透明度）写回 URL hash，用 replaceState 不污染后退栈。
  // 稳定引用（useCallback []）：读 ref 中的最新 epoch/opacity + 地图当前视野；
  // peeking（空格速看）是临时态，不在此写入（opacity state 未变，hash 保持真实值）。
  const writeHash = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const center = map.getCenter();
    const hash = serializeView({
      epochId: epochIdRef.current,
      lng: center.lng,
      lat: center.lat,
      zoom: map.getZoom(),
      opacity: opacityRef.current,
    });
    window.history.replaceState(
      null,
      "",
      hash ? `#${hash}` : window.location.pathname + window.location.search,
    );
  }, []);

  // 初始化地图（仅一次）：底图 + 控件 + 首屏加载判定 + 全局方向键控制器。
  // 历史叠加层的增删/透明度交由下面的「编排」effect 按当前 epoch 驱动。
  useEffect(() => {
    if (!ref.current) return;
    // 捕获稳定的图层表引用，供 cleanup 使用（避免 react-hooks 的 ref-in-cleanup 告警）。
    const layers = layersRef.current;

    // 岛屿已挂载：移除 Astro 页面里的静态启动遮罩（仅在岛屿包下载期占位）。
    // 此刻 React 的 MapLoadingOverlay 已随本次渲染入场（外观一致的 init 阶段），接管无跳变。
    document.getElementById("map-boot-overlay")?.remove();

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

    // 深链接带完整视野（经纬度+zoom）时用 center+zoom 还原；否则维持开局 fitBounds
    // 到 1933 老图覆盖的中心城区（留少量内边距），而非更大的成都全域，避免老图缩成一小块。
    const hv = parseView(window.location.hash, { validEpochIds: EPOCH_IDS });
    const hasHashView =
      hv.lng !== undefined && hv.lat !== undefined && hv.zoom !== undefined;
    const map = new maplibregl.Map({
      container: ref.current,
      style: STYLE,
      ...(hasHashView
        ? { center: [hv.lng, hv.lat] as [number, number], zoom: hv.zoom }
        : { bounds: HISTORICAL_MAP_BOUNDS, fitBoundsOptions: { padding: 24 } }),
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      // 把拖拽/缩放锁在成都包围盒内：① 范围外烘焙快照里没有瓦片；
      // ② 限定可达瓦片集合（与 bake 脚本同源 extent，永不漂移）。
      maxBounds: CHENGDU_BOUNDS,
      // 关闭 MapLibre 自带方向键平移：方向键改由本组件统一作「时间轴 ←→ / 透明度 ↑↓」
      // 二维控制（plan §决策6）。平移仍可鼠标/触控拖拽，缩放用 NavigationControl。
      keyboard: false,
      // CJK 表意文字用浏览器本地字体渲染，不下载汉字字形（只需烘焙拉丁字形）。
      localIdeographFontFamily: "sans-serif",
      // 关闭默认（展开式）署名控件，下面换成 compact：右下角默认只显示一个 ⓘ 按钮，
      // 点击才展开版权全文，开局不占视野。
      attributionControl: false,
      // 定位控件按钮的中文文案（仅覆盖这两个键，其余沿用 MapLibre 默认）。
      locale: {
        "GeolocateControl.FindMyLocation": "定位到我的位置",
        "GeolocateControl.LocationNotAvailable": "当前设备不支持定位",
      },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl());
    // 定位调试开关（走 URL query，不与 hash 深链接冲突）：?geodebug=1 常驻显示原始
    // code+message 供手机截图排障；?ha=0 强制低精度、?ha=1 强制高精度，便于一套部署里对比。
    const q = new URLSearchParams(window.location.search);
    const GEO_DEBUG = q.get("geodebug") === "1";
    const geoHighAccuracy = q.get("ha") !== "0"; // 默认高精度；仅 ?ha=0 时转低精度
    const GEO_TIMEOUT = 10000; // 单一来源：positionOptions 与下方 geodebug 读数共用
    // 定位控件：排在缩放/指南针之后 → 右上角叠在其下方（即「加在它们之后」）。点击才
    // 请求浏览器定位权限，不点不请求、不留标记（可选、按需授权）。蓝点+精度圈是 HTML
    // Marker，自动浮在底图与老图栅格之上（最上层）。trackUserLocation 持续跟踪，关页即停
    // （geolocation watch 由 map.remove() 在卸载时清理）。
    // enableHighAccuracy 默认 true（用 GPS）：国行 Chrome 的「网络定位」走被 GFW 阻断的
    // Google 服务（googleapis.com）必超时，唯有裸 GPS（室外）可绕开，故按国内现实优先 GPS。
    // timeout 10s 平衡：多数热启动/辅助 GPS 数秒内返回；室内则约 10s 失败给提示、不再干等
    // （MapLibre 控件等待期有 spinner 反馈）；maximumAge 复用 30s 内的现成位置，秒回不重打。
    const geolocate = new maplibregl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: geoHighAccuracy,
        timeout: GEO_TIMEOUT,
        maximumAge: 30000,
      },
      trackUserLocation: true,
    });
    map.addControl(geolocate);
    // 定位被拒/不可用、或定位成功但在成都 maxBounds 之外时，给一条会自动消失的轻提示，
    // 避免「点了没反应」。outofmaxbounds 在位置超出 map.maxBounds 时触发。
    geolocate.on("outofmaxbounds", () =>
      showNotice("您当前不在成都范围内，无法在本图上显示定位"),
    );
    geolocate.on("error", (e: GeolocationPositionError) => {
      if (GEO_DEBUG) {
        // 调试：常驻显示原始 code+message，供手机截图坐实病因（如 GFW 阻断 Google 网络定位）。
        console.error("[geo] error", e.code, e.message);
        showNotice(
          `定位失败 code=${e.code}\n${e.message || "(无 message)"}\n[ha=${geoHighAccuracy} t=${GEO_TIMEOUT / 1000}s]`,
          true,
        );
        return;
      }
      // code 1=权限被拒，2=位置不可用（系统定位关/无信号），3=超时。按国内 Chrome 现实给可操作引导。
      const msg =
        e.code === 1
          ? "已拒绝定位权限"
          : e.code === 3
            ? "定位超时：Chrome 在国内常无法联网定位，请到室外用 GPS 重试，或改用系统浏览器/微信打开"
            : "无法获取位置：请确认系统定位已开启（Chrome 国内联网定位可能受限，可改用系统浏览器）";
      showNotice(msg);
    });
    if (GEO_DEBUG) {
      // 调试：定位成功时常驻显示精度与坐标，确认精度来源（GPS 几米 vs 网络几百米）。
      geolocate.on("geolocate", (pos: GeolocationPosition) => {
        const { longitude, latitude, accuracy } = pos.coords;
        console.log("[geo] ok", accuracy, longitude, latitude);
        showNotice(
          `定位成功 acc=${Math.round(accuracy)}m\n(${longitude.toFixed(5)}, ${latitude.toFixed(5)})`,
          true,
        );
      });
    }
    // 右下角署名控件：compact 模式呈现为一个 ⓘ 按钮，点击才展开版权全文。
    // MapLibre 在署名文本「首次异步填充」时才会加上 maplibregl-compact + maplibregl-compact-show
    // （开局展开），因此 addControl 后同步移除无效。这里监听填充事件，待 compact 类就绪后移除
    // 一次展开态即自我解绑——此后 MapLibre 不会再自动加回该类，也不影响用户点击展开。
    map.addControl(new maplibregl.AttributionControl({ compact: true }));
    const collapseAttributionOnce = () => {
      const el = ref.current?.querySelector(".maplibregl-ctrl-attrib");
      if (!el?.classList.contains("maplibregl-compact")) return; // 文本尚未填充，等下次事件
      el.classList.remove("maplibregl-compact-show");
      map.off("styledata", collapseAttributionOnce);
      map.off("sourcedata", collapseAttributionOnce);
    };
    map.on("styledata", collapseAttributionOnce);
    map.on("sourcedata", collapseAttributionOnce);
    collapseAttributionOnce(); // 兜底：极少数情况下文本已同步就绪

    // 拖动/缩放结束后（防抖 300ms）把视野写回 hash，使地址栏始终是可分享的深链接。
    let moveHashTimer: ReturnType<typeof setTimeout> | undefined;
    const onMoveEnd = () => {
      clearTimeout(moveHashTimer);
      moveHashTimer = setTimeout(writeHash, 300);
    };
    map.on("moveend", onMoveEnd);

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
      // @allmaps 事件经 WarpedMapLayer 转发到 map 上（map.fire(event.type,…)）。
      // 在编排 effect 添加图层之前注册，避免错过早到的瓦片事件。
      // allrequestedtilesloaded 后续平移/切换会再次触发，markDone 的 done 守卫保证只首屏生效。
      map.on("firstmaptileloaded", () => setStage("historical"));
      map.on("allrequestedtilesloaded", markDone);
      // 触发编排 effect 懒建首屏历史图层。
      setMapReady(true);
    });

    // 全局方向键二维控制器：←→ 走时间轴，↑↓ 调透明度，均 preventDefault
    // （避免页面滚动 / 与竖向滑块原生键步进重复触发）。
    const onKey = (e: KeyboardEvent) => {
      // 弹窗打开时：Esc 关闭，其余键全部吞掉，避免操作弹窗时背后地图随方向键/空格乱动。
      if (infoOpenRef.current) {
        if (e.key === "Escape") {
          infoOpenRef.current = false;
          setInfoOpen(false);
        }
        return;
      }
      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          setHidden(false); // 切换时间点应展示其老图，不延续上一站的隐藏态
          setCurrentEpochId((id) => stepEpoch(epochs, id, 1));
          break;
        case "ArrowLeft":
          e.preventDefault();
          setHidden(false);
          setCurrentEpochId((id) => stepEpoch(epochs, id, -1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHidden(false); // 调透明度即取消持久隐藏，避免「调了却看不到变化」
          setOpacity((o) => clampOpacity(o + OPACITY_STEP));
          break;
        case "ArrowDown":
          e.preventDefault();
          setHidden(false);
          setOpacity((o) => clampOpacity(o - OPACITY_STEP));
          break;
        // 空格速看：按住临时隐藏老图看底图（preventDefault 避免页面滚动/误触焦点元素）；
        // e.repeat 守卫使长按时只在首次按下生效，抬起由 onKeyUp 复位。
        case " ":
          e.preventDefault();
          if (!e.repeat) setPeeking(true);
          break;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") setPeeking(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      done = true;
      clearTimeout(safetyTimer);
      clearTimeout(dismissTimer);
      clearTimeout(moveHashTimer);
      clearTimeout(noticeTimerRef.current);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      layers.clear();
      mapRef.current = null;
      map.remove();
    };
  }, [writeHash, showNotice]);

  // 编排：当前 epoch / 透明度 → 各历史图层的存在性与透明度。
  // 活动历史图：懒建（首访才拉瓦片）并设为当前透明度；其余已建图层置 0（瞬时 A/B，不重拉）。
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const { mapId } = resolveOverlay(epochs, currentEpochId);

    if (mapId && !layersRef.current.has(mapId)) {
      const annotation = getAnnotation(mapId);
      if (annotation) {
        const layer = new WarpedMapLayer({ layerId: `warped-${mapId}` });
        map.addLayer(layer);
        const results = layer.addGeoreferenceAnnotation(annotation);
        const errors = results.filter((r) => r instanceof Error);
        if (errors.length > 0) {
          console.error(`WarpedMapLayer(${mapId}) 加载配准标注出错：`, errors);
        }
        layersRef.current.set(mapId, layer);
      } else {
        console.error(`缺少 ${mapId} 的配准标注（src/data/annotations/）`);
      }
    }

    for (const [id, layer] of layersRef.current) {
      // peeking（按住空格速看）或 hidden（隐/显按钮持久隐藏）时活动图层置 0，呈现纯底图；
      // 二者解除后本 effect 重跑恢复。
      layer.setOpacity(
        id === mapId && !peeking && !hidden ? clampOpacity(opacity) : 0,
      );
    }
  }, [currentEpochId, opacity, mapReady, peeking, hidden]);

  // 把最新 epoch / 透明度镜像进 ref 供 writeHash（moveend 回调）读取，并在二者变化时
  // 同步写回 hash（视野变化由 moveend 防抖写回；首屏 ready 时写一次，使无 hash 进入的
  // 地址栏立刻变成可分享深链接）。
  useEffect(() => {
    epochIdRef.current = currentEpochId;
    opacityRef.current = opacity;
    if (mapReady) writeHash();
  }, [currentEpochId, opacity, mapReady, writeHash]);

  const overlay = resolveOverlay(epochs, currentEpochId);
  const activeMap = overlay.mapId ? mapsById.get(overlay.mapId) : undefined;

  return (
    <>
      <div ref={ref} style={{ position: "absolute", inset: 0 }} />
      {!dismissed && <MapLoadingOverlay stage={stage} />}
      <Timeline
        stations={STATIONS}
        currentEpochId={currentEpochId}
        // 切换时间点应展示其老图，不延续上一站的隐藏态。
        onSelect={(id) => {
          setHidden(false);
          setCurrentEpochId(id);
        }}
      />
      <MapInfo title={activeMap?.title} />
      <OpacityControl
        value={opacity}
        // 拖动滑块即取消持久隐藏，避免「已隐藏时拖滑块看不到变化」的困惑。
        onChange={(v) => {
          setHidden(false);
          setOpacity(v);
        }}
        disabled={!activeMap}
        hidden={hidden}
        onToggleHidden={() => setHidden((h) => !h)}
      />
      <InfoButton onClick={openInfo} />
      <SourcesModal open={infoOpen} onClose={closeInfo} />
      {notice && <MapNotice text={notice} />}
    </>
  );
}
