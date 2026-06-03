// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 仅收 tests/ 下的单测；否则 vitest 默认 glob 会连 e2e/*.spec.ts（Playwright）一起
    // 抓进来跑而报错（Playwright 用 `pnpm test:e2e` 单独跑，见 playwright.config.ts）。
    include: ["tests/**/*.test.ts"],
    passWithNoTests: true,
  },
});
