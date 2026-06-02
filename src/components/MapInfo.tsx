// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 当前历史图名：作为一行无框的题字，与左上角返回按钮排在同一行（像面包屑），不再用
// 白底卡片（免得与返回按钮两个玻璃块在同一角落堆叠）。署名/来源/许可不在此展示，统一
// 收进「关于」来源弹窗（见 SourcesModal）。状态由父级持有。
// 当前在「现今」站点（无历史叠加层）时不渲染。
//
// 返回按钮是 .astro 里的静态 HTML（#map-back，零 JS 随首帧即现），题字是动态的
// （随时间轴切换）。两者是各自绝对定位的兄弟节点，故这里量出按钮的实际位置/尺寸再把
// 题字接在其右——「首页」二字宽度因平台中文字体而异，硬编码像素会错位，量一次最稳。
import { useLayoutEffect, useState } from "react";

interface MapInfoProps {
  title?: string; // 当前历史图名；无则不渲染
}

// 题字相对返回按钮的水平间距（含一个分隔点的留白）。
const GAP = 10;

export default function MapInfo({ title }: MapInfoProps) {
  // 量出返回按钮的位置/尺寸，使题字与之同行并垂直居中对齐。
  const [box, setBox] = useState<{
    left: number;
    top: number;
    height: number;
  } | null>(null);

  useLayoutEffect(() => {
    const back = document.getElementById("map-back");
    if (!back) return;
    // 返回按钮与本组件共享同一定位上下文，offset* 即同坐标系下的位置/尺寸。
    const measure = () =>
      setBox({
        left: back.offsetLeft + back.offsetWidth + GAP,
        top: back.offsetTop,
        height: back.offsetHeight,
      });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(back);
    return () => ro.disconnect();
  }, []);

  if (!title) return null;

  const style: React.CSSProperties = {
    position: "absolute",
    left: box?.left ?? 56,
    top: box?.top ?? 12,
    height: box?.height,
    zIndex: 1,
    display: "flex",
    alignItems: "center", // 与按钮同行垂直居中
    maxWidth: "min(60vw, 320px)",
    // 比返回按钮（13px）大一档：按钮整块的高度会让人视觉上高估其字号，题字需更大才显得相称。
    font: "600 18px/1 system-ui, sans-serif",
    color: "#1a1a1a",
    whiteSpace: "nowrap",
    // 浅色底图上保证可读：白色光晕描边，不靠背景框。
    textShadow:
      "0 0 3px rgba(255,255,255,0.9), 0 1px 2px rgba(255,255,255,0.9)",
    pointerEvents: "none",
  };

  return (
    <div style={style}>
      {/* minWidth:0 才能让 flex 子项在超宽时省略号截断 */}
      <span
        style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}
      >
        《{title}》
      </span>
    </div>
  );
}
