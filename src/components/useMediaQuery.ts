// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 订阅一个 CSS media query 的匹配状态，变化时触发重渲染。SSR / 无 matchMedia 时回退
// false。地图工具的控件全程用内联 style（无类名挂 CSS @media），故用此 hook 在 JS 里
// 按视口切换尺寸，避免内联样式与样式表的优先级之争。

import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange(); // 挂载后立刻同步一次（初值 false，避免 SSR 抖动）
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}
