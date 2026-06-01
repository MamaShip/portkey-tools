// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 受控透明度滑块：在「现今（底图）」与「历史叠加层」之间淡入淡出。
// 0 = 完全现今（叠加层透明），1 = 完全历史图。纯展示组件，状态由父级持有。

interface OpacityControlProps {
  title: string; // 当前历史图名
  value: number; // 0–1
  onChange: (value: number) => void;
  attribution?: string; // 角标署名
}

const panelStyle: React.CSSProperties = {
  position: "absolute",
  left: 12,
  bottom: 28,
  zIndex: 1,
  background: "rgba(255,255,255,0.92)",
  borderRadius: 8,
  padding: "10px 14px",
  boxShadow: "0 1px 6px rgba(0,0,0,0.25)",
  font: "13px/1.4 system-ui, sans-serif",
  color: "#222",
  maxWidth: 260,
};

export default function OpacityControl({
  title,
  value,
  onChange,
  attribution,
}: OpacityControlProps) {
  return (
    <div style={panelStyle}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{title}</div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        aria-label="历史图透明度"
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", display: "block" }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "#666",
          marginTop: 2,
        }}
      >
        <span>现今</span>
        <span>{Math.round(value * 100)}%</span>
        <span>{title}</span>
      </div>
      {attribution && (
        <div style={{ fontSize: 11, color: "#888", marginTop: 6 }}>
          {attribution}
        </div>
      )}
    </div>
  );
}
