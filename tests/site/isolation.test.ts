// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 工具隔离检查：src/tools/<A>/ 里的代码只能 import 本工具目录、src/shared/ 与 npm 包。
// 两个工具都要用的代码请先挪进 src/shared/（见 CLAUDE.md「铁律」）。
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const TOOLS = join(ROOT, "src", "tools");
const SHARED = join(ROOT, "src", "shared");
const SOURCE = /\.(ts|tsx|astro|js|mjs|css)$/;
// import x from "..." / import "..." / export ... from "..." / import("...") / new URL("...", import.meta.url)
const SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|new\s+URL\(\s*)["']([^"']+)["']/g;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return SOURCE.test(name) ? [p] : [];
  });
}

const inside = (p: string, dir: string) => p === dir || p.startsWith(dir + sep);

const tools = readdirSync(TOOLS).filter((n) =>
  statSync(join(TOOLS, n)).isDirectory(),
);

describe("工具隔离", () => {
  it("至少有一个工具目录", () => {
    expect(tools.length).toBeGreaterThan(0);
  });

  for (const tool of tools) {
    it(`${tool} 只 import 本工具、src/shared 与 npm 包`, () => {
      const own = join(TOOLS, tool);
      const offenders: string[] = [];
      for (const file of walk(own)) {
        for (const [, spec] of readFileSync(file, "utf8").matchAll(SPECIFIER)) {
          if (!spec.startsWith(".") && !spec.startsWith("/")) continue; // npm 包
          const target = resolve(dirname(file), spec);
          if (!inside(target, own) && !inside(target, SHARED)) {
            offenders.push(`${relative(ROOT, file)} → ${spec}`);
          }
        }
      }
      expect(offenders).toEqual([]);
    });
  }
});
