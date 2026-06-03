// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// DOM 级冒烟（plan §8）：不验像素贴合（无头 CI 里 WebGL 像素不稳定），只断言
// 「地图挂载 + 无未捕获异常 + 深链接还原 epoch + 移动视口控件可见」这些可靠信号。

import { test, expect } from "@playwright/test";

// 无头 Chromium 用 SwiftShader 软渲染，WebGL 着色器常编译失败（"Could not compile
// fragment shader" 等）——这是环境限制而非应用缺陷（真机带 GPU 正常），按 plan §8 不据此
// 判定失败；过滤掉 GPU/着色器类噪声，只保留真正的 JS 未捕获异常作为断言信号。
const GPU_NOISE = /shader|webgl|gl_|gpu|getprograminfolog|texImage/i;

test("地图挂载且无未捕获异常", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => {
    if (!GPU_NOISE.test(e.message)) pageErrors.push(e.message);
  });

  await page.goto("/cd-old-map");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({
    timeout: 30_000,
  });
  // 时间轴与（默认开局历史 epoch 下的）透明度滑块都应挂出。
  await expect(page.getByRole("radiogroup")).toBeVisible();
  await expect(page.getByRole("slider")).toBeVisible();

  expect(pageErrors, `未捕获异常：\n${pageErrors.join("\n")}`).toEqual([]);
});

test("深链接还原指定 epoch", async ({ page }) => {
  // 进入带 hash 的深链接：1944 站点应被选中（DOM 级，不验像素位置）。
  await page.goto("/cd-old-map#epoch=1944&c=30.66,104.06&z=13&o=0.6");
  await expect(page.getByRole("radio", { name: "1944" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("点击时间轴站点浮现键盘提示且在横条上方（不被裁剪）", async ({ page }) => {
  await page.goto("/cd-old-map");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({
    timeout: 30_000,
  });
  const hint = page.getByText("切换年代");
  await expect(hint).toHaveCSS("opacity", "0"); // 初始隐藏
  await page.getByRole("radio", { name: "1911" }).click();
  await expect(hint).toHaveCSS("opacity", "1"); // 点击后浮现

  // 提示应整体位于时间轴横条上方（回归守卫：曾因横条 overflowX 把上方提示裁掉）。
  const hintBox = await hint.boundingBox();
  const panelBox = await page.getByRole("radiogroup").boundingBox();
  expect(hintBox).not.toBeNull();
  expect(panelBox).not.toBeNull();
  expect(hintBox!.y + hintBox!.height).toBeLessThanOrEqual(panelBox!.y + 1);
});

test("无 hash 进入后地址栏被写成可分享深链接", async ({ page }) => {
  await page.goto("/cd-old-map");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({
    timeout: 30_000,
  });
  // 首屏 ready 后会 replaceState 写入 epoch/视野/透明度。
  await expect.poll(() => page.url(), { timeout: 15_000 }).toMatch(/#.*epoch=/);
});

test("移动视口下核心控件可见", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cd-old-map");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("radiogroup")).toBeVisible();
  await expect(page.getByLabel("返回首页")).toBeVisible();
});
