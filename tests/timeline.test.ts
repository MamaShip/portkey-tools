// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip

import { describe, it, expect } from "vitest";
import {
  sortEpochs,
  getEpochById,
  resolveOverlay,
  timelineStations,
  stepEpoch,
} from "../src/lib/timeline";
import type { Epoch } from "../src/data/schema";

const sample: Epoch[] = [
  { id: "present", label: "现今", order: 100, kind: "basemap" },
  {
    id: "1933",
    label: "1933",
    order: 50,
    kind: "historical",
    mapId: "chengdu-1933",
  },
  {
    id: "1909",
    label: "宣统",
    order: 10,
    kind: "historical",
    mapId: "chengdu-1909",
  },
];

describe("sortEpochs", () => {
  it("按 order 升序排序", () => {
    expect(sortEpochs(sample).map((e) => e.id)).toEqual([
      "1909",
      "1933",
      "present",
    ]);
  });

  it("不就地修改入参", () => {
    const original = sample.map((e) => e.id);
    sortEpochs(sample);
    expect(sample.map((e) => e.id)).toEqual(original);
  });
});

describe("getEpochById", () => {
  it("命中返回对应 epoch", () => {
    expect(getEpochById(sample, "1933")?.label).toBe("1933");
  });
  it("未命中返回 undefined", () => {
    expect(getEpochById(sample, "nope")).toBeUndefined();
  });
});

describe("resolveOverlay", () => {
  it("basemap epoch → 无叠加层", () => {
    expect(resolveOverlay(sample, "present")).toEqual({
      kind: "basemap",
      mapId: null,
    });
  });

  it("historical epoch → 返回 mapId", () => {
    expect(resolveOverlay(sample, "1933")).toEqual({
      kind: "historical",
      mapId: "chengdu-1933",
    });
  });

  it("未知 id → 退回 basemap", () => {
    expect(resolveOverlay(sample, "nope")).toEqual({
      kind: "basemap",
      mapId: null,
    });
  });

  it("historical 但缺 mapId → mapId 为 null", () => {
    const broken: Epoch[] = [
      { id: "x", label: "x", order: 1, kind: "historical" },
    ];
    expect(resolveOverlay(broken, "x")).toEqual({
      kind: "historical",
      mapId: null,
    });
  });
});

describe("timelineStations", () => {
  it("按 order 升序（左旧 → 右新，最右 present）", () => {
    expect(timelineStations(sample).map((e) => e.id)).toEqual([
      "1909",
      "1933",
      "present",
    ]);
  });
});

describe("stepEpoch", () => {
  // 站点（order 升序）：1909 → 1933 → present
  it("→（dir=1）走向更新年代", () => {
    expect(stepEpoch(sample, "1909", 1)).toBe("1933");
    expect(stepEpoch(sample, "1933", 1)).toBe("present");
  });

  it("←（dir=-1）走向更旧年代", () => {
    expect(stepEpoch(sample, "present", -1)).toBe("1933");
    expect(stepEpoch(sample, "1933", -1)).toBe("1909");
  });

  it("边界饱和：最新再 → 停在原地", () => {
    expect(stepEpoch(sample, "present", 1)).toBe("present");
  });

  it("边界饱和：最旧再 ← 停在原地", () => {
    expect(stepEpoch(sample, "1909", -1)).toBe("1909");
  });

  it("未知 id：→ 回退到最旧端点，← 回退到最新端点", () => {
    expect(stepEpoch(sample, "nope", 1)).toBe("1909");
    expect(stepEpoch(sample, "nope", -1)).toBe("present");
  });

  it("空表：原样返回", () => {
    expect(stepEpoch([], "x", 1)).toBe("x");
  });
});
