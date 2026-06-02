# Phase 0–1 执行手册（runbook）

> 配套 `plan.md`。本文件是 Phase 0（脚手架 + 底图）与 Phase 1（《1933年成都街市图》端到端配准）的逐步清单。
> 环境假设：**Ubuntu**。命令以 Ubuntu 为准；Mac 把 `apt` 换 `brew` 即可。
> 凡标注「⚠️ 核对」处，请以对应工具的当前 README 为准——这些 API/URL 可能随版本微调。

---

## 0. 一次性环境准备（Ubuntu）

```bash
# Node 22（Active LTS；Node 20 已于 2026-04 EOL）+ pnpm
# 本机已装 node v22.x；若需用 nvm 管理：
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# 重开终端后：
nvm install 22 && nvm use 22
corepack enable && corepack prepare pnpm@latest --activate
# CI 也固定在 node 22（见 ci.yml），与本机对齐以减少环境漂移。

# 配准用工具
sudo apt update
sudo apt install -y default-jre        # 跑 iiif-tiler.jar
sudo apt install -y libvips-tools      # 备选切片器（vips）
sudo apt install -y rclone             # 上传到 Wasabi（S3 兼容）

# 校验
node -v && pnpm -v && java -version && vips --version && rclone version
```

---

## 1. Phase 0 — 脚手架与底图

> ✅ **Phase 0 已完成（2026-06）。** 站点已上线 `https://tools.portkey.click/tools/chengdu-historical-map`，可拖动成都现代地图。下文保留为操作记录；标注「实际落地」处是与初稿命令的差异。

### 1.1 初始化 Astro + TypeScript + React

> **实际落地**：未用交互式 `pnpm create astro`，而是直接手写项目文件（确定、可复现、无模板垃圾）。依赖随 registry 现状装到了更高大版本：**Astro 6、@astrojs/react 5、React 19、MapLibre GL 5、ESLint 10（flat config）、typescript-eslint 8、TypeScript 6、Vitest 4、Prettier 3**。另加了 `.nvmrc`（内容 `22`）锁定 Node 版本，本机 `nvm` 与 Cloudflare 构建都据此对齐到 Node 22。`pnpm` 经 `corepack enable` 提供 `10.21.0`（与 `packageManager` 字段一致）。

```bash
# 仓库已存在（含 LICENSE/README/plan 等），直接在仓库根脚手架，勿新建子目录：
pnpm create astro@latest .   # 在当前目录(.)；选 “Empty”，TypeScript: Strict；
                             # 提示目录非空时选择保留现有文件（不要清空）
pnpm astro add react                      # 加 React 集成
pnpm add maplibre-gl zod
pnpm add -D vitest @vitest/coverage-v8 eslint prettier tsx \
           @types/node typescript
# Playwright 等 Phase 3/可选 E2E 再装：pnpm add -D @playwright/test
```

把 `package.json` 的 `scripts` 设为（与 `ci.yml` 引用一致）；并加上 `packageManager` 字段——
CI 的 `pnpm/action-setup@v4` 未写死 `version` 时**正是靠这个字段确定 pnpm 版本**（缺失会报错），
本机 corepack 也据此锁版本，做到 CI 与本机一致：

```jsonc
{
  "packageManager": "pnpm@10.21.0",   // ⚠️ 与本机 pnpm -v 保持一致
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "validate": "tsx scripts/validate-data.ts",
    "test": "vitest run",
    "test:e2e": "playwright test"
  }
}
```

### 1.2 地图 island（OpenFreeMap 底图，定位成都）

> 📝 **后续变更（Phase 1 之后）**：现代底图已从「直连 `tiles.openfreemap.org/styles/liberty`」改为
> **自托管 OpenFreeMap positron 成都快照（Wasabi）**——因公共域名被 GFW 阻断、大陆黑屏。
> 下方代码为 Phase 0 初始落地记录；当前实现见 [`src/components/MapViewer.tsx`](./src/components/MapViewer.tsx) 与 **[`docs/basemap.md`](./docs/basemap.md)**。

MapLibre 依赖 `window`，组件必须**仅客户端渲染**。

`src/components/MapViewer.tsx`：
```tsx
import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// 成都天府广场附近，[lng, lat]
const CHENGDU: [number, number] = [104.0658, 30.6571];

export default function MapViewer() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: "https://tiles.openfreemap.org/styles/liberty", // ⚠️ 核对：openfreemap.org 当前样式名
      center: CHENGDU,
      zoom: 12.5,
    });
    map.addControl(new maplibregl.NavigationControl());
    return () => map.remove();
  }, []);
  return <div ref={ref} style={{ position: "absolute", inset: 0 }} />;
}
```

