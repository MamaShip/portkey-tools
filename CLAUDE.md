<!--
SPDX-License-Identifier: AGPL-3.0-or-later
Copyright (C) 2026 MamaShip
-->

# CLAUDE.md — 项目状态速览

> 给 Claude / 新开发者**30 秒掌握项目**的索引页。只放**状态快照 + 去处指针**，正文细节在下方链接的专题文档里，避免重复（重复会过时）。
>
> 想真正上手开发 → **[`docs/development.md`](./docs/development.md)**；想理解「为什么这么选」→ **[`plan.md`](./plan.md)**。

## 这是什么

一个**个人工具集**网站（Astro 多页站，随时间不断长出新工具，每个工具 = 一个路由）。目前有两个工具：

- **成都老地图**（`/cd-old-map`）：现代底图上叠加经地理配准的成都历史老地图，时间轴切换时间点、透明度滑块古今淡入淡出。
- **刻印**（`/keyin`）：把一年的每日使用记录（GitHub、Claude Code、ChatGPT、JSON/CSV）做成可 3D 打印的 STL，全部在浏览器里生成。详见 [`docs/keyin.md`](./docs/keyin.md)。

- 线上：**https://tools.portkey.click/cd-old-map**、**https://tools.portkey.click/keyin**
- 仓库托管：Cloudflare Pages（原生 Git 集成，每个 PR 自动出预览 URL）。

## 当前状态（2026-06）

- **Phase 0–2 工程完成、Phase 3 大部完成、已上线、全部质量闸门绿灯。**
- 已配准 **7 张**历史图：`chengdu-1903`（清末手绘四川省城街道图）/ `chengdu-1911` / `chengdu-1915`（左右拼幅）/ `chengdu-1933`（首屏默认）/ `chengdu-1944` / `chengdu-1947` / `chengdu-1989`（首张 1949 后地图，美国 CIA 制、PCL 收藏）。
- `MapViewer` 已**泛化**为「遍历 `epochs`/`maps` 登记表 + 时间轴驱动」：**新增一张图无需改渲染代码**（流程见 [`docs/adding-a-map.md`](./docs/adding-a-map.md)）。
- **Phase 3 体验增强**已落地：URL hash 深链接（`src/tools/cd-old-map/lib/deeplink.ts`，可分享视图）、移动端适配、Playwright e2e 冒烟闸门（`e2e/`）、键盘提示增强、当前定位（`GeolocateControl`，点击才授权、蓝点持续跟踪）；island 懒加载以静态 boot 遮罩覆盖；**卷帘/swipe 对照暂缓**。Phase 4 = 标注层（架构已按 plan §5 预留）。
- **开放的内容工作**：向 plan §1 的 5–8 张目标增图（尤其缺 1950s–1975 时段），只待源扫描图——架构已支持「丢一张图自动上轴」。

## 技术栈（一行）

Astro 6 + TypeScript + React 19（仅客户端 island）+ MapLibre GL 5 + Allmaps（`@allmaps/maplibre` 实时扭合 / `@allmaps/annotation`）+ IIIF 瓦片 + 自托管 OpenFreeMap positron 底图（Wasabi）+ Cloudflare Pages。全程 **WGS-84**。

## 常用命令

| 命令                | 作用                                                                          |
| ------------------- | ----------------------------------------------------------------------------- |
| `pnpm dev`          | 本地开发 → http://localhost:4321/cd-old-map                                   |
| `pnpm build`        | 生产构建（输出 `dist/`）                                                      |
| `pnpm check`        | 类型检查（`astro check`）                                                     |
| `pnpm lint`         | ESLint                                                                        |
| `pnpm format:check` | Prettier 检查（`pnpm format` 写回）                                           |
| `pnpm validate`     | 数据闸门：登记表/标注 schema + 引用完整性 + 断链 + 底图样式                   |
| `pnpm test`         | Vitest 单元测试（含深链接 hash 往返 + 配准 sanity）                           |
| `pnpm test:e2e`     | Playwright DOM 级冒烟（不在五道闸门内；首次先 `playwright install chromium`） |
| `pnpm bake:basemap` | 重新烘焙自托管底图快照（见 [`docs/basemap.md`](./docs/basemap.md)）           |

