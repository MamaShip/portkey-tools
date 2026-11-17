// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 反馈链接与 issue 模板要对得上：模板改名或字段 id 改了，预填就会悄悄失效。
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { keyinBugUrl, keyinPlatformUrl } from "../../src/tools/keyin/feedback";

const template = (name: string) =>
  readFileSync(
    resolve(__dirname, "../../.github/ISSUE_TEMPLATE", name),
    "utf8",
  );

describe("反馈链接", () => {
  it("链接里的模板文件都存在，预填的字段 id 都在模板里", () => {
    const url = new URL(keyinBugUrl({ platform: "Strava", problem: "出错了" }));
    const yml = template(url.searchParams.get("template")!);
    for (const key of url.searchParams.keys()) {
      if (key !== "template") expect(yml, key).toContain(`id: ${key}\n`);
    }
    expect(url.searchParams.get("platform")).toBe("Strava");
    expect(
      template(new URL(keyinPlatformUrl).searchParams.get("template")!),
    ).toContain("id: platform");
  });

  it("报错原文太长时截短", () => {
    const url = new URL(keyinBugUrl({ problem: "错".repeat(2000) }));
    expect(url.searchParams.get("what-happened")!.length).toBe(600);
  });
});