`src/pages/tools/chengdu-historical-map.astro`：
```astro
---
import MapViewer from "../../components/MapViewer.tsx";
---
<html lang="zh">
  <head><meta charset="utf-8" /><title>成都老地图</title></head>
  <body style="margin:0">
    <MapViewer client:only="react" />
  </body>
</html>
```

本地起：`pnpm dev` → 打开 `/tools/chengdu-historical-map`，应能看到一张可缩放/拖拽的成都现代地图。

### 1.3 接 Cloudflare Pages + 自定义域名 `tools.portkey.click`

1. 把仓库推到 GitHub。
2. Cloudflare 控制台 → **Workers & Pages** → **Create**。
   - ⚠️ **实际落地**：新版面板默认引导到 **Workers** 的 “Import a repository”（会出现 *Build command* + *Deploy command*、且**没有** Output directory / Production branch）。要走经典 Pages，须在创建页**切到 `Pages` 标签**再 **Connect to Git**，才会出现下列字段。
   - **Production branch**：`master`；**Build command**：`pnpm build`；**Build output directory**：`dist`；**无 Deploy command**。
   - **Build system version** 不在创建表单里——建好项目后在 **Settings → Build** 才能看到/切换（默认 v3，会读 `packageManager` 自动用 pnpm）。
   - 非生产分支推上去会自动产生**预览部署**；开 PR 后预览 URL 会贴在 PR 页。
   - ⚠️ **两个坑**：①**生产分支必须含 `package.json` 才能构建**——若先把脚手架放在功能分支、master 仍是空壳，生产构建会以 `ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND` 失败，**合并 PR 到 master 后即恢复**。②预览/分支地址是 `<hash>.<项目>.pages.dev` 这种**两级子域**，其 `*.<项目>.pages.dev` 证书在新项目刚建好时要等几分钟才签发，期间访问会报 `ERR_SSL_VERSION_OR_CIPHER_MISMATCH`——**稍候即可**；生产一级域 `<项目>.pages.dev` 用全局 `*.pages.dev` 证书，不用等。
3. 项目 → **Custom domains** → 添加 `tools.portkey.click`：
   - **若 `portkey.click` 的 DNS 已托管在 Cloudflare** → 添加自定义域时会自动建好 CNAME，等待生效即可。
   - **若 DNS 在别处（本项目即此情况）** → 到你的 DNS 服务商加一条 `CNAME tools → <项目>.pages.dev`（关掉服务商的代理/CDN，用纯解析），再回 Pages 添加该自定义域并验证。**Cloudflare 会自动签发并续期 TLS**（即使 DNS 不在它这）；状态由 `Verifying/Initializing certificate` → 几分钟后变 `Active`。
   - ⚠️ 若域名设过 **CAA 记录**，须允许 Cloudflare 的 CA（含 `letsencrypt.org`、`pki.goog`），否则签发会卡；没设 CAA 则无需理会。`dig +short CAA portkey.click` 自查。

### 1.4 建 Wasabi 桶（放历史图瓦片）

1. 在 Wasabi 控制台建一个桶（如 `tools-portkey-maps`）；记下其**区域 endpoint**（形如 `s3.<region>.wasabisys.com`）。
2. 将桶（或将要放瓦片的前缀）设为 **public**（付费账号支持）。
3. **CORS 无需配置**——带 `Origin` 的请求会自动收到 permissive CORS 头。
4. 配置 rclone remote（一次）：
   ```bash
   # ⚠️ 实际落地：官方 install.sh 在国内网络易卡，直接用 apt 装即可（够用）：
   #   sudo apt update && sudo apt install -y rclone
   rclone config   # 新建 remote（名如 wasabi）：类型选 s3 → provider 选 Wasabi → 填 Access/Secret key 与区域 endpoint
   ```
5. 公开对象 URL 形如（path-style）：`https://s3.<region>.wasabisys.com/tools-portkey-maps/<key>`（⚠️ 核对你区域的确切 endpoint）。

### Phase 0 完成标准（Definition of Done）—— ✅ 已达成（2026-06）

- [x] 访问 `https://tools.portkey.click/tools/chengdu-historical-map` 能拖动成都地图。
- [x] 推一个 PR 能看到 Cloudflare 预览 URL。
- [x] `check`/`lint`/`format:check`/`build` 均通过（本地 + CI 前三步绿）。
  - ⚠️ 注意：`ci.yml` 里 `validate`/`test` 排在 `build` 之前，且这两步留到 Phase 1 才实现，因此目前 GitHub Actions 整体会**红在 `validate`**（`build` 在 CI 上因前序失败而未执行，但本地已验证通过）。Phase 1 补齐数据校验与 sanity 测试后 CI 转全绿。Wasabi 桶（§1.4）为 Phase 1 准备项，不在 Phase 0 DoD 内。

