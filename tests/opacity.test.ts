// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip

import { describe, it, expect } from "vitest";
import { clampOpacity } from "../src/lib/opacity";

describe("clampOpacity", () => {
  it("区间内原样返回", () => {
    expect(clampOpacity(0)).toBe(0);
    expect(clampOpacity(0.7)).toBe(0.7);
    expect(clampOpacity(1)).toBe(1);
  });

  it("越界夹取到 [0,1]", () => {
    expect(clampOpacity(-0.5)).toBe(0);
    expect(clampOpacity(1.5)).toBe(1);
  });

  it("非有限数回退到 fallback", () => {
    expect(clampOpacity(NaN)).toBe(1);
    expect(clampOpacity(Infinity)).toBe(1);
    expect(clampOpacity(NaN, 0.3)).toBe(0.3);
  });
});
