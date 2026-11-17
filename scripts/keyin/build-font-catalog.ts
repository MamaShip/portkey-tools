// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 生成 src/tools/keyin/text/catalog.json：刻印能用的字体，按回退顺序排列。
//
// 每个 Noto 字体都固定到上游的一个确切文件（仓库 + 提交 + 路径），记下 sha256、大小和
// 它覆盖的 Unicode 区间。运行时按字符查清单，只下载需要的字体，并逐个校验 sha256。
//
// 顺序（第一个收录某字符的字体胜出）：
//   1. Noto Sans               拉丁、希腊、西里尔（随站点发布）
//   2. Noto Sans <文字>         其余有无衬线设计的文字
//   3. Noto Sans CJK           中日韩，五个地区字面都在一个 TTC 里
//   4. 符号、数学、音乐
//   5. Noto Emoji              单色轮廓（彩色 emoji 是位图，做不成浮雕）
//   6. 其他 Noto 设计（衬线、纳斯赫体等），只收能补上新字符的，如藏文、西夏文
//
// 全部是 SIL OFL 1.1 字体，未经修改。
//
//   pnpm keyin:build-font-catalog       # 下载缓存在 .font-cache/（已在 .gitignore）
//
// 改了下面固定的提交号之后，重新生成清单，再按 docs/keyin.md 重新准备并上传字体。
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import * as hb from "harfbuzzjs";

const NOTO_REPO = "notofonts/notofonts.github.io";
const NOTO_COMMIT = "56d1bb314182fbfe45fb3a21ce9bb55a338e2994"; // 2026-11-17
const CJK_REPO = "notofonts/noto-cjk";
const CJK_COMMIT = "523d033d6cb47f4a80c58a35753646f5c3608a78"; // tag Sans2.004
const EMOJI_REPO = "google/fonts";
const EMOJI_COMMIT = "7af0d90b4d532ffa4b041937b560c6df4e7b1e95";

const WEIGHT = "Medium"; // 笔画粗一些更好打印；没有 Medium 时用 Regular

const TEXT_DIR = "src/tools/keyin/text";
const BUNDLED_DIR = join(TEXT_DIR, "fonts");
const CACHE = ".font-cache";

// 已有文字的样式变体，不是新文字
const SKIP_MARKERS = [
  "UI",
  "Mono",
  "Display",
  "Unjoined",
  "Looped",
  "Test",
  "Rotated",
  "Vertical",
];
const SKIP_FAMILIES = new Set([
  "NotoSansSyriacEastern",
  "NotoSansSyriacWestern",
]);
const LATE_SANS = ["NotoSansSymbols", "NotoSansSymbols2", "NotoSansMath"];

const rawUrl = (repo: string, commit: string, path: string) =>
  `https://raw.githubusercontent.com/${repo}/${commit}/${path}`;

