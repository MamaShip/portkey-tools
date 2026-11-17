// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 「关于」信息按钮：左下角空位（避开右上 NavigationControl、右侧 OpacityControl、
// 底部居中 Timeline、左上 MapInfo）。点击打开 SourcesModal。纯展示，状态由父级持有。

interface InfoButtonProps {
  onClick: () => void;
}

const buttonStyle: React.CSSProperties = {
  position: "absolute",
  left: 12,
  bottom: 12,
  zIndex: 1,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 12px",
  border: "none",
  borderRadius: 10,
  background: "rgba(255,255,255,0.92)",
  boxShadow: "0 1px 6px rgba(0,0,0,0.25)",
  font: "13px/1 system-ui, sans-serif",
  color: "#222",
  cursor: "pointer",
};

export default function InfoButton({ onClick }: InfoButtonProps) {
  return (
    <button
      style={buttonStyle}
      onClick={onClick}
      aria-label="关于"
      title="关于"
    >
      <span aria-hidden="true" style={{ fontSize: 15 }}>
        ⓘ
      </span>
      关于
    </button>
  );
}
