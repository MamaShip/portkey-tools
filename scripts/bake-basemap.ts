// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 底图烘焙脚本：把 OpenFreeMap positron 在「成都包围盒 + z10–14」范围内的矢量瓦片、
// sprite、拉丁字形快照下来，落到本地 basemap-dist/（gitignore），再用 rclone 上传到
// Wasabi 自托管（见 docs/object-storage.md）。这样运行时浏览器直连 Wasabi 取底图，
// 不再依赖被 GFW 阻断的 tiles.openfreemap.org。
//
// 用法：  pnpm bake:basemap        （仅下载 + 改写 style，不需要任何密钥）
// 下载完按脚本末尾打印的 rclone 命令上传；上传需 Wasabi 凭据（rclone remote: wasabi）。
//
// 重要：瓦片/字形是 gzip 压缩的 protobuf，上传时必须带 Content-Encoding: gzip，否则
// 浏览器拿到的是压缩字节、MapLibre 解不开。rclone 命令已带 --header-upload 设好。

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { gzipSync } from "node:zlib";
import {
  CHENGDU_BOUNDS,
  MIN_ZOOM,
  SOURCE_MAXZOOM,
} from "../src/data/basemap/extent";

const UPSTREAM = "https://tiles.openfreemap.org";
const STYLE_URL = `${UPSTREAM}/styles/positron`;
const OUT = "basemap-dist/openfreemap-positron";
const WASABI_KEY = "portkey/basemaps/openfreemap-positron";
const WASABI_BASE = `https://s3.ap-southeast-1.wasabisys.com/${WASABI_KEY}`;
// 拉丁 / 符号 / 数字字形；CJK 由 MapLibre localIdeographFontFamily 本地渲染，无需烘焙。
const GLYPH_RANGES = ["0-255", "256-511"];
const CONCURRENCY = 16;

interface StyleJson {
  layers: Array<{ layout?: { "text-font"?: string[] } }>;
  sprite: string;
  sources: { openmaptiles: { url: string } };
  [key: string]: unknown;
}
interface TileJson {
  tiles: string[];
  minzoom?: number;
  maxzoom?: number;
  attribution?: string;
  bounds?: number[];
}

const lon2x = (lon: number, z: number) =>
  Math.floor(((lon + 180) / 360) * 2 ** z);
const lat2y = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z,
  );
};

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`GET ${url} → ${r.status}`);
  return (await r.json()) as T;
}
async function getBytes(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`GET ${url} → ${r.status}`);
  return Buffer.from(await r.arrayBuffer()); // fetch 已自动解压，得到原始 protobuf
}
async function write(path: string, buf: Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buf);
}

/** 简单并发池：限流跑完所有任务。 */
async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  let done = 0;
  const total = items.length;
  const worker = async () => {
    while (i < total) {
      const item = items[i++];
      await fn(item);
      if (++done % 100 === 0 || done === total)
        process.stdout.write(`\r  ${done}/${total}`);
    }
  };
  await Promise.all(Array.from({ length: n }, worker));
  process.stdout.write("\n");
}

/** 由上游 style + planet TileJSON 生成自托管改写后的 style（指向 Wasabi）。 */
function buildStyle(
  style: StyleJson,
  planet: TileJson,
): Record<string, unknown> {
  return {
    ...style,
    glyphs: `${WASABI_BASE}/fonts/{fontstack}/{range}.pbf`,
    sprite: `${WASABI_BASE}/sprites/ofm`,
    // 仅保留实际用到的矢量源；ne2_shaded 仅覆盖 z0–6、无图层引用，丢弃。
    sources: {
      openmaptiles: {
        type: "vector",
        minzoom: planet.minzoom ?? 0,
        maxzoom: planet.maxzoom ?? SOURCE_MAXZOOM,
        tiles: [`${WASABI_BASE}/tiles/{z}/{x}/{y}.pbf`],
        attribution: planet.attribution,
        bounds: planet.bounds,
      },
    },
  };
}