---

## 2. Phase 1 — 《1933年成都街市图》端到端 ✅

> ✅ **Phase 1 已完成（2026-06）。** 《1933年成都街市图》已配准并上线 `tools.portkey.click`，
> 可用透明度滑块在 1933 与现今间淡入淡出；CI 数据/配准闸门齐备。新增图的标准流程已固化为
> **[`docs/adding-a-map.md`](./docs/adding-a-map.md)**（SOP，含确切命令与踩坑速查）。下文保留为操作记录。

> 目标：把这张图正确叠在现代成都上，并能用滑块在 1933 与现今之间淡入淡出。这一步先在**一张图**上跑通"切片 → 上传 → CORS → 配准 → 浏览器扭合"整条链路。

### 2.1 预处理扫描图
高分辨率扫描；裁掉黑边、纠斜（deskew）；导出为 `chengdu-1933.jpg`（或 TIFF）。

### 2.2 切静态 IIIF 瓦片
```bash
# 从 github.com/glenrobson/iiif-tiler releases 下载 iiif-tiler.jar 到当前目录
java -jar iiif-tiler.jar chengdu-1933.jpg -version 3 -output ./tiles
# 产出：./tiles/iiif/chengdu-1933/info.json + 各级瓦片
# 备选（libvips）：vips dzsave chengdu-1933.jpg chengdu-1933 --layout iiif3   # ⚠️ 核对 vips 的 iiif 布局参数
```

### 2.3 上传到 Wasabi（MIME 按扩展名自动判定）
```bash
rclone copy ./tiles/iiif/chengdu-1933 \
  wasabi:tools-portkey-maps/chengdu-1933 --progress
```
得到 info.json 的公开 URL：
`https://s3.<region>.wasabisys.com/tools-portkey-maps/chengdu-1933/info.json`

**验证 public + CORS**（在已部署站点的浏览器控制台跑）：
```js
fetch("https://s3.<region>.wasabisys.com/tools-portkey-maps/chengdu-1933/info.json")
  .then(r => r.json()).then(console.log)   // 应打印 info.json，无 CORS 报错
```

### 2.4 在 Allmaps Editor 配准
1. 打开 `editor.allmaps.org`，粘贴上面的 `info.json` URL。
2. 在历史图与现代底图上**成对打控制点**：选稳定可辨地物（城门遗址、河道交汇、主要十字路口、文庙/府河沿线等）。1933 图为民国测绘，整体可对齐，但**多打且分布均匀**（约 8–15 个），Allmaps 用三角剖分做局部扭合。
3. 导出 **Georeference Annotation**，保存为 `src/data/annotations/chengdu-1933.json`。

### 2.5 登记数据
`src/data/maps.ts`：
```ts
import type { HistoricalMap } from "./schema";
export const maps: HistoricalMap[] = [
  {
    id: "chengdu-1933",
    title: "1933年成都街市图",
    year: 1933,
    iiifInfoUrl: "https://s3.<region>.wasabisys.com/tools-portkey-maps/chengdu-1933/info.json",
    annotationPath: "src/data/annotations/chengdu-1933.json",
    defaultOpacity: 0.7,
    provenance: { source: "（填收藏机构/出处）", license: "Public Domain" },
    attribution: "1933年成都街市图（公共领域）",
  },
];
```
`src/data/epochs.ts`：
```ts
import type { Epoch } from "./schema";
export const epochs: Epoch[] = [
  { id: "present", label: "现今", order: 100, kind: "basemap" },
  { id: "1933", label: "1933", order: 50, kind: "historical", mapId: "chengdu-1933" },
];
```

### 2.6 渲染叠加层 + 透明度滑块
```bash
pnpm add @allmaps/maplibre @allmaps/annotation
```
在 `MapViewer.tsx` 的 `map.on("load", ...)` 里（⚠️ 核对 `@allmaps/maplibre` 当前 API 名）：
```ts
import { WarpedMapLayer } from "@allmaps/maplibre";
import annotation from "../data/annotations/chengdu-1933.json";

map.on("load", async () => {
  const warped = new WarpedMapLayer("warped-1933");
  map.addLayer(warped);
  await warped.addGeoreferenceAnnotation(annotation);
  warped.setOpacity(0.7);            // 滑块改这个值（0–1）
});
```
加一个 `OpacityControl`（受控滑块）调用 `warped.setOpacity(v)`。

### Phase 1 完成标准（Definition of Done）—— ✅ 已达成（2026-06）

