// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 竖向透明度滑块：在「现今（底图）」与「历史叠加层」之间淡入淡出。
// 0 = 完全现今（叠加层透明），1 = 完全历史图。竖放（屏幕右侧）以与底部横向时间轴
// 视觉正交，呼应键盘 ↑（历史）/↓（现今）（见 plan §决策6）。纯展示组件，状态由父级持有。
// 极简：只保留滑块与「古 / 今」两端标识；地图名/署名等信息移至 MapInfo 单独呈现。
// disabled（当前在「现今」站点、无历史叠加层可调）时整体置灰、不可交互。
// 拖动滑块时在其左侧浮现「按住空格速看底图」提示，停止拖动约 2s 后淡出（提示自包含于本组件）。

import { useEffect, useRef, useState } from "react";

interface OpacityControlProps {
  value: number; // 0–1
  onChange: (value: number) => void;
  disabled?: boolean; // 当前无历史叠加层时置灰
}

const panelStyle: React.CSSProperties = {
  position: "absolute",
  right: 12,
  top: "50%",
  transform: "translateY(-50%)",
  zIndex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 6,
  background: "rgba(255,255,255,0.92)",
  borderRadius: 999,
  padding: "10px 6px",
  boxShadow: "0 1px 6px rgba(0,0,0,0.25)",
  font: "12px/1 system-ui, sans-serif",
  color: "#444",
};

const hintStyle: React.CSSProperties = {
  position: "absolute",
  right: "100%",
  marginRight: 8,
  top: "50%",
  transform: "translateY(-50%)",
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

// 仅在有精确指针 + 悬停能力的设备（≈ 桌面端，有物理键盘）上提示空格快捷键；
// 触摸端（手机/平板）无空格键，拖动滑块时不显示该提示。本组件为 client:only，运行在浏览器。
const SUPPORTS_KEYBOARD_HINT =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(hover: hover) and (pointer: fine)").matches;

export default function OpacityControl({
  value,
  onChange,
  disabled = false,
}: OpacityControlProps) {
  const [showHint, setShowHint] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // 拖动中（range onChange 持续触发）浮现提示，停止 ~2s 后淡出。
  // 触摸端无空格键，跳过提示（见 SUPPORTS_KEYBOARD_HINT）。
  const handleChange = (v: number) => {
    onChange(v);
    if (!SUPPORTS_KEYBOARD_HINT) return;
    setShowHint(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowHint(false), 2000);
  };

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  return (
    <div style={{ ...panelStyle, opacity: disabled ? 0.5 : 1 }}>
      {/* 空格速看提示：贴在滑块面板左外侧，淡入淡出，不拦截指针 */}
      <div style={{ ...hintStyle, opacity: showHint ? 1 : 0 }}>
        按住 <kbd style={kbdStyle}>空格</kbd> 隐藏图层
      </div>
      {/* 顶部 = 古（历史，↑），底部 = 今（现今，↓） */}
      <div aria-hidden="true" style={{ fontWeight: 600 }}>
        古
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        disabled={disabled}
        aria-label="历史图透明度（↑ 看历史，↓ 看现今）"
        onChange={(e) => handleChange(Number(e.target.value))}
        // writing-mode 竖排：拉到顶 = 1（古/历史），拉到底 = 0（今/现今）。
        style={{
          writingMode: "vertical-lr",
          direction: "rtl",
          height: 150,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      />
      <div aria-hidden="true" style={{ fontWeight: 600 }}>
        今
      </div>
    </div>
  );
}
