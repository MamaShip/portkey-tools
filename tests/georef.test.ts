// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 配准 sanity 测试：拦住「配错城市 / 严重偏移」——断言每张图标注解析出的控制点
// 地理坐标都落在成都框内、数量达标、像素坐标在源图尺寸内。配准是否「像素级贴得准」
// 无法在此断言（靠预览 URL 肉眼看）；这里只做廉价的代理校验。
//
// 遍历 maps 登记表（标注经 src/lib/annotations.ts 自动装载）——新增一张图自动获得覆盖，
// 无需在此手写断言。

import { describe, it, expect } from "vitest";
import { parseAnnotation } from "@allmaps/annotation";
import { maps } from "../src/data/maps";
import { getAnnotation } from "../src/lib/annotations";

// 成都大致范围（宽松，仅用于「是否在成都」判断）。
const LNG = [103.6, 104.4] as const;
const LAT = [30.3, 30.9] as const;

describe("历史地图配准 sanity", () => {
  it("至少登记了一张图", () => {
    expect(maps.length).toBeGreaterThanOrEqual(1);
  });

  describe.each(maps)("$id（$title）", (m) => {
    const annotation = getAnnotation(m.id);

    it("标注存在且解析出恰好一张地图", () => {
      expect(annotation, `缺少 ${m.id} 的标注`).toBeDefined();
      expect(parseAnnotation(annotation).length).toBe(1);
    });

    it("控制点数量达标（≥6，分布均匀以利扭合）", () => {
      const [parsed] = parseAnnotation(annotation);
      expect(parsed.gcps.length).toBeGreaterThanOrEqual(6);
    });

    it("所有控制点的地理坐标落在成都范围内", () => {
      const [parsed] = parseAnnotation(annotation);
      for (const { geo } of parsed.gcps) {
        const [lng, lat] = geo;
        expect(lng).toBeGreaterThanOrEqual(LNG[0]);
        expect(lng).toBeLessThanOrEqual(LNG[1]);
        expect(lat).toBeGreaterThanOrEqual(LAT[0]);
        expect(lat).toBeLessThanOrEqual(LAT[1]);
      }
    });

    it("控制点的像素坐标落在源图尺寸内", () => {
      const [parsed] = parseAnnotation(annotation);
      // 源图尺寸在标注里应有值；一并断言其存在（同时得到非 undefined 的 number）。
      const width = parsed.resource.width ?? 0;
      const height = parsed.resource.height ?? 0;
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
      for (const { resource } of parsed.gcps) {
        const [x, y] = resource;
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(width);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(height);
      }
    });
  });
});
