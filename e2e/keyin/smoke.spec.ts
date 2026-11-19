// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 刻印的 DOM 级冒烟：读一份 JSON → worker 生成模型 → 能下载 STL。
// 只用西文（内置字体），不依赖字体下载；GitHub 需要 Pages Function，本地预览里没有，不测。

import { test, expect } from "@playwright/test";

// 无头 Chromium 的 WebGL 噪声（见 e2e/cd-old-map/smoke.spec.ts）
const GPU_NOISE = /shader|webgl|gl_|gpu|getprograminfolog|texImage/i;

function sampleYear(year: number) {
  const values: Record<string, number> = {};
  for (let d = 0; d < 365; d += 2) {
    const day = new Date(Date.UTC(year, 0, 1 + d)).toISOString().slice(0, 10);
    values[day] = 1 + (d % 17);
  }
  return values;
}

test("读 JSON、生成并下载 STL", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => {
    if (!GPU_NOISE.test(e.message)) pageErrors.push(e.message);
  });

  await page.goto("/keyin");
  // 进入页面先生成示例模型；示例不提供下载
  await expect(page.locator(".keyin-badge")).toHaveText("示例", {
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: /下载 STL/ })).toHaveCount(0);

  await page.getByRole("radio", { name: "自己的数据" }).click();
  await page.locator(".keyin-data input[type=file]").setInputFiles({
    name: "steps.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(sampleYear(2025))),
  });
  await expect(page.locator(".keyin-summary")).toContainText(
    "2025 年有 183 天有记录",
  );

  await page.getByLabel("名字").fill("Li Song");
  await page.getByLabel("平台名").fill("Steps");

  const button = page.getByRole("button", { name: /下载 STL/ });
  await expect(button).toBeVisible({ timeout: 30_000 });
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    button.click(),
  ]);
  expect(download.suggestedFilename()).toBe("keyin_custom_2025.stl");

  expect(pageErrors, `未捕获异常：\n${pageErrors.join("\n")}`).toEqual([]);
});
