// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 底部站点横条：离散时间轴（左旧 → 右新，每个站点对应一张历史图）。状态由父级（MapViewer）
// 持有；点击站点切换；键盘 ←/→ 由 MapViewer 的全局处理器统一驱动（方向键二维控制器的
// 「时间轴」轴，见 plan §决策6），本组件不各自绑键。点击站点时浮现一个短时提示，
// 告知桌面端用户可用 ← → 键切换（仅在有键盘的设备上，见 SUPPORTS_KEYBOARD_HINT）。

import { useEffect, useRef, useState } from "react";
import type { Epoch } from "../data/schema";
import { SUPPORTS_KEYBOARD_HINT } from "../lib/device";
import { useMediaQuery } from "./useMediaQuery";

interface TimelineProps {
  stations: readonly Epoch[]; // 已按 order 升序（timelineStations）
  currentEpochId: string;
  onSelect: (id: string) => void;
}

// 外层定位容器：承载居中/底距/层级，且**不裁剪**（overflow 保持 visible），
// 使上方浮现的提示不被滚动的横条裁掉。
const wrapperStyle: React.CSSProperties = {
  position: "absolute",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 1,
};

// 内层横条（药丸）：可横向滚动。注意——`overflowX:auto` 会令另一轴 overflow 计算为
// auto，从而垂直裁剪；故提示必须放在 wrapper 内、横条**外**，而非作为横条的子节点。
const panelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 0,
  maxWidth: "min(92vw, 680px)",
  // 站点多时（随增图变多）允许横向滚动，配合 stationStyle 的 flexShrink:0 不挤压。
  overflowX: "auto",
  background: "rgba(255,255,255,0.92)",
  borderRadius: 999,
  boxShadow: "0 1px 6px rgba(0,0,0,0.25)",
  color: "#222",
};

const stationStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 6,
  flexShrink: 0, // 不被压扁：宁可整条横向滚动，也保持每个站点可点可读
  background: "transparent",
  border: "none",
  cursor: "pointer",
  color: "inherit",
  font: "inherit",
};

// 点击站点后浮现在时间轴上方的短时提示（贴在面板上沿外侧，淡入淡出，不拦截指针）。
const hintStyle: React.CSSProperties = {
  position: "absolute",
  bottom: "100%",
  left: "50%",
  transform: "translateX(-50%)",
  marginBottom: 8,
  whiteSpace: "nowrap",
  background: "rgba(0,0,0,0.78)",
  color: "#fff",
  borderRadius: 6,
  padding: "5px 9px",
  fontSize: 12,
  lineHeight: 1,
  pointerEvents: "none",
  transition: "opacity 0.25s",
};

const kbdStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.22)",
  borderRadius: 3,
  padding: "1px 5px",
  fontFamily: "inherit",
};

export default function Timeline({
  stations,
  currentEpochId,
  onSelect,
}: TimelineProps) {
  const [showHint, setShowHint] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  // 窄屏：抬高时间轴避让左下「来源 ⓘ」按钮与右下署名，并收紧 padding/字号。
  const narrow = useMediaQuery("(max-width: 480px)");
  const responsiveWrapper: React.CSSProperties = {
    bottom: narrow ? 64 : 28,
  };
  const responsivePanel: React.CSSProperties = {
    padding: narrow ? "7px 10px" : "10px 18px",
    font: `${narrow ? 11 : 13}px/1.2 system-ui, sans-serif`,
  };
  const responsiveStation: React.CSSProperties = {
    padding: narrow ? "2px 6px" : "2px 10px",
  };

  // 点击切换站点：照常通知父级；桌面端（有键盘）再浮现 ~2s 的「← → 切换」提示。
  const handleSelect = (id: string) => {
    onSelect(id);
    if (!SUPPORTS_KEYBOARD_HINT) return;
    setShowHint(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowHint(false), 2000);
  };

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  return (
    <div style={{ ...wrapperStyle, ...responsiveWrapper }}>
      {/* 点击后短时提示：可用 ← → 键切换年代（触摸端不显示）。放在横条外，避免被横向
          滚动容器垂直裁剪 */}
      <div style={{ ...hintStyle, opacity: showHint ? 1 : 0 }}>
        <kbd style={kbdStyle}>←</kbd> <kbd style={kbdStyle}>→</kbd> 切换年代
      </div>
      <div
        style={{ ...panelStyle, ...responsivePanel }}
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
              onClick={() => handleSelect(s.id)}
              style={{ ...stationStyle, ...responsiveStation }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: active ? 14 : 10,
                  height: active ? 14 : 10,
                  borderRadius: "50%",
                  background: active ? "#1f6feb" : "#bbb",
                  boxShadow: active
                    ? "0 0 0 3px rgba(31,111,235,0.25)"
                    : "none",
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
    </div>
  );
}
