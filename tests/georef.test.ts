// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 配准 sanity 测试：拦住「配错城市 / 严重偏移」——断言标注解析出的控制点
// 地理坐标都落在成都框内、且数量达标。配准是否「像素级贴得准」无法在此断言
// （靠预览 URL 肉眼看）；这里只做廉价的代理校验。

import { describe, it, expect } from "vitest";
import { parseAnnotation } from "@allmaps/annotation";
import annotation from "../src/data/annotations/chengdu-1933.json";

// 成都大致范围（宽松，仅用于「是否在成都」判断）。
const LNG = [103.6, 104.4] as const;
const LAT = [30.3, 30.9] as const;

describe("1933 图配准 sanity", () => {
  const parsed = parseAnnotation(annotation);

  it("标注解析出恰好一张地图", () => {
    expect(parsed.length).toBe(1);
  });

  it("控制点数量达标（≥6，分布均匀以利扭合）", () => {
    expect(parsed[0].gcps.length).toBeGreaterThanOrEqual(6);
  });

  it("所有控制点的地理坐标落在成都范围内", () => {
    for (const { geo } of parsed[0].gcps) {
      const [lng, lat] = geo;
      expect(lng).toBeGreaterThanOrEqual(LNG[0]);
      expect(lng).toBeLessThanOrEqual(LNG[1]);
      expect(lat).toBeGreaterThanOrEqual(LAT[0]);
      expect(lat).toBeLessThanOrEqual(LAT[1]);
    }
  });

  it("控制点的像素坐标落在源图尺寸（9920×8006）内", () => {
    for (const { resource } of parsed[0].gcps) {
      const [x, y] = resource;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(9920);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(8006);
    }
  });
});
