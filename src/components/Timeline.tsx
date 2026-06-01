// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 底部站点横条：离散时间轴（左旧 → 右新，最右通常是「现今」）。纯展示组件，
// 状态由父级（MapViewer）持有。点击站点切换；键盘 ←/→ 由 MapViewer 的全局
// 处理器统一驱动（方向键二维控制器的「时间轴」轴，见 plan §决策6），本组件不各自绑键。

import type { Epoch } from "../data/schema";

interface TimelineProps {
  stations: readonly Epoch[]; // 已按 order 升序（timelineStations）
  currentEpochId: string;
  onSelect: (id: string) => void;
}

const panelStyle: React.CSSProperties = {
  position: "absolute",
  left: "50%",
  bottom: 28,
  transform: "translateX(-50%)",
  zIndex: 1,
  display: "flex",
  alignItems: "flex-start",
  gap: 0,
  maxWidth: "min(92vw, 680px)",
  padding: "10px 18px",
  background: "rgba(255,255,255,0.92)",
  borderRadius: 999,
  boxShadow: "0 1px 6px rgba(0,0,0,0.25)",
  font: "13px/1.2 system-ui, sans-serif",
  color: "#222",
};

const stationStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 6,
  background: "transparent",
  border: "none",
  padding: "2px 10px",
  cursor: "pointer",
  color: "inherit",
  font: "inherit",
};

export default function Timeline({
  stations,
  currentEpochId,
  onSelect,
}: TimelineProps) {
  return (
    <div
      style={panelStyle}
      role="radiogroup"
      aria-label="历史地图时间轴（左旧右新，方向键 ← → 切换）"
    >
      {stations.map((s) => {
        const active = s.id === currentEpochId;
        return (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-current={active ? "true" : undefined}
            title={s.label}
            onClick={() => onSelect(s.id)}
            style={stationStyle}
          >
            <span
              aria-hidden="true"
              style={{
                width: active ? 14 : 10,
                height: active ? 14 : 10,
                borderRadius: "50%",
                background: active ? "#1f6feb" : "#bbb",
                boxShadow: active ? "0 0 0 3px rgba(31,111,235,0.25)" : "none",
                transition: "all 0.15s ease",
              }}
            />
            <span
              style={{
                fontWeight: active ? 700 : 400,
                color: active ? "#1f6feb" : "#555",
                whiteSpace: "nowrap",
              }}
            >
              {s.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
