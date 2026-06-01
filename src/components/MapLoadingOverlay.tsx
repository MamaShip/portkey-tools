// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 地图首屏加载层：极简浅色卡片 + 分阶段文字 + 进度条。
// 进度由 MapViewer 传入的 stage 驱动（底图/历史图阶段对应 MapLibre/@allmaps 真实事件），
// 全部就绪（stage==="done"）后整层淡出。纯展示组件，无副作用。

import "./MapLoadingOverlay.css";

export type LoadStage = "init" | "historical" | "done";

interface MapLoadingOverlayProps {
  stage: LoadStage;
}

// 各阶段的状态文字与进度上限。进度条用 CSS transition 缓慢爬升到上限，
// 避免事件间隔里看起来「冻住」。
const STAGE_INFO: Record<LoadStage, { label: string; progress: number }> = {
  init: { label: "正在初始化地图…", progress: 12 },
  historical: { label: "正在加载历史地图…", progress: 85 },
  done: { label: "加载完成", progress: 100 },
};

const backdropStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 10, // 高于 OpacityControl(1) 与 NavigationControl
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(245,245,247,0.85)",
  backdropFilter: "blur(2px)",
  WebkitBackdropFilter: "blur(2px)",
  font: "13px/1.4 system-ui, sans-serif",
  color: "#222",
};

const cardStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 14,
  minWidth: 220,
  background: "#fff",
  borderRadius: 12,
  padding: "22px 28px",
  boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
};

const barTrackStyle: React.CSSProperties = {
  width: "100%",
  height: 4,
  borderRadius: 2,
  background: "rgba(0,0,0,0.08)",
  overflow: "hidden",
};

export default function MapLoadingOverlay({ stage }: MapLoadingOverlayProps) {
  const { label, progress } = STAGE_INFO[stage];
  const done = stage === "done";

  return (
    <div
      style={{
        ...backdropStyle,
        opacity: done ? 0 : 1,
        pointerEvents: done ? "none" : "auto",
        transition: "opacity 0.4s ease",
      }}
      role="status"
      aria-live="polite"
      aria-busy={!done}
    >
      <div style={cardStyle}>
        <div className="map-loading-spinner" />
        <div className="map-loading-status" style={{ fontWeight: 600 }}>
          {label}
        </div>
        <div style={barTrackStyle}>
          <div
            className="map-loading-bar-fill"
            style={{
              position: "relative",
              height: "100%",
              width: `${progress}%`,
              borderRadius: 2,
              background: "rgba(60,60,70,0.85)",
              overflow: "hidden",
              transition: "width 1.8s ease-out",
            }}
          />
        </div>
      </div>
    </div>
  );
}
