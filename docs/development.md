<!--
SPDX-License-Identifier: AGPL-3.0-or-later
Copyright (C) 2026 MamaShip
-->

# 开发指南（上手 + 架构）

> 让新开发者**从 0 跑起来、看懂架构、知道改哪里**。
> 分工：本文 = **怎么干活**；[`plan.md`](../plan.md) = **为什么这么选**（决策与备选）；[`CLAUDE.md`](../CLAUDE.md) = 状态速览 + 索引。
> 专题深入：底图 [`basemap.md`](./basemap.md)、对象存储约定 [`object-storage.md`](./object-storage.md)、新增一张图 [`adding-a-map.md`](./adding-a-map.md)。

---

## 1. 快速开始

```bash
# Node 22（Active LTS）+ pnpm（项目已锁 .nvmrc=22、packageManager=pnpm@10.21.0）
nvm install 22 && nvm use 22 && corepack enable

pnpm install
pnpm dev          # → http://localhost:4321/cd-old-map
```

只有**切片/上传新历史图**或**重烘焙底图**时才需要额外工具（`default-jre`、`rclone`）——日常前端开发不需要，详见 [`adding-a-map.md`](./adding-a-map.md) / [`basemap.md`](./basemap.md)。

仓库**不含**瓦片、源扫描图、底图快照（都在 Wasabi 对象存储）。`pnpm dev` 运行时浏览器直接从 Wasabi 拉底图与历史图瓦片，故本地无需任何大资产即可起站。

---

## 2. 架构与数据流（核心）

整个工具围绕一个中心状态：**当前时间站点 `currentEpochId`**。它既决定显示哪一层历史叠加、其透明度，未来也将驱动标注要素过滤（plan §5）。数据流是单向的：

```
src/data/epochs.ts   ┐  (登记表，纯数据)
src/data/maps.ts     ┘
        │  被 src/lib/timeline.ts 的纯函数消费
        ▼
  resolveOverlay(epochs, currentEpochId) → { kind, mapId | null }
  timelineStations(epochs) → 按 order 升序的站点（渲染时间轴横条）
  stepEpoch(epochs, id, ±1) → 键盘 ←/→ 的下一站
        │
        ▼
  src/components/MapViewer.tsx  (唯一的 React island，状态持有者)
        │  ① 初始化 MapLibre（自托管 positron 底图）
        │  ② 编排：currentEpochId/opacity/peeking → 各历史图层的存在性与透明度
        ▼
  @allmaps/maplibre WarpedMapLayer  (浏览器内实时扭合历史图)
        ▲  标注从这里来：
  src/lib/annotations.ts  ← import.meta.glob 自动装载 src/data/annotations/*.json
```

**几个关键设计点：**

- **登记表驱动、零硬编码**：`MapViewer` 不认识任何具体图，它遍历 `maps`/`epochs`。要加图就改数据，不改组件（见 §5.1）。
- **标注按约定自动装载**：[`src/lib/annotations.ts`](../src/lib/annotations.ts) 用 Vite 的 `import.meta.glob('../data/annotations/*.json', { eager: true })` 把所有标注收成 `Record<mapId, annotation>`，**键 = 文件名去扩展名 = `mapId`**。丢一个 `<mapId>.json` 进去就被纳入，无需手动 import。
- **图层懒建**：历史图层在**首次切到**对应 epoch 时才 `new WarpedMapLayer(...)` 并加载标注（未访问的图永不拉瓦片）。切回已建过的图是瞬时 A/B（把其余层 `setOpacity(0)`，不重拉）。
- **纯逻辑与副作用分离**：所有「该显示哪张图、时间轴顺序、键盘步进、透明度钳制」都在 [`src/lib/`](../src/lib/) 的纯函数里（不依赖 DOM/MapLibre），是单元测试主战场；`MapViewer` 只做副作用编排。
- **底图自托管**：交互底图是 OpenFreeMap positron 在成都包围盒的快照，托管在 Wasabi（公共实例被 GFW 阻断）。范围由 [`src/data/basemap/extent.ts`](../src/data/basemap/extent.ts) **单一来源**定义（`MapViewer` 与烘焙脚本共用，永不漂移），改写后的样式在 [`src/data/basemap/positron.json`](../src/data/basemap/positron.json)（入库可评审）。机制见 [`basemap.md`](./basemap.md)。

