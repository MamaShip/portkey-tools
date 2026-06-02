// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 竖向透明度滑块：在「现今（底图）」与「历史叠加层」之间淡入淡出。
// 0 = 完全现今（叠加层透明），1 = 完全历史图。竖放（屏幕右侧）以与底部横向时间轴
// 视觉正交，呼应键盘 ↑（历史）/↓（现今）（见 plan §决策6）。纯展示组件，状态由父级持有。
// 极简：只保留滑块与「古 / 今」两端标识；地图名/署名等信息移至 MapInfo 单独呈现。
// disabled（当前在「现今」站点、无历史叠加层可调）时整体置灰、不可交互。

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

export default function OpacityControl({
  value,
  onChange,
  disabled = false,
}: OpacityControlProps) {
  return (
    <div style={{ ...panelStyle, opacity: disabled ? 0.5 : 1 }}>
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
        onChange={(e) => onChange(Number(e.target.value))}
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
