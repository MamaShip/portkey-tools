// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip

import { describe, it, expect } from "vitest";
import { serializeView, parseView, type View } from "../src/lib/deeplink";

const VALID = ["present", "1911", "1933", "1944"] as const;

describe("serializeView", () => {
  it("序列化全部字段，键顺序固定 epoch,c,z,o（c 为 lat,lng）", () => {
    const s = serializeView({
      epochId: "1933",
      lat: 30.6601,
      lng: 104.0633,
      zoom: 14.2,
      opacity: 0.7,
    });
    expect(s).toBe("epoch=1933&c=30.6601%2C104.0633&z=14.2&o=0.7");
  });

  it("按精度截断并去掉尾随 0", () => {
    const s = serializeView({
      lat: 30.66012345,
      lng: 104.06334999,
      zoom: 14.2,
      opacity: 0.7,
    });
    // 经纬度 4 位、zoom/opacity 去尾随 0
    expect(s).toContain("c=30.6601%2C104.0633");
    expect(s).toContain("z=14.2");
    expect(s).toContain("o=0.7");
  });

  it("跳过缺失或非有限字段", () => {
    expect(serializeView({})).toBe("");
    expect(serializeView({ epochId: "present" })).toBe("epoch=present");
    expect(serializeView({ lng: NaN, lat: 30, zoom: Infinity })).toBe("");
  });
});

describe("parseView", () => {
  it("解析完整 hash（容忍前导 #）", () => {
    const v = parseView("#epoch=1933&c=30.6601,104.0633&z=14.2&o=0.7", {
      validEpochIds: VALID,
    });
    expect(v).toEqual({
      epochId: "1933",
      lat: 30.6601,
      lng: 104.0633,
      zoom: 14.2,
      opacity: 0.7,
    });
  });

  it("未知 epoch 被丢弃（在 validEpochIds 之外）", () => {
    const v = parseView("epoch=9999", { validEpochIds: VALID });
    expect(v.epochId).toBeUndefined();
  });

  it("不给 validEpochIds 时不校验 epoch", () => {
    expect(parseView("epoch=anything").epochId).toBe("anything");
  });

  it("opacity 越界经 clampOpacity 夹取", () => {
    expect(parseView("o=2").opacity).toBe(1);
    expect(parseView("o=-1").opacity).toBe(0);
  });

  it("丢弃非法/不完整字段，永不抛错", () => {
    expect(parseView("c=abc,def")).toEqual({});
    expect(parseView("c=30.6")).toEqual({}); // 缺 lng
    expect(parseView("z=&o=")).toEqual({}); // 空值
    expect(parseView("z=NaN")).toEqual({});
    expect(parseView("")).toEqual({});
    expect(() => parseView("%%%garbage&&&")).not.toThrow();
  });
});

describe("往返一致性（serialize → parse 还原）", () => {
  it("典型视图在精度容差内往返一致", () => {
    const view: View = {
      epochId: "1944",
      lat: 30.6601,
      lng: 104.0633,
      zoom: 13.5,
      opacity: 0.65,
    };
    const round = parseView(serializeView(view), { validEpochIds: VALID });
    expect(round).toEqual(view);
  });

  it("二次往返稳定（幂等）", () => {
    const once = serializeView({
      epochId: "1911",
      lat: 30.123456,
      lng: 104.987654,
      zoom: 12.345,
      opacity: 0.333,
    });
    const parsed = parseView(once, { validEpochIds: VALID });
    expect(serializeView(parsed)).toBe(once);
  });
});
