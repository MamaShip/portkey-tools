// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Li Song (keyin)
//
// 模型与文字：只用随站点发布的 Noto Sans（从本地文件读，不联网）。
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  binaryStl,
  box,
  closeDiagonals,
  extrudeMask,
  nonManifoldEdgeCount,
  Triangles,
} from "../../src/tools/keyin/model/mesh";
import { boxHeights, buildSkyline } from "../../src/tools/keyin/model/skyline";
import { embeddingLevels, visualOrder } from "../../src/tools/keyin/text/bidi";
import { catalog, fontFor } from "../../src/tools/keyin/text/catalog";
import {
  FontDownloadError,
  setFontLoader,
} from "../../src/tools/keyin/text/fonts";
import {
  fillNonzero,
  hanFace,
  renderTextMask,
} from "../../src/tools/keyin/text/shape";

const NOTO = resolve(
  __dirname,
  "../../src/tools/keyin/text/fonts/NotoSans-Medium.ttf",
);

beforeAll(() => {
  setFontLoader(async (font) => {
    if (font.bundled) {
      const b = readFileSync(NOTO);
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    }
    throw new FontDownloadError(`测试里不下载 ${font.name}`);
  });
});

const render = async (t: string, lh: number, ppm: number) => {
  const r = await renderTextMask(t, lh, ppm);
  return r.mask ? { mask: r.mask, mmPerPx: r.mmPerPx } : null;
};

describe("网格", () => {
  it("长方体是闭合流形", () => {
    const t = new Triangles();
    box(t, 0, 0, 1, 2, 0, 3);
    expect(t.count).toBe(12);
    expect(nonManifoldEdgeCount(t.toArray())).toBe(0);
  });

  it("只在角上相接的像素会被补成边相接", () => {
    const m = closeDiagonals({
      width: 2,
      height: 2,
      data: Uint8Array.from([1, 0, 0, 1]),
    });
    expect([...m.data].filter(Boolean).length).toBe(3);
    const t = new Triangles();
    extrudeMask(
      t,
      { width: 2, height: 2, data: Uint8Array.from([1, 0, 0, 1]) },
      0.5,
      0,
      1,
    );
    expect(nonManifoldEdgeCount(t.toArray())).toBe(0);
  });

  it("STL 的三角形个数与长度一致", () => {
    const t = new Triangles();
    box(t, 0, 0, 1, 1, 0, 1);
    const buf = binaryStl(t.toArray());
    expect(buf.byteLength).toBe(84 + 12 * 50);
    expect(new DataView(buf).getUint32(80, true)).toBe(12);
  });
});

describe("柱高", () => {
  it("映射到 1..21 mm，只取当年", () => {
    const h = boxHeights({
      year: 2025,
      label: "",
      userName: "",
      scale: "linear",
      values: {
        "2025-01-01": 1,
        "2025-06-01": 11,
        "2025-12-31": 21,
        "2024-12-31": 99,
      },
    });
    expect([...h.entries()]).toEqual([
      ["2025-01-01", 1],
      ["2025-06-01", 11],
      ["2025-12-31", 21],
    ]);
  });
});

describe("双向文字", () => {
  it("阿拉伯文后的数字归入从右往左的段", () => {
    const { levels } = embeddingLevels(Array.from("Ali علي 2025"));
    expect(levels).toEqual([0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2]);
  });

  it("视觉顺序按 L2 反转", () => {
    const runs = [
      { t: "a", level: 0 },
      { t: "b", level: 1 },
      { t: "c", level: 2 },
    ];
    expect(visualOrder(runs).map((r) => r.t)).toEqual(["a", "c", "b"]);
  });
});

describe("字体与语言", () => {
  it("清单第一个是内置的 Noto Sans，中日韩字体有 5 个地区字面", () => {
    expect(catalog[0].bundled).toBe(true);
    expect(fontFor("A".codePointAt(0)!)?.id).toBe("NotoSans");
    const cjk = fontFor("刻".codePointAt(0)!);
    expect(Object.keys(cjk!.faces).sort()).toEqual([
      "ja",
      "ko",
      "zh-HK",
      "zh-Hans",
      "zh-Hant",
    ]);
    expect(cjk!.urls[0]).toMatch(
      /^https:\/\/s3\.ap-southeast-1\.wasabisys\.com\/portkey\/tools\/keyin\/fonts\//,
    );
  });

  it("汉字写法：指定语言 > 假名/韩文 > 浏览器语言 > 简体", () => {
    expect(hanFace("刻印", "zh-TW")).toBe("zh-Hant");
    expect(hanFace("ひらがな")).toBe("ja");
    expect(hanFace("한글")).toBe("ko");
    expect(hanFace("刻印", null, "zh-HK")).toBe("zh-HK");
    expect(hanFace("刻印", null, "en-US")).toBe("zh-Hans");
  });
});

describe("文字栅格化", () => {
  it("非零环绕：方块内部填满", () => {
    const mask = { width: 10, height: 10, data: new Uint8Array(100) };
    fillNonzero([[2, 2, 8, 2, 8, 8, 2, 8]], mask);
    expect([...mask.data].filter(Boolean).length).toBe(36);
  });

  it("拉丁文字：行框高度固定，横向裁到笔画", async () => {
    const a = await renderTextMask("GitHub", 6.5, 20);
    const b = await renderTextMask("ygq", 6.5, 20);
    expect(a.mask && b.mask).toBeTruthy();
    // 所有文字共用同一个行框
    expect(Math.abs(a.mask!.height - b.mask!.height)).toBeLessThanOrEqual(2);
    expect(a.mask!.height).toBeGreaterThanOrEqual(130);
    expect(a.mask!.width).toBeGreaterThan(200);
    expect(a.warnings).toEqual([]);
  });

  it("下载失败时给出警告，用方框代替", async () => {
    const r = await renderTextMask("A刻", 6.5, 20);
    expect(r.mask).not.toBeNull();
    expect(r.warnings.join("\n")).toMatch(/测试里不下载/);
  });
});

describe("完整模型", () => {
  it("带文字的模型没有非流形边", async () => {
    const values: Record<string, number> = {};
    for (let d = 0; d < 365; d += 3) {
      const day = new Date(Date.UTC(2025, 0, 1 + d)).toISOString().slice(0, 10);
      values[day] = (d * 37) % 50;
    }
    const tris = await buildSkyline(
      {
        year: 2025,
        label: "GitHub",
        userName: "Li Song",
        values,
        scale: "sqrt",
      },
      render,
    );
    expect(tris.length / 9).toBeGreaterThan(10_000);
    expect(nonManifoldEdgeCount(tris)).toBe(0);
  }, 60_000);
});
