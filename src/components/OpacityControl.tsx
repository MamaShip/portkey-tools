// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 竖向透明度滑块：在「现今（底图）」与「历史叠加层」之间淡入淡出。
// 0 = 完全现今（叠加层透明），1 = 完全历史图。竖放（屏幕右侧）以与底部横向时间轴
// 视觉正交，呼应键盘 ↑（历史）/↓（现今）（见 plan §决策6）。纯展示组件，状态由父级持有。
// disabled（当前在「现今」站点、无历史叠加层可调）时整体置灰、不可交互。

interface OpacityControlProps {
  title: string; // 当前历史图名（disabled 时父级传「现今」等占位）
  value: number; // 0–1
  onChange: (value: number) => void;
  attribution?: string; // 角标署名
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
  gap: 8,
  background: "rgba(255,255,255,0.92)",
  borderRadius: 10,
  padding: "12px 10px",
  boxShadow: "0 1px 6px rgba(0,0,0,0.25)",
  font: "12px/1.3 system-ui, sans-serif",
  color: "#222",
  maxWidth: 132,
};

export default function OpacityControl({
  title,
  value,
  onChange,
  attribution,
  disabled = false,
}: OpacityControlProps) {
  return (
    <div style={{ ...panelStyle, opacity: disabled ? 0.5 : 1 }}>
      {/* 顶部 = 历史（↑），底部 = 现今（↓） */}
      <div
        style={{
          fontWeight: 600,
          textAlign: "center",
          maxWidth: 112,
          color: disabled ? "#888" : "#222",
        }}
      >
        {title}
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        disabled={disabled}
        aria-label="历史图透明度（↑ 看历史，↓ 看现今）"
        onChange={(e) => onChange(Number(e.target.value))}
        // writing-mode 竖排：拉到顶 = 1（历史），拉到底 = 0（现今）。
        style={{
          writingMode: "vertical-lr",
          direction: "rtl",
          height: 160,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      />
      <div style={{ fontSize: 11, color: "#666" }}>
        {Math.round(value * 100)}%
      </div>
      <div style={{ fontSize: 10, color: "#999" }}>现今</div>
      {attribution && !disabled && (
        <div
          style={{
            fontSize: 10,
            color: "#888",
            marginTop: 4,
            textAlign: "center",
            maxWidth: 112,
          }}
        >
          {attribution}
        </div>
      )}
    </div>
  );
}