**每次改完（含改文档）都必须把五道闸门跑全绿**。上库前一条命令搞定：

- **`pnpm fix`** — 先 `prettier --write .` 自动格式化整仓，再跑全部闸门。**日常用这条最省心**（格式问题自动修好）。
- **`pnpm verify`** — 只读不改，原样跑全部五道闸门（`check + lint + format:check + validate + test`），**与 CI `.github/workflows/ci.yml` 完全一致**。上库前最后确认用它。

> ⚠️ **铁律**：
>
> - 用上面的聚合命令跑**整仓**，**不要只挑自己改的文件跑**——CI 跑的是整仓（连 `.md` 文档都过 prettier），挑文件跑会漏报。
> - **只要任一闸门非全绿（哪怕报错文件不是你这次改的），就不算通过**，必须当场修到全绿（如 `pnpm format` 写回格式），不得以"与本次改动无关"为由跳过或淡化。
> - 报告结果时如实陈述：哪条命令、退出码、是否全绿；不得把失败说成通过。

## 仓库地图（去哪找东西）

**按工具隔离**：每个工具的代码、数据、测试、脚本各自放在以工具 id 命名的目录里，工具之间**互不 import**。规则见下「铁律」的「工具隔离」一条。

```
src/pages/<toolId>.astro      路由（薄壳：只挂 BaseLayout + 工具的 island）
src/site/                     站点外壳：BaseLayout、SiteHeader、SiteFooter
src/shared/                   多个工具都能用的通用代码（如 useMediaQuery）
src/tools/<toolId>/           某个工具的全部实现（components/ lib/ data/ ...）
tests/<toolId>/               该工具的单测；tests/site/ 放全站级测试（含隔离检查）
scripts/<toolId>/             该工具的脚本
e2e/<toolId>/                 该工具的 Playwright 冒烟
```

**成都老地图（`cd-old-map`）**

- `src/tools/cd-old-map/data/` — **改这里来加/改数据**：`epochs.ts`（时间轴站点）、`maps.ts`（历史图登记表 + provenance）、`schema.ts`（zod）、`annotations/<mapId>.json`（Allmaps 配准标注，唯一入库的配准产物）、`basemap/`（自托管底图 extent + 改写后样式）。
- `src/tools/cd-old-map/lib/` — **纯逻辑，单元测试主战场**：`timeline.ts`（epoch 选择/排序/步进）、`annotations.ts`（`import.meta.glob` 自动装载标注）、`opacity.ts`、`deeplink.ts`（URL hash 序列化/解析，往返单测）、`device.ts`（键盘提示能力探测）。
- `src/tools/cd-old-map/components/` — 地图工具的 React island（`MapViewer.tsx` 是主体，其余是子控件）。
- `scripts/cd-old-map/` — `validate-data.ts`（CI 数据闸门）、`bake-basemap.ts`（烘焙底图）。
- `tests/cd-old-map/` — `georef.test.ts`（配准 sanity，遍历全部图）、`timeline.test.ts`、`opacity.test.ts`、`deeplink.test.ts`。

**刻印（`keyin`）**（详见 [`docs/keyin.md`](./docs/keyin.md)）

- `src/tools/keyin/model/`、`text/`、`sources/` — 从 keyin（Python，MIT）移植的网格、文字排版、数据源解析（纯函数，单测主战场），保留 MIT 声明。
- `src/tools/keyin/platforms/` — **每个平台一个文件**：说明（怎么拿数据、统计什么、隐私）+ 输入表单；`index.ts` 是登记表。加平台见 [`docs/keyin.md`](./docs/keyin.md)。
- `src/tools/keyin/components/` — React island（`KeyinTool.tsx` 是主体）；`worker.ts` 在 Web Worker 里生成模型。
- `functions/api/keyin/` — Pages Function，转发 GitHub、LeetCode 的公开日历（站点仅有的服务端代码）。
- `scripts/keyin/stage-fonts.ts` — 下载并校验字体，准备上传 Wasabi。

