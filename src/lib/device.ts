// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 设备能力探测：是否为「有精确指针 + 悬停能力」的设备（≈ 桌面端，通常有物理键盘）。
// 用于决定要不要展示键盘快捷键提示（空格速看 / ↑↓ 调透明度 / ←→ 切换年代）——
// 触摸端（手机/平板）无这些键，提示无意义。使用方组件均 client:only，运行在浏览器。

export const SUPPORTS_KEYBOARD_HINT =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(hover: hover) and (pointer: fine)").matches;