**交互模型**（在 `MapViewer` 的全局 keydown 里实现）：方向键二维控制 ——`←/→` 走时间轴、`↑/↓` 调透明度；**空格「速看」**按住临时把当前老图置 0（直接看底图）、抬起恢复。地图自带方向键平移已关闭（`keyboard: false`），平移用鼠标/触控、缩放用 `NavigationControl`。

---

## 3. 目录速查表（改哪里）

| 路径                                | 是什么 / 何时改它                                                                                                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/data/epochs.ts`                | 时间轴站点。加图时加一行；`default: true` 定首屏默认站点（至多一个）。                                                                                                                      |
| `src/data/maps.ts`                  | 历史图登记表（URL + provenance + 默认透明度）。加图时加一项。                                                                                                                               |
| `src/data/annotations/<mapId>.json` | 该图的 Allmaps 配准标注（控制点）。从 Allmaps Editor 导出，唯一入库的配准产物。                                                                                                             |
| `src/data/schema.ts`                | `Epoch`/`HistoricalMap` 的 zod schema + 类型。改字段先动这里。                                                                                                                              |
| `src/data/basemap/`                 | 自托管底图：`extent.ts`（范围单一来源）、`positron.json`（改写后样式）。                                                                                                                    |
| `src/lib/timeline.ts`               | 时间轴纯逻辑。改「该显示哪张图 / 键盘步进 / 站点顺序」的规则。                                                                                                                              |
| `src/lib/annotations.ts`            | 标注自动装载。一般不用动（约定即接口）。                                                                                                                                                    |
| `src/lib/opacity.ts`                | 透明度钳制（0–1）。                                                                                                                                                                         |
| `src/lib/deeplink.ts`               | URL hash 深链接的序列化/解析（纯函数，往返单测）。`epoch+经纬度+zoom+透明度` ↔ hash。                                                                                                       |
| `src/lib/device.ts`                 | 键盘提示能力探测（`(hover:hover) and (pointer:fine)`）：触摸端不显示键盘快捷键提示。                                                                                                        |
| `src/components/MapViewer.tsx`      | island 主体：地图初始化 + 图层编排 + 键盘控制 + 加载层。大改交互在这里。                                                                                                                    |
| `src/components/*.tsx`              | 子控件：`Timeline`/`OpacityControl`/`MapInfo`/`MapLoadingOverlay`/`InfoButton`/`SourcesModal`（状态由 `MapViewer` 持有）；`useMediaQuery.ts`（按视口切换内联样式的小 hook，移动端适配用）。 |
| `src/pages/*.astro`                 | 路由：`index`（工具索引）、`about`、`cd-old-map`（地图工具）。加工具=加路由。                                                                                                               |
| `src/layouts/BaseLayout.astro`      | 共享外壳。`fullBleed` 给地图页占满视口。                                                                                                                                                    |
| `scripts/validate-data.ts`          | `pnpm validate` 的实现（CI 数据闸门）。                                                                                                                                                     |
| `scripts/bake-basemap.ts`           | `pnpm bake:basemap` 的实现（烘焙底图快照）。                                                                                                                                                |
| `tests/`                            | Vitest：`georef.test.ts`（配准 sanity）、`timeline.test.ts`、`opacity.test.ts`、`deeplink.test.ts`（hash 往返）。                                                                           |
| `e2e/` + `playwright.config.ts`     | Playwright DOM 级冒烟（`pnpm test:e2e`）：canvas 挂载、深链接还原、移动视口控件可见。                                                                                                       |
| `astro.config.mjs`                  | 站点 URL、React 集成、`manualChunks`（按厂商分块）。                                                                                                                                        |
| `public/_redirects`                 | Cloudflare Pages 301 跳转（旧地图路由 → `/cd-old-map`）。                                                                                                                                   |
| `.github/workflows/ci.yml`          | CI 质量闸门（无 secrets，fork PR 也跑）。                                                                                                                                                   |

---

## 4. 质量闸门 ↔ 脚本

提交前本地全跑一遍（与 CI 同序）：

```bash
pnpm check && pnpm lint && pnpm format:check && pnpm validate && pnpm test
```

| 闸门           | 拦什么                                                                                                                                                                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `check`        | TS / Astro 类型错误（`astro check`）。                                                                                                                                                                                                                                                           |
| `lint`         | ESLint（flat config，含 react-hooks 规则）。                                                                                                                                                                                                                                                     |
| `format:check` | Prettier 风格。注意 `.prettierignore` 把 `README.md`/`plan.md`/`docs/archive/phase-0-1-guide.md` 列为手写文档不检查；其余 `*.md`（含本文件、`CLAUDE.md`、`docs/*`）会被检查——写完跑 `pnpm format` 写回。                                                                                         |
| `validate`     | 登记表/标注 **schema** + **引用完整性**（epoch 的 `mapId` 在 maps 存在、标注文件存在、至多一个 `default`）+ **断链**（标注 `items[0].target.source.id` == `iiifInfoUrl` 基址；拼幅图其余 items 都在同一 `/iiif/` 前缀下）+ **底图样式**（`positron.json` 已改写为指向 Wasabi、不残留被墙域名）。 |
| `test`         | 纯逻辑单测（含深链接 hash 往返）+ **配准 sanity**（见下）。                                                                                                                                                                                                                                      |
| `build`        | `astro build`，尽早暴露构建期错误。                                                                                                                                                                                                                                                              |
| `test:e2e`     | Playwright DOM 级冒烟（不在 `verify` 五道闸门内，单独跑；CI 有独立 e2e job）。首次本地跑前需 `pnpm exec playwright install chromium`。                                                                                                                                                           |

**「廉价代理测试」哲学**（plan §8）：配准「贴得准不准」无法单测——[`tests/georef.test.ts`](../tests/georef.test.ts) 退而断言每张图**控制点 ≥6、地理坐标落在成都经纬度框（lng 103.6–104.4 / lat 30.3–30.9）、像素坐标在源图尺寸内**，足以拦住「配错城市 / 严重偏移 / 断链」；**精细贴合靠预览 URL 肉眼看**。WebGL 像素在无头 CI 里易抖动，故不做像素 diff——e2e（[`e2e/smoke.spec.ts`](../e2e/smoke.spec.ts)）只做 DOM 级冒烟（canvas 挂载、无未捕获 JS 异常、深链接还原 epoch、移动视口控件可见），并主动过滤无头 SwiftShader 的着色器编译噪声。该测试**遍历 `maps`**，新增图自动获得覆盖、无需手写断言。

**CI**：[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) 在 push `master` 与所有 PR 上跑上述闸门。**重要**：fork 发来的 PR 拿不到仓库 Secrets，故无法触发需密钥的部署/预览，但**无密钥的闸门照常运行**——所以重要检查都设计成不依赖密钥。部署与 PR 预览 URL 由 Cloudflare Pages 原生 Git 集成负责（不在 CI 文件内）。

---

## 5. 常见任务

### 5.1 新增一张历史图（最常见）

完整 SOP 见 **[`adding-a-map.md`](./adding-a-map.md)**（预处理 → 切片 → 上传 Wasabi → 验证 public+CORS → Allmaps 配准 → 登记 → 校验预览）。开发侧只记住一句：

> **新增图 = 在 `maps.ts` 加一项 + 在 `epochs.ts` 加一站 + 放一个 `src/data/annotations/<mapId>.json`。三者齐备即自动上轴，渲染代码零改动。**

拼幅/多页图（分别扫描的多幅）走**方案 B（地理层合并）**：各幅独立切片配准，合并进同一标注的 `items[]`，渲染为一个图层、共享一个透明度滑块（实例 `chengdu-1915` 左右两幅）。细节见 `adding-a-map.md` 附二。

### 5.2 新增一个工具（网站长出新功能）

每个工具 = 一个新路由：

1. 新建 `src/pages/<tool>.astro`，复用 `BaseLayout`（重交互页用 `fullBleed`）。
2. 重逻辑做成一个 React island（参考 `cd-old-map.astro` 如何 `client:only="react"` 挂 `MapViewer`）。
3. 在 `src/pages/index.astro` 的 `tools` 数组里加一条目（首页工具索引）。

### 5.3 重烘焙自托管底图

仅当要扩大范围/缩放级别或刷新底图数据时。`pnpm bake:basemap` 下载并改写 `positron.json`，再按脚本打印的 `rclone` 命令上传到 Wasabi。**有 gzip/Content-Encoding 等关键坑**，务必照 [`basemap.md`](./basemap.md) 走。

---

## 6. 路线图与状态

| 阶段                           | 状态                                                                                                                                           |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0 脚手架 + 底图          | ✅ 完成                                                                                                                                        |
| Phase 1 端到端一张图           | ✅ 完成（1933 垂直切片，先啃最硬的未知）                                                                                                       |
| Phase 2 时间轴 + 全部图 + 合规 | ✅ **工程完成**（5 图 + 时间轴 + 来源弹窗 + 闸门）；增图为持续内容工作                                                                         |
| Phase 3 体验增强               | 🟡 **大部完成**：✅ URL hash 深链接、✅ 移动端适配、✅ e2e 冒烟闸门、✅ 键盘提示；island 懒加载已用静态 boot 遮罩覆盖；卷帘/swipe 对照**暂缓** |
| Phase 4 标注层                 | ⬜ 架构已按 plan §5 预留（`currentEpochId` 同时驱动栅格层与未来 GeoJSON 层）                                                                   |

Phase 3 的 URL hash 深链接**已落地**：把 `epoch + 经纬度 + zoom + 透明度`（可序列化设计）写进 hash，`replaceState` 不污染后退栈；纯逻辑在 [`src/lib/deeplink.ts`](../src/lib/deeplink.ts) + **往返单元测试** [`tests/deeplink.test.ts`](../tests/deeplink.test.ts)（plan §8），集成在 [`MapViewer.tsx`](../src/components/MapViewer.tsx)。E2E 冒烟见 [`e2e/`](../e2e/) + [`playwright.config.ts`](../playwright.config.ts)（`pnpm test:e2e`）。卷帘/swipe 对照暂缓——现有「空格速看」已提供轻量 A/B 对照。

---

## 7. 坑速查（工程向）

- **地图组件必须 `client:only="react"`**：MapLibre 依赖 `window`，不能 SSR。
- **CJK 字形不烘焙**：MapLibre `localIdeographFontFamily: "sans-serif"` 用浏览器本地字体渲染汉字，只烘焙拉丁字形（省体积）。
- **`styleimagemissing` 占位图**：positron 样式会引用其 sprite 里并不存在的 POI 图标，逐个刷 "Image could not be loaded" 告警；`MapViewer` 注册 1×1 透明占位图消噪（不影响渲染）。
- **首屏白屏的两段式加载层**：island 包较大，下载期 `cd-old-map.astro` 里有一个**静态启动遮罩**（零 JS、随首帧即现）；island 挂载后被移除，由 React 的 `MapLoadingOverlay` 分阶段接管（`init → historical → done`）。
- **平移锁在成都框内**：`maxBounds: CHENGDU_BOUNDS`——框外烘焙快照里没有瓦片，故限制可达范围（与 bake 脚本同源 extent）。
- **按厂商分块**：`astro.config.mjs` 的 `manualChunks` 把 maplibre/allmaps/react 拆成独立块，HTTP/2 下并行下载、跨部署命中缓存。
- **id 改名 = 断链**：`mapId` 一经发布即稳定；它同时是对象存储路径、`info.json` 的 `id`、标注键、登记表 id。改名要同步改这一串（一般别改）。
- 数据相关的坑（切片 `-identifier` 末尾斜杠、标注 `source.id` 对齐、Wasabi public/CORS、中文文件名）见 [`adding-a-map.md`](./adding-a-map.md) 的「常见坑速查」。