/** 下载（带本地缓存）；上游没有这个文件时为 null */
async function fetchFile(repo: string, commit: string, path: string) {
  const local = join(CACHE, repo.replace("/", "_"), path.replace(/\//g, "_"));
  if (!existsSync(local)) {
    const res = await fetch(rawUrl(repo, commit, path));
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    mkdirSync(join(CACHE, repo.replace("/", "_")), { recursive: true });
    writeFileSync(`${local}.part`, new Uint8Array(await res.arrayBuffer()));
    renameSync(`${local}.part`, local);
  }
  return { local, data: new Uint8Array(readFileSync(local)) };
}

async function familyList(): Promise<string[]> {
  const res = await fetch(
    `https://api.github.com/repos/${NOTO_REPO}/contents/fonts?ref=${NOTO_COMMIT}`,
    { headers: { "user-agent": "portkey-tools-keyin" } },
  );
  if (!res.ok) throw new Error(`列出字体家族失败：HTTP ${res.status}`);
  const items = (await res.json()) as { name: string; type: string }[];
  return items
    .filter((x) => x.type === "dir")
    .map((x) => x.name)
    .sort();
}

function ranges(cps: Iterable<number>) {
  const out: [number, number][] = [];
  for (const cp of [...cps].sort((a, b) => a - b)) {
    const last = out.at(-1);
    if (last && cp === last[1] + 1) last[1] = cp;
    else out.push([cp, cp]);
  }
  return out;
}

/** 字形家族名：优先 name 表的 16（Typographic Family），否则 1 */
function familyName(face: hb.Face) {
  const names = face.listNames();
  for (const id of [16, 1]) {
    const entries = names.filter((n) => n.nameId === id);
    const pick = entries.find((n) => n.language.startsWith("en")) ?? entries[0];
    if (pick) return face.getName(id, pick.language);
  }
  return "";
}

function loadFace(data: Uint8Array, index = 0) {
  return new hb.Face(new hb.Blob(data), index);
}

/** TTC 文件头里的字面数（'ttcf' 之后：版本 4 字节，然后是 numFonts） */
function ttcFaceCount(data: Uint8Array) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return String.fromCharCode(...data.subarray(0, 4)) === "ttcf"
    ? view.getUint32(8)
    : 1;
}

const sha256 = (data: Uint8Array) =>
  createHash("sha256").update(data).digest("hex");

type Entry = Record<string, unknown>;

function entry(
  id: string,
  repo: string,
  commit: string,
  path: string,
  data: Uint8Array,
  cps: Set<number>,
  extra: Entry,
): Entry {
  return {
    id,
    repo,
    commit,
    path,
    size: data.length,
    sha256: sha256(data),
    ...extra,
    ranges: ranges(cps),
  };
}

async function main() {
  const families = (await familyList()).filter(
    (f) =>
      !SKIP_FAMILIES.has(f) &&
      !SKIP_MARKERS.some((m) => f.slice(4).includes(m)),
  );
  const sans = families.filter(
    (f) =>
      f.startsWith("NotoSans") && !LATE_SANS.includes(f) && f !== "NotoSans",
  );
  const others = families.filter((f) => !f.startsWith("NotoSans"));

  const catalog: Entry[] = [];
  const covered = new Set<number>();

  async function addNoto(family: string, onlyIfNew = false) {
    for (const weight of [WEIGHT, "Regular"]) {
      for (const hinting of ["unhinted", "hinted"]) {
        const path = `fonts/${family}/${hinting}/ttf/${family}-${weight}.ttf`;
        const got = await fetchFile(NOTO_REPO, NOTO_COMMIT, path);
        if (!got) continue;
        const face = loadFace(got.data);
        const cps = new Set(face.collectUnicodes());
        const fresh = [...cps].filter((c) => !covered.has(c)).length;
        if (onlyIfNew && !fresh) return null;
        for (const c of cps) covered.add(c);
        catalog.push(
          entry(family, NOTO_REPO, NOTO_COMMIT, path, got.data, cps, {
            name: familyName(face),
          }),
        );
        console.log(
          `  ${family.padEnd(34)} ${String(cps.size).padStart(6)} 字符，新增 ${String(fresh).padStart(6)}，${(got.data.length / 1e3).toFixed(0).padStart(6)} kB`,
        );
        return got.local;
      }
    }
    console.log(`  跳过 ${family}：没找到 ttf`);
    return null;
  }

  console.log("Noto Sans（随站点发布）");
  const local = await addNoto("NotoSans");
  if (!local) throw new Error("没找到 Noto Sans");
  const bundled = local.split("_").at(-1)!;
  catalog[catalog.length - 1].bundled = bundled;
  mkdirSync(BUNDLED_DIR, { recursive: true });
  copyFileSync(local, join(BUNDLED_DIR, bundled));

  console.log("各文字的无衬线字体");
  for (const f of sans) await addNoto(f);

  console.log("中日韩");
  const cjkPath = `Sans/OTC/NotoSansCJK-${WEIGHT}.ttc`;
  const cjk = await fetchFile(CJK_REPO, CJK_COMMIT, cjkPath);
  if (!cjk) throw new Error("没找到中日韩字体");
  const regionLang: Record<string, string> = {
    JP: "ja",
    KR: "ko",
    SC: "zh-Hans",
    TC: "zh-Hant",
    HK: "zh-HK",
  };
  const faces: Record<string, number> = {};
  const cjkCps = new Set<number>();
  for (let i = 0; i < ttcFaceCount(cjk.data); i++) {
    const face = loadFace(cjk.data, i);
    const family = familyName(face); // "Noto Sans CJK JP" 等
    const region = family.split(" ").at(-1)!;
    if (region in regionLang && !family.includes("Mono"))
      faces[regionLang[region]] ??= i;
    for (const c of face.collectUnicodes()) cjkCps.add(c);
  }
  for (const c of cjkCps) covered.add(c);
  catalog.push(
    entry("NotoSansCJK", CJK_REPO, CJK_COMMIT, cjkPath, cjk.data, cjkCps, {
      name: "Noto Sans CJK",
      faces,
    }),
  );
  console.log(
    `  NotoSansCJK ${cjkCps.size} 字符，字面 ${JSON.stringify(faces)}`,
  );

  console.log("符号");
  for (const f of [...LATE_SANS, "NotoMusic"]) await addNoto(f, true);

  console.log("emoji");
  const emojiPath = "ofl/notoemoji/NotoEmoji[wght].ttf";
  const emoji = await fetchFile(EMOJI_REPO, EMOJI_COMMIT, emojiPath);
  if (!emoji) throw new Error("没找到 Noto Emoji");
  const emojiCps = new Set(loadFace(emoji.data).collectUnicodes());
  for (const c of emojiCps) covered.add(c);
  catalog.push(
    entry(
      "NotoEmoji",
      EMOJI_REPO,
      EMOJI_COMMIT,
      emojiPath,
      emoji.data,
      emojiCps,
      {
        name: "Noto Emoji",
        variations: { wght: 500 },
      },
    ),
  );

  console.log("其他设计，只收能补上新字符的");
  for (const f of others) if (f !== "NotoMusic") await addNoto(f, true);

  const out = join(TEXT_DIR, "catalog.json");
  writeFileSync(out, JSON.stringify({ weight: WEIGHT, fonts: catalog }));
  const total = catalog.reduce((s, e) => s + (e.size as number), 0);
  console.log(
    `\n${catalog.length} 个字体，覆盖 ${covered.size} 个字符，全部下载共 ${(total / 1e6).toFixed(1)} MB → ${out}`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
