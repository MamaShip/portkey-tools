// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 当前历史图信息卡：图名 + 署名。左上角呈现，与右侧极简透明度滑块、底部时间轴各司其职，
// 避免把地图元数据挤进控制块（见 OpacityControl）。纯展示组件，状态由父级持有。
// 当前在「现今」站点（无历史叠加层）时不渲染。

interface MapInfoProps {
  title?: string; // 当前历史图名；无则不渲染
  attribution?: string; // 角标署名
}

const panelStyle: React.CSSProperties = {
  position: "absolute",
  left: 12,
  top: 12,
  zIndex: 1,
  maxWidth: "min(72vw, 320px)",
  background: "rgba(255,255,255,0.92)",
  borderRadius: 10,
  padding: "10px 14px",
  boxShadow: "0 1px 6px rgba(0,0,0,0.25)",
  font: "13px/1.4 system-ui, sans-serif",
  color: "#222",
};

export default function MapInfo({ title, attribution }: MapInfoProps) {
  if (!title) return null;
  return (
    <div style={panelStyle}>
      <div style={{ fontWeight: 600 }}>{title}</div>
      {attribution && (
        <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
          {attribution}
        </div>
      )}
    </div>
  );
}
