// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
import type React from "react";

// 顶部居中的轻量提示条（定位失败/不在成都范围等）。纯展示、不可交互，由调用方控制出现/消失。
const style: React.CSSProperties = {
  position: "absolute",
  top: 12,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 12, // 高于地图原生控件与各 React 控件(z1)、静态返回键(z11)；定位时弹窗(z20)不可达，无冲突
  maxWidth: "min(86vw, 360px)",
  padding: "8px 14px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.94)",
  boxShadow: "0 1px 6px rgba(0,0,0,0.25)",
  font: "13px/1.4 system-ui, sans-serif",
  color: "#222",
  textAlign: "center",
  pointerEvents: "none",
};

export default function MapNotice({ text }: { text: string }) {
  return (
    <div style={style} role="status" aria-live="polite">
      {text}
    </div>
  );
}
