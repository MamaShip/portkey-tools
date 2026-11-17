// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 把刻印要按需下载的 Noto 字体全部下载到本地、校验 sha256，按 Wasabi 上的目录摆好，
// 然后打印上传命令。字体未经修改，与 OFL.txt 一起上传。
//
//   pnpm keyin:stage-fonts            # → keyin-fonts-dist/（约 43 MB，已在 .gitignore）
//
// 目录约定见 docs/object-storage.md：portkey/tools/keyin/fonts/<commit 前 12 位>/<文件名>
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { catalog } from "../../src/tools/keyin/text/catalog";

const OUT = "keyin-fonts-dist";
const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

async function main() {
  let fetched = 0;
  let total = 0;
  for (const font of catalog) {
    if (font.bundled) continue; // 随站点发布，不上 Wasabi
    const file = join(OUT, font.mirrorKey);
    total += font.size;
    if (existsSync(file) && sha256(readFileSync(file)) === font.sha256)
      continue;
    // 第一个地址是 Wasabi 本身，这里从上游（GitHub，失败再 jsDelivr）取
    let ok = false;
    for (const url of font.urls.slice(1)) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = new Uint8Array(await res.arrayBuffer());
        if (sha256(buf) !== font.sha256) throw new Error("sha256 不符");
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, buf);
        ok = true;
        break;
      } catch (e) {
        console.warn(`  ${font.name}: ${url} 失败（${(e as Error).message}）`);
      }
    }
    if (!ok) throw new Error(`下载 ${font.name} 失败`);
    fetched++;
    console.log(`✓ ${font.mirrorKey}  ${(font.size / 1e6).toFixed(2)} MB`);
  }
  copyFileSync("src/tools/keyin/text/fonts/OFL.txt", join(OUT, "OFL.txt"));
  console.log(
    `\n${OUT}/ 就绪：${catalog.length - 1} 个字体，共 ${(total / 1e6).toFixed(0)} MB（本次新下载 ${fetched} 个）。`,
  );
  console.log(
    "上传到 Wasabi（需要已配置的 wasabi remote，见 docs/adding-a-map.md）：\n",
  );
  console.log(
    `rclone copy ${OUT} wasabi:portkey/tools/keyin/fonts \\\n` +
      `  --header-upload "Cache-Control: public, max-age=31536000, immutable" --transfers 8 --progress`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