**其他**

- `docs/` — 专题深度文档（见下「文档索引」）。

## 铁律 / 护栏（容易踩的红线）

- **工具隔离**：`src/tools/<A>/` 里的代码只能 import 本工具目录、`src/shared/` 和 npm 包，**不得 import 另一个工具**，也不得 import `src/site/`、`src/pages/`。两个工具都要用的代码，先挪进 `src/shared/` 再用。`tests/site/isolation.test.ts` 会检查这一条。

- **坐标系只用 WGS-84**：底图只用 OSM 系开放数据，**坚决不混入高德/百度**（GCJ-02/BD-09 有偏移，见 plan §4.1）。
- **瓦片与源扫描图永不进 Git**：它们体量大、存于 Wasabi 对象存储；仓库里只留 URL 与几 KB 的标注 JSON。`tiles/`、`basemap-dist/`、`*.jpg` 已在 `.gitignore`。
- **id 用 ASCII kebab-case**（`chengdu-1933`），且**发布后勿改名**（改名会断链）。对象存储目录约定见 [`docs/object-storage.md`](./docs/object-storage.md)。
- **新增图 = 三处登记 + 一个标注文件**：`maps.ts`、`epochs.ts`、`src/tools/cd-old-map/data/annotations/<mapId>.json`，齐备即自动上轴，**不碰渲染代码**。
- **新源文件加 SPDX 头**：`// SPDX-License-Identifier: AGPL-3.0-or-later`（代码 AGPL；配准标注数据 CC0）。
- MapLibre 依赖 `window`，地图组件**仅客户端渲染**（`client:only="react"`）。

## 怎么扩展

- **加一张历史图** → 照 [`docs/adding-a-map.md`](./docs/adding-a-map.md)（预处理 → 切片 → 上传 → 验证 → 配准 → 登记 → 校验预览）。拼幅/多页图见其附二（方案 B）。
- **加一个新工具** → 实现放进 `src/tools/<toolId>/`，测试放 `tests/<toolId>/`，脚本放 `scripts/<toolId>/`；新建 `src/pages/<toolId>.astro` 路由，复用 `src/site/BaseLayout.astro`，重交互逻辑做成一个 React island（参考 `cd-old-map.astro` + `MapViewer`）；最后在 `src/pages/index.astro` 的工具列表里加一张卡片。对象存储资产放 `tools/<toolId>/`（见 [`docs/object-storage.md`](./docs/object-storage.md)）。

## 文档索引

| 文档                                                                   | 用途                                             |
| ---------------------------------------------------------------------- | ------------------------------------------------ |
| [`docs/development.md`](./docs/development.md)                         | **开发上手 + 架构数据流 + 常见任务**（先读这个） |
| [`plan.md`](./plan.md)                                                 | 设计与选型决策、备选方案、路线图（为什么）       |
| [`docs/adding-a-map.md`](./docs/adding-a-map.md)                       | 新增一张历史图的完整 SOP                         |
| [`docs/basemap.md`](./docs/basemap.md)                                 | 自托管底图的机制与（重）烘焙指南                 |
| [`docs/object-storage.md`](./docs/object-storage.md)                   | Wasabi 桶内对象 key 目录约定                     |
| [`docs/keyin.md`](./docs/keyin.md)                                     | 刻印：数据流、字体、GitHub 转发、许可            |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md)                                 | 贡献流程、许可、闸门                             |
| [`docs/archive/phase-0-1-guide.md`](./docs/archive/phase-0-1-guide.md) | Phase 0–1 历史竣工记录（已部分被取代）           |