- [x] `tools.portkey.click` 上，1933 图叠在现代成都的正确位置，主要街道/城门大致对应。
- [x] 滑块能在 1933 与现今之间平滑淡入淡出。
- [x] CI：`validate`（schema + 引用完整性）通过；配准 sanity 测试通过；透明度状态单测通过。

---

## 3. 数据校验骨架（`ci.yml` 的 `validate` 步）

`src/data/schema.ts`：
```ts
import { z } from "zod";

export const EpochSchema = z.object({
  id: z.string(),
  label: z.string(),
  order: z.number(),
  kind: z.enum(["basemap", "historical"]),
  mapId: z.string().optional(),
});
export type Epoch = z.infer<typeof EpochSchema>;

export const HistoricalMapSchema = z.object({
  id: z.string(),
  title: z.string(),
  year: z.number().int(),
  iiifInfoUrl: z.string().url(),
  annotationPath: z.string(),
  defaultOpacity: z.number().min(0).max(1),
  minZoom: z.number().optional(),
  maxZoom: z.number().optional(),
  provenance: z.object({
    source: z.string(),
    author: z.string().optional(),
    license: z.string(),
    notes: z.string().optional(),
  }),
  attribution: z.string(),
});
export type HistoricalMap = z.infer<typeof HistoricalMapSchema>;
```

`scripts/validate-data.ts`：
```ts
import { existsSync } from "node:fs";
import { z } from "zod";
import { EpochSchema, HistoricalMapSchema } from "../src/data/schema";
import { epochs } from "../src/data/epochs";
import { maps } from "../src/data/maps";

let ok = true;
const fail = (m: string) => { console.error("✗", m); ok = false; };

z.array(EpochSchema).parse(epochs);
z.array(HistoricalMapSchema).parse(maps);

const mapIds = new Set(maps.map(m => m.id));

// 引用完整性：historical epoch 必须指向存在的 map；map 的标注文件必须存在
for (const e of epochs) {
  if (e.kind === "historical") {
    if (!e.mapId) fail(`epoch ${e.id} 缺 mapId`);
    else if (!mapIds.has(e.mapId)) fail(`epoch ${e.id} 引用了不存在的 mapId: ${e.mapId}`);
  }
}
for (const m of maps) {
  if (!existsSync(m.annotationPath)) fail(`map ${m.id} 的标注文件缺失: ${m.annotationPath}`);
}

if (!ok) process.exit(1);
console.log("✓ 数据校验通过");
```

---

## 4. 配准 sanity 测试骨架（`ci.yml` 的 `test` 步）

目标：拦住"配错城市 / 严重偏移"——断言标注算出的地理范围落在成都框内。精细贴合靠预览 URL 肉眼看。

`tests/georef.test.ts`：
```ts
import { describe, it, expect } from "vitest";
import { parseAnnotation } from "@allmaps/annotation"; // ⚠️ 核对：导出名/解析结果属性路径
import annotation from "../src/data/annotations/chengdu-1933.json";

// 成都大致范围（宽松，仅用于"是否在成都"判断；可按需收紧）
const LNG = [103.6, 104.4] as const;
const LAT = [30.3, 30.9] as const;

describe("1933 图配准 sanity", () => {
  it("控制点的地理坐标落在成都范围内", () => {
    const maps = parseAnnotation(annotation as any);
    const gcps = (maps[0] as any).gcps as Array<{ geo: [number, number] }>;
    expect(gcps.length).toBeGreaterThanOrEqual(6);   // 控制点足够多
    for (const { geo: [lng, lat] } of gcps) {
      expect(lng).toBeGreaterThanOrEqual(LNG[0]);
      expect(lng).toBeLessThanOrEqual(LNG[1]);
      expect(lat).toBeGreaterThanOrEqual(LAT[0]);
      expect(lat).toBeLessThanOrEqual(LAT[1]);
    }
  });
});
```

> 若 `@allmaps/annotation` 的解析结果属性名与上面不同，按其类型定义调整 `gcps`/`geo` 的取法即可；核心断言（地理坐标在成都框内、点数达标）不变。纯逻辑（epoch 选择、透明度状态、Phase 3 的 URL hash 往返）另写单测放 `tests/`。

---

## 5. 小结：为什么这两步先做

Phase 0 给出一个**可访问、可在 CI 验证**的地基（域名 + 底图 + 绿灯流水线）。Phase 1 故意把最陌生的链路（切片/上传/CORS/配准/浏览器扭合）压缩到**一张图**上跑通——所有坑在这里先暴露，再去做其余 4–7 张和时间轴 UI（Phase 2）。每一步都有"看得见的产出 + 能自动跑的闸门"。