async function main() {
  const [[west, south], [east, north]] = CHENGDU_BOUNDS;
  console.log(
    `烘焙范围 bbox=[${west},${south},${east},${north}] z${MIN_ZOOM}–${SOURCE_MAXZOOM}`,
  );

  const style = await getJson<StyleJson>(STYLE_URL);
  const planet = await getJson<TileJson>(style.sources.openmaptiles.url);
  const tpl = planet.tiles[0]; // 形如 .../planet/<版本>/{z}/{x}/{y}.pbf
  console.log(`矢量源版本模板: ${tpl}`);

  // 1) 枚举 bbox 内 z10–14 的全部瓦片坐标
  const coords: Array<{ z: number; x: number; y: number }> = [];
  for (let z = MIN_ZOOM; z <= SOURCE_MAXZOOM; z++) {
    for (let x = lon2x(west, z); x <= lon2x(east, z); x++)
      for (let y = lat2y(north, z); y <= lat2y(south, z); y++)
        coords.push({ z, x, y });
  }
  console.log(`矢量瓦片 ${coords.length} 张，下载中…`);
  await pool(coords, CONCURRENCY, async ({ z, x, y }) => {
    const url = tpl
      .replace("{z}", String(z))
      .replace("{x}", String(x))
      .replace("{y}", String(y));
    const bytes = await getBytes(url);
    if (bytes.length > 0)
      await write(`${OUT}/tiles/${z}/${x}/${y}.pbf`, gzipSync(bytes));
  });

  // 2) 字形（仅拉丁 range；CJK 本地渲染）
  const stacks = new Set<string>();
  for (const l of style.layers)
    for (const f of l.layout?.["text-font"] ?? []) stacks.add(f);
  console.log(`字形 fontstack: ${[...stacks].join(", ")}`);
  const glyphJobs = [...stacks].flatMap((s) =>
    GLYPH_RANGES.map((range) => ({ s, range })),
  );
  await pool(glyphJobs, 8, async ({ s, range }) => {
    const url = `${UPSTREAM}/fonts/${encodeURIComponent(s)}/${range}.pbf`;
    await write(
      `${OUT}/fonts/${s}/${range}.pbf`,
      gzipSync(await getBytes(url)),
    );
  });

  // 3) sprite（4 个文件，不 gzip）
  console.log("sprite…");
  for (const suffix of [".json", ".png", "@2x.json", "@2x.png"]) {
    await write(
      `${OUT}/sprites/ofm${suffix}`,
      await getBytes(style.sprite + suffix),
    );
  }

  // 4) 改写 style → 仓库（可评审、运行时由 MapViewer import）
  await writeFile(
    "src/data/basemap/positron.json",
    JSON.stringify(buildStyle(style, planet), null, 2) + "\n",
  );
  console.log("已更新 src/data/basemap/positron.json（请随后跑 pnpm format）");

  // 5) 打印上传命令
  console.log(
    `\n下载完成。用以下 rclone 命令上传到 Wasabi（需配置 remote: wasabi）：\n`,
  );
  // 缓存 3 个月（不用 immutable）：URL 不带哈希、底图偶尔重烘焙覆盖同名对象，
  // 故需给回访用户一个最长 3 个月的更新窗口（全新访客立即拿到新图）。
  const cc = `--header-upload "Cache-Control: public, max-age=7776000"`;
  const pbf = `--header-upload "Content-Type: application/x-protobuf" --header-upload "Content-Encoding: gzip"`;
  console.log(
    `rclone copy ${OUT}/tiles   wasabi:${WASABI_KEY}/tiles   ${pbf} ${cc} --transfers 32 --progress`,
  );
  console.log(
    `rclone copy ${OUT}/fonts   wasabi:${WASABI_KEY}/fonts   ${pbf} ${cc} --transfers 16 --progress`,
  );
  console.log(
    `rclone copy ${OUT}/sprites wasabi:${WASABI_KEY}/sprites ${cc} --transfers 8 --progress`,
  );
  console.log(`\n确保 Wasabi 上 ${WASABI_KEY}/ 前缀为 public。`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
