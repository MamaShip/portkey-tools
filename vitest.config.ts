// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Phase 0 尚无单测；配准 sanity 与逻辑单测在 Phase 1 补齐。
    passWithNoTests: true,
  },
});
