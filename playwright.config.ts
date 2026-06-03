// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// E2E 冒烟配置（Phase 3）。遵循 plan §8 的「廉价代理测试」哲学：只在真实浏览器里做
// DOM 级断言（canvas 挂载、无未捕获异常、深链接还原、移动视口控件可见），**不做像素
// diff**（WebGL 在无头 CI 里像素不稳定）。webServer 跑生产构建预览（更贴近线上）。

import { defineConfig, devices } from "@playwright/test";

const PORT = 4321;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm build && pnpm preview --port ${PORT}`,
    url: `${BASE_URL}/cd-old-map`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
