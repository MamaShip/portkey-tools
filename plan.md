# plan.md — 个人网站 & 成都老地图

> 本文件用于指导后续开发（包括与 AI 协作编程时作为上下文）。所有选型均给出**理由**与**备选方案**，便于将来回看与调整。
> 编写日期：2026-06；技术现状以此时为准（库版本、服务条款会变，落地前请快速复核）。

---

## 1. 项目概述

建立一个**个人网站**，作为可持续累加的"个人兴趣工具集"——每个工具是一个独立页面/路由，网站随时间不断长出新工具。

**第一个工具：成都老地图。**
- 以现代地图界面呈现成都当前街道，支持缩放、拖拽等基础操作。
- 叠加若干张成都历史老地图（宣统年间 ~ 1975 年，5–8 张，已剔除写意性素材，均为制图相对标准的图）。
- 用户在时间轴上切换历史时间点，观察街道/城市形态的演变；现代图与历史图之间可淡入淡出对照。

**附带目标：借此项目学习一套现代的地理可视化 / 前端技术栈**（开发者无 GIS 经验、无特定前端框架经验，全程 AI 辅助编程，学习意愿强）。因此本方案在"能落地"的前提下，**优先选择现代、主流、文档充分、生态成熟的技术**，而非最省事的老方案。

**可行性结论：成立。** "现代底图 + 配准后的历史地图叠加 + 时间轴" 属于成熟的"古今对照地图"品类（参考 Allmaps、Atlascope、各大图书馆的 georeferencing 项目），核心机制无需自创。真正的工程重点在**历史地图的地理配准**，而这一步已有成熟工具，且只需在开发阶段离线做一次。

---

## 2. 核心设计原则

1. **v1 无应用后端**：纯静态站点。底图、历史图瓦片、配准标注全部是静态资源 / 对象存储；没有需要自己运维的服务器代码（连自托管底图也可放 Wasabi 直读，无需 Worker）。
2. **全程 WGS-84 坐标系**：只用 OSM 系开源数据，**坚决不混入高德/百度瓦片**（见 §4.1 坐标系陷阱）。
3. **免费 / 开源优先**：在个人站流量下，目标运行成本 ≈ ¥0/月。
4. **为"图上标注要素"功能预留架构**：即使 v1 不做标注，数据模型与状态管理从一开始就以"时间"为一等公民，使标注层将来可无缝接入（见 §5）。
5. **无锁定**：配准结果是开放标准（控制点 + 开放标注格式），任何环节都有等价替代路径，不被单一生态绑死（见 §11）。

---

## 3. 技术选型总览

| 层 | 选择（v1 主方案） | 理由 | 备选 / 升级路径 |
|---|---|---|---|
| 地图渲染库 | **MapLibre GL JS**（稳定版 5.x，v6 预发布中） | OSS、WebGL 矢量渲染、连续缩放体验好、矢量/栅格皆可、生态最活跃；与 Allmaps 插件、PMTiles 原生协议契合 | OpenLayers（GIS 能力更强但更重）、Leaflet（最简单但偏栅格、偏老） |
| 现代底图 | **自托管 OpenFreeMap positron 快照（Wasabi）** | 公共实例 `tiles.openfreemap.org` 被 GFW 阻断、大陆黑屏 → 改为构建期把成都范围瓦片/字形/sprite 快照到 Wasabi 自托管，大陆免翻墙可用；WGS-84 原生、配准零改动（见 §4.2 / `docs/basemap.md`） | 直连 OpenFreeMap 公共实例（境外/可翻墙最省事）；自托管 **Protomaps PMTiles**；MapTiler 免费档（需 key） |
| 历史地图叠加 | **Allmaps + IIIF**（浏览器内实时扭合） | 配准产物仅是一份微型 JSON 标注，可随时重配而无需重新切片；纯静态；无需安装 QGIS；正是为历史地图配准而生 | **QGIS/GDAL 预扭合 → 栅格瓦片**（见 §4.3 Plan B，烘焙成永久瓦片或需要脱离 Allmaps 时） |
| 历史图瓦片格式 | **静态 IIIF 瓦片**（由 `allmaps/iiif-tiler` 生成） | Allmaps 浏览器端按需读取 IIIF，配合实时扭合；纯静态文件 | 单文件 **PMTiles**（栅格）；预切好的 XYZ 瓦片金字塔 |
| 站点框架 | **Astro + TypeScript**（islands 架构） | 静态优先、默认零 JS；可把"重"的地图组件作为单个 island 挂在某一路由，其余页面保持极轻；多页"工具索引"契合"不断长工具"的愿景；现代、AI 友好 | SvelteKit、Next.js；或纯 Vite + 原生 TS |
| 地图工具的交互组件 | **React island（TypeScript）** | 例子/资料密度最高，最利于 AI 辅助；类型安全利于学习 | Svelte（更轻、模板更少，与 Astro 配合好） |
| 工具内状态管理 | island 内 **React state + zustand**（轻量 store） | 全工具就一个 island，状态自包含；Astro 外壳保持纯静态 | nanostores（跨 island 共享时） |
| 托管（应用） | **Cloudflare Pages** | 带宽无限免费；原生 Git 集成自动给每个 PR 生成预览 URL | Netlify / Vercel |
| 对象存储（重资产） | **Wasabi**（已有账号，边际零成本） | S3 兼容、CORS 自动生效、API 请求免费；放 IIIF 瓦片无文件数瓶颈、不进 git | Cloudflare R2（真正无限出口、挂边缘 CDN）；Backblaze B2 |
| CI / 部署 | **GitHub Actions（质量闸门）+ Pages 原生集成（构建/部署/预览）** | 检查与部署分离；fork PR 拿不到 secrets 但无密钥的检查仍跑 | 全程用 `wrangler-action` 在 Actions 内部署 |
| 侵权举报 | v1 用 `mailto:` 链接 | 静态站最简方案 | Cloudflare Worker + Email Routing，或 Formspree 等表单服务（避免暴露邮箱） |

---

## 4. 关键技术决策详解

### 4.1 坐标系陷阱（务必先理解，否则历史图永远对不上）

中国大陆合规发布的地图使用 **GCJ-02**（在真实 WGS-84 上做了**非线性偏移**，俗称"火星坐标"）；百度在其上又叠加一层变成 **BD-09**。而 OSM / GPS / Allmaps 用的是 **WGS-84**。

**结论：本项目全程使用 WGS-84，底图只用 OSM 系数据。** 一旦想混入高德/百度瓦片，就必须处理 GCJ-02/BD-09 的偏移纠偏，外加它们的 API key 与授权限制——既增加复杂度又违背"免费开源"初衷。**不要混用不同坐标系的底图。** 历史地图配准时，控制点也一律打在 WGS-84 的现代底图上。

### 4.2 现代底图

**v1 现状：自托管 OpenFreeMap positron 快照（Wasabi）。** 起初直连 OpenFreeMap 公共实例（`tiles.openfreemap.org`，无 key、零基础设施），但该域名被 **GFW 阻断**，大陆未翻墙整页黑屏。遂改为**构建期把 positron 样式在成都包围盒（z10–14）范围内的矢量瓦片/字形/sprite 快照下来、自托管到 Wasabi**，运行时浏览器直连 Wasabi（已验证大陆可达）。OpenFreeMap 基于 OSM 开放数据、鼓励自托管，保留署名即合规；WGS-84 原生，**老图配准零改动**。实现：烘焙脚本 `scripts/bake-basemap.ts`、范围单一来源 `src/data/basemap/extent.ts`、改写后样式 `src/data/basemap/positron.json`（入库可评审）；CJK 汉字用浏览器本地字体渲染（`localIdeographFontFamily`），不烘焙汉字字形。**完整机制与更新指南见 `docs/basemap.md`。**

**升级路径（学习价值高 / 想拥有自己的底图）：Protomaps PMTiles，单文件直读。**
- 思路：把成都/四川局部矢量底图打包成**单个 `.pmtiles` 文件**，MapLibre 通过 `pmtiles://` 协议（`@protomaps/basemaps` 提供样式）读取。
- **放在 Wasabi 上可直接 range 读取、无需 Worker**：`pmtiles://` 靠 HTTP Range 只取需要的字节，而 Wasabi 既支持 Range(S3 GET)、又自动返回 CORS——把公开的 `.pmtiles` URL 喂给 `pmtiles://` 即可，连服务端代码都不用。
- 对比：若改放 Cloudflare Pages 则**不行**（单文件 25 MiB 上限且不支持 Range），那条路才需要 R2 + Protomaps 官方 serverless Worker 转 `x/y/z`。Wasabi 反而更省事。
- 生成局部 PMTiles：用 `go-pmtiles`/`pmtiles extract` 从官方 build 裁出成都区域，或用 Planetiler 自行构建。

### 4.3 历史地图叠加 = 地理配准（georeferencing），本项目的工程核心

**问题本质**：历史扫描图只是一张图片（尺寸不一、比例尺不一）。要把它叠到现代地图上，需要建立"图片像素坐标 ↔ 地理坐标(WGS-84)"的映射。做法是打若干**地面控制点（GCP）**：在历史图上点一个能识别的地物（如城门、河口、路口），再在现代底图上点对应位置；点足够多以后，用一个变换函数把整张图扭合（warp）过去。

**对老地图的预期**：宣统/民国早期的测绘图仍有一定形变 → 需要较多控制点、用**非线性变换（薄板样条 TPS / 三角剖分）**做"橡皮拉伸"，贴合是**近似而合理**的；1950s–1975 的图基于现代测绘，会贴得相当好。要带着"越老越需要揉、贴合非像素级精确"的心理预期。

**v1 主方案：Allmaps（IIIF 生态，浏览器内实时扭合）。**

工作流（开发阶段离线做一次，详见 §6）：
1. 用 `allmaps/iiif-tiler` 把每张扫描图切成**静态 IIIF 瓦片**（一个含 `info.json` + 瓦片的文件夹），上传到 **Wasabi**（公开桶）。
2. 打开 **Allmaps Editor**（`editor.allmaps.org`，纯静态网页），输入该图的 IIIF `info.json` URL，对照现代底图打控制点，选择变换方式（形变大的老图选 **TPS**）。
3. 导出 **Georeference Annotation**（一份微型 JSON，开放标准、数据以 CC0 发布），存进本仓库 `src/data/annotations/<mapId>.json`。
4. 应用里用 **`@allmaps/maplibre`** 的 `WarpedMapLayer` 加载该标注，浏览器端从 Wasabi 的 IIIF 瓦片实时扭合渲染叠加层。

为什么选它：配准产物是**几 KB 的 JSON**，重配只需在 Editor 里改点、替换 JSON，**无需重新切片**；纯静态；无需学 QGIS；输出开放标准、无锁定。Allmaps 还内置一个 **Tile Server 代理**，能把标注转成 XYZ 瓦片层，方便日后在 QGIS 或其他系统里复用同一份配准结果。

**Plan B（备选 / 想烘焙成永久瓦片，或 Allmaps 表现不佳时）：QGIS + GDAL 预扭合。**
QGIS Georeferencer 打 GCP（选 TPS）→ 导出 EPSG:3857 的扭合 GeoTIFF → `gdal2tiles` 切 XYZ 瓦片，或 `pmtiles` 打包成单文件栅格 → 放 R2 → MapLibre 以 `raster` 源加载。更"传统稳健"、瓦片服务快，但工具链更重、每次重配要重新导出+切片、文件多。**核心概念（控制点）与主方案完全一致**，所以两条路可互相迁移，不存在押错宝的风险。

### 4.4 时间轴与对照交互

- **时间轴**：5–8 张图跨 1909→1975 是**稀疏快照**而非连续胶片，故用**离散步进式时间轴**（带命名站点），而非连续年份滑块。站点示例：`现今` → `1975` → `民国 XX` → `宣统(1909–1911)`。`现今` 仅显示底图。
- **古今对照**：v1 用**透明度滑块**控制当前历史叠加层的不透明度（在老图与现代图间淡入淡出），实现最简单且稳健。
- **卷帘/swipe 对照**（增强项，**暂缓**）：在现代图与某历史图之间做左右滑动对比，可用 MapLibre 的 `maplibre-gl-compare` 模式（双图同步）或对叠加层 canvas 做 `clip-path`。Phase 3 暂未实现——`@allmaps` 的 `WarpedMapLayer` 是与底图共用单 canvas 的自定义层，独立裁剪成本高；现有「空格速看」已提供轻量 A/B 对照替代。
- **可分享的深链接**（**已落地**，Phase 3）：把 `epoch + 经纬度 + zoom + 透明度` 序列化进 URL hash（`replaceState` 不污染后退栈），便于分享"某条街 1949 vs 现今"。纯逻辑 `src/lib/deeplink.ts` + 往返单测；集成在 `MapViewer`。

### 4.5 站点框架与工程

**Astro + TypeScript（islands 架构）**：网站整体静态优先、默认不发 JS；地图工具作为单个 **React island** 挂在 `/cd-old-map` 路由（初稿曾用 `/tools/chengdu-historical-map`，已精简并 301 跳转，见 §13.6），其余页面（首页、工具索引、关于）保持极轻。这天然支持"网站随时间长出更多工具"——每个新工具就是一个新路由。TypeScript 全程使用（学习 + 类型安全 + 更利于 AI 协作）。

### 4.6 托管与额度

**应用** → **Cloudflare Pages（免费）**：单文件 ≤ 25 MiB，每站点 ≤ 20,000 文件，**带宽无限**（付费版可达 100,000 文件）。

**重资产（历史图 IIIF 瓦片 / 可选 PMTiles 底图）→ 对象存储。** 这是关键分工：8 张图的 IIIF 瓦片是大量小文件，会撑爆 Pages 的 2 万文件上限并拖慢部署，必须放对象存储。浏览器只在切到对应时间点时才按需拉取该图瓦片。

**对象存储选用 Wasabi（已有账号，边际零成本）：**
- S3 兼容；**CORS 自动生效**——带 `Origin` 头的请求会自动收到 permissive CORS 头并支持 OPTIONS 预检，浏览器拉瓦片开箱即用（代价是不可自定义 CORS 规则，对公开站无碍）。这比 R2/S3 还省一步配置。
- 前提：桶/对象需设为 **public**，该能力仅对**付费账号**开放（已满足）。
- 计费：$6.99/TB/月，**1TB 起步**（已是你的沉没成本，加几 GB 边际免费），90 天最低存储期（对静态老图瓦片无影响）。
- 上传时务必设对 **Content-Type**：`info.json` → `application/json`，瓦片 → `image/jpeg`/`image/png`，`.pmtiles` → `application/octet-stream`。
- **唯一须知的限制**：免费出口是**公平使用**（出口 ≈ 1× 存储量；持续达 2–3× 才可能被限速）。本项目绝对流量极小，正常不会触发；但若某工具"存得少、服务流量大"，比例可能偏高。

**可选增强（提速 + 消除上述顾虑）：在 Wasabi 前挂 Cloudflare CDN。** 多数瓦片读取命中边缘缓存 → 更快（Wasabi 无内建 CDN，直连延迟偏高），且回源出口趋近于零，公平使用比例顾虑消失。可后做。

> **存储后端完全解耦**：`maps.ts` 里只存 `info.json`/PMTiles 的 URL 字符串。"用 Wasabi / 换 R2 / 加 CDN" 是零成本切换，不构成架构承诺。
> **Workers（免费，10 万请求/天）** 仅 "自托管 Protomaps 底图" 或 "举报表单" 升级项才需要。

---

## 5. 数据模型（为标注功能预留的核心设计）

把**时间（epoch）**作为驱动一切的中心状态：同一个 `currentEpochId` 既决定显示哪一层历史栅格及其透明度，**也**用于过滤将来的标注要素。这样 v2 的标注层能直接接入，无需重构。

### 5.1 时间轴站点（epochs registry）
```ts
// src/data/epochs.ts
interface Epoch {
  id: string;            // 'present' | 'minguo-1935' | 'xuantong' ...
  label: string;         // 显示名，如 '宣统 (1909–1911)'
  order: number;         // 时间轴排序
  kind: 'basemap' | 'historical';
  mapId?: string;        // kind=historical 时，指向 maps registry
}
```

### 5.2 历史地图登记表（maps registry，含来源与版权元数据）
```ts
// src/data/maps.ts
interface HistoricalMap {
  id: string;
  title: string;            // 图名
  year: number;             // 或起止年
  iiifInfoUrl: string;      // 对象存储（Wasabi）上 IIIF info.json 的 URL
  annotationPath: string;   // src/data/annotations/<id>.json（Allmaps 标注）
  defaultOpacity: number;   // 默认透明度
  minZoom?: number; maxZoom?: number;
  provenance: {             // 用于"版权/来源"页与合规
    source: string;         // 收藏机构 / 出处
    author?: string;        // 制图者（多为当时政府部门）
    license: string;        // 例：'Public Domain'
    notes?: string;
  };
  attribution: string;      // 地图角标署名
}
```

### 5.3 标注要素（annotations，GeoJSON，v1 可为空或放少量示例）
```ts
// src/data/annotations-features.geojson —— FeatureCollection
// 每个 Feature 的 properties：
interface AnnotationProps {
  name: string;             // 例：'大城东门 / 迎晖门'
  category: string;         // '城墙' | '城门' | '河流' | '街道' | '地名' ...
  validFrom?: number;       // 该要素存在的起始年
  validTo?: number;         // 终止年（消失则填）
  description?: string;     // 弹窗说明
}
// 几何坐标一律 WGS-84。
```
MapLibre 用 `filter` 表达式按当前 epoch 的年份过滤显示哪些要素（如 `validFrom <= year <= validTo`），并支持点击弹窗。**这就是 v2 标注层接入的钩子。** v1 即使不做，也按此结构预留 `currentEpochId → 同时驱动栅格层与（未来的）GeoJSON 层` 的状态流。

---

## 6. 配准工作流（开发阶段，逐张操作）

> 建议从**最容易、最准的一张**入手（大概率是 1975 或某张民国测绘图），先打通端到端，再处理较老、较难揉的图。

1. **预处理扫描图**：高分辨率；在任意图像编辑器里裁切、纠斜（deskew）；导出为适合切片的格式。
2. **切 IIIF 瓦片**：运行 `allmaps/iiif-tiler` → 得到 `<mapId>/`（含 `info.json` + 瓦片）→ 上传到 Wasabi 公开桶；上传时设对 Content-Type（`info.json`→`application/json`，瓦片→`image/jpeg`/`png`）。首张上传后在浏览器控制台 `fetch` 一个瓦片确认 public + CORS 正常。
3. **配准**：打开 Allmaps Editor，输入 `info.json` URL；在历史图与现代底图上成对打控制点（城门、河口、稳定路口等可靠地物）；形变大的老图选 **TPS**。控制点尽量多且分布均匀。
4. **导出标注**：保存 Georeference Annotation JSON 到 `src/data/annotations/<mapId>.json`，并在 `maps.ts`、`epochs.ts` 登记该图。
5. **应用渲染**：`@allmaps/maplibre` 的 `WarpedMapLayer` 读取该标注，从 Wasabi 的 IIIF 瓦片实时扭合叠加。
6. **重配/微调**：日后只需在 Editor 里改点、替换 JSON 即可，**无需重新切片**（除非更换了源图）。

---

## 7. 仓库结构（现状）

```
/
├─ .github/workflows/
│  └─ ci.yml                              # 类型检查/lint/格式/数据校验/测试/构建（e2e 任务占位 if:false）
├─ src/
│  ├─ pages/
│  │  ├─ index.astro                      # 首页 / 工具索引
│  │  ├─ about.astro
│  │  └─ cd-old-map.astro                 # 地图工具路由（挂载 MapViewer island + 静态启动遮罩）
│  ├─ layouts/
│  │  └─ BaseLayout.astro                 # 共享外壳（fullBleed 给地图页占满视口）
│  ├─ components/                          # 地图工具的 React island 及其子组件
│  │  ├─ MapViewer.tsx                     # island 主体：MapLibre + 懒建图层 + 状态编排 + 键盘控制
│  │  ├─ Timeline.tsx                      # 离散时间轴（站点横条）
│  │  ├─ OpacityControl.tsx                # 透明度滑块
│  │  ├─ MapInfo.tsx                       # 左上当前图名/署名卡
│  │  ├─ MapLoadingOverlay.tsx(+.css)      # 分阶段加载遮罩
│  │  ├─ InfoButton.tsx                    # 左下「来源与版权」按钮
│  │  └─ SourcesModal.tsx                  # 来源/版权弹窗（遍历 maps 自动成表 + mailto + issue）
│  ├─ data/
│  │  ├─ epochs.ts                         # 时间轴站点登记表
│  │  ├─ maps.ts                           # 历史地图登记表（含 provenance）
│  │  ├─ schema.ts                         # zod schema（被 validate 与应用共用）
│  │  ├─ annotations/                      # 各图的 Allmaps 配准标注 JSON（唯一入库的配准产物）
│  │  └─ basemap/                          # 自托管底图：extent.ts（范围单一来源）+ positron.json（改写后样式）
│  └─ lib/                                 # 纯逻辑（单元测试主战场）
│     ├─ timeline.ts                       # epoch 排序/选择/步进（resolveOverlay/stepEpoch/…）
│     ├─ annotations.ts                    # import.meta.glob 按约定自动装载标注
│     └─ opacity.ts                        # 透明度钳制
├─ tests/                                  # Vitest：georef sanity + timeline + opacity
├─ scripts/
│  ├─ validate-data.ts                     # CI 数据闸门（schema + 引用完整性 + 断链 + 底图样式）
│  └─ bake-basemap.ts                      # 烘焙自托管 positron 成都快照（见 docs/basemap.md）
├─ public/                                 # favicon.svg、_redirects（旧路由 301）
├─ docs/                                   # basemap / object-storage / adding-a-map / development
│  └─ archive/phase-0-1-guide.md           # Phase 0–1 历史竣工记录（已归档）
├─ tiles/  basemap-dist/                   # 本地瓦片/底图中转产物（.gitignore，不入库）
├─ CLAUDE.md  README.md  CONTRIBUTING.md  LICENSE  .gitignore
├─ astro.config.mjs  package.json  tsconfig.json  vitest.config.ts  eslint.config.js
└─ plan.md
```
> 瓦片（IIIF 瓦片、可选 PMTiles）与底图快照存于 **Wasabi**，**不进 git**；仓库里只存 URL 与几 KB 的标注 JSON。`tiles/`、`basemap-dist/` 为本地中转目录，由脚本生成并同步到桶。
> **已落地（Phase 3）**：`e2e/`（Playwright DOM 级冒烟）+ `playwright.config.ts`，ci.yml 的 e2e job 已启用。
> **未来（架构已预留，尚未落地）**：`src/data/annotations-features.geojson`（Phase 4 标注层，见 §5.3）。

---

## 8. 开发路线图（每阶段都有可观测产出 + 可自动化的测试闸门）

设计原则：把**纯逻辑**（epoch 状态、时间过滤表达式、URL 序列化、数据登记表的引用完整性、GeoJSON 时间过滤）放在中心做单元测试；把**难测的部分**（WebGL 像素、配准的精确贴合）推到"预览 URL 上肉眼看"。于是每个阶段既有 Demo 又有 CI 闸门。

| 阶段 | 任务 | 可观测产出（Demo） | 测试闸门（CI / 可自动化） |
|---|---|---|---|
| **0 脚手架+底图** ✅ | 初始化 Astro+TS；连 Pages 原生 Git 集成；建 Wasabi 公开桶并设 Content-Type；地图路由（现 `/cd-old-map`）用 OpenFreeMap 底图定位成都，可缩放/拖拽 | 一个 `pages.dev` URL：能拖动的成都地图 | typecheck/lint/build 全绿；Playwright 冒烟：地图 canvas 挂载、无未捕获 console 报错；**浏览器拉一个 Wasabi 瓦片验证 public+CORS** |
| **1 端到端一张图** ✅（垂直切片，先啃最硬的未知） | 选最准的一张，跑完 §6 配准；`@allmaps/maplibre` 叠加 + 透明度滑块 | 预览 URL 上：老图叠在现代成都正确位置，可淡入淡出 | 该图 `maps.ts` 条目 + Allmaps 标注 JSON 通过 schema 校验；**配准 sanity 测试**：从标注算出的地理 bbox 落在成都经纬度框内、控制点残差低于阈值；透明度/状态单元测试 |
| **2 时间轴+全部图+合规** ✅（工程完成；增图为持续内容工作） | 配准其余图并登记（现 5 张：1911 / 1915 拼幅 / 1933 / 1944 / 1947）；离散时间轴 + epoch 切换（含 `现今`）；来源/版权（落地为页内 `SourcesModal` 弹窗）+ 举报 `mailto:` | 已上线 `tools.portkey.click/cd-old-map`：时间轴切换逐层换图；弹窗列出各图出处 | **全部**图的 schema + 配准 sanity 校验；**引用完整性测试**：epochs 引用的每个 `mapId` 在 maps 表存在、每个标注文件存在；epoch 排序/选择逻辑单元测试 |
| **3 体验增强** 🟡（大部完成；卷帘暂缓） | ✅ URL hash 深链接（epoch+视野+透明度）；✅ 移动端适配；✅ e2e 冒烟闸门；✅ 键盘提示增强；island 懒加载已用静态 boot 遮罩覆盖；~~卷帘/swipe 对照~~（暂缓） | 可分享的深链接 URL 能还原视图；移动端可用 | ✅ URL hash 序列化↔反序列化**往返单元测试**；✅ Playwright：访问深链接还原 epoch、移动视口控件可见（DOM 级，不做像素 diff） |
| **4 标注层**（未来，架构已预留） | 按 §5.3 写带时间有效期的 GeoJSON；渲染+按 epoch 过滤+弹窗；（可选）在未扭合老图上绘制要素 | 要素随时间轴出现/消失，点击有弹窗 | GeoJSON schema 校验；**时间过滤纯函数单元测试**：给定年份 Y，可见要素集合正确 |

**两处天生靠肉眼、但给了廉价代理测试的地方**：① 配准"贴得准不准"无法单测,但可断言标注算出的地理范围在成都框内、残差达标(能拦住"配错城市/严重偏移");精细贴合在预览 URL 上看。② WebGL 渲染在无头 CI 里做像素 diff 易抖动,故只做 DOM 级冒烟(canvas/控件存在、无报错),不比像素。

**为什么路线平滑**：最大的未知(给一张图做完整地理配准、跑通 IIIF 切片/CORS/扭合质量)被刻意前置为 Phase 1 的垂直切片,在**一张图**上先暴露所有坑,再投入其余 7 张和时间轴 UI。

**网站层面（持续）**：保持共享布局与轻量设计系统,使每个新工具 = 一个新路由。

> **当前进度（2026-06）：Phase 0–2 工程完成、Phase 3 大部完成、已上线。** `tools.portkey.click/cd-old-map` 上有 5 张配准历史图（1911 / 1915 拼幅 / 1933 / 1944 / 1947）、离散时间轴、来源/版权弹窗，全部质量闸门绿灯。`MapViewer` 已泛化为「遍历登记表 + 时间轴驱动」，新增一张图无需改渲染代码（流程见 `docs/adding-a-map.md`）。**Phase 3** 已落地 URL hash 深链接、移动端适配、Playwright e2e 冒烟闸门、键盘提示增强（island 懒加载以静态 boot 遮罩覆盖；卷帘/swipe 暂缓）。**继续向 5–8 张目标增图（尤其 1950s–1975 时段）属架构已支持的持续内容工作，只待源扫描图。** 上手与架构详解见 `docs/development.md`，状态速览见 `CLAUDE.md`。

---

## 9. 版权与合规

- 这批图为**公共领域**（制图者多为当时政府部门，可视为已无版权）。仍按良好实践：
  - **来源与版权页**：逐图标注出处、收藏机构、制图者、许可状态（见 `provenance` 字段）。
  - **侵权举报入口**：v1 用 `mailto:`（后续可升级为 Worker + Email Routing 的表单，避免暴露邮箱）。收到合理举报即下架对应图片。
  - **现代底图署名**：使用 OpenFreeMap/OSM 需显示署名——MapLibre 会自动添加；若日后用于打印/视频等非 MapLibre 场景，需手动标注 `OpenFreeMap © OpenMapTiles Data from OpenStreetMap`。用 Protomaps 时另需保留其署名。

---

## 10. CI/CD 与开源准备（GitHub）

**职责分离**：GitHub Actions 做**质量闸门**（无密钥即可跑）；Cloudflare Pages 的**原生 Git 集成**做构建/部署，并自动为每个 PR 生成**预览 URL**（这是"每次改动都可观测"的最大红利）。仓库根放一份现成的 `.github/workflows/ci.yml`（见随附文件）。

CI（PR + push 触发）依次执行：安装依赖（pnpm，带缓存）→ `astro check`/`tsc` 类型检查 → ESLint + Prettier → **数据校验**（用 zod 校验 `epochs.ts`、`maps.ts`、各 Allmaps 标注 JSON 的 schema，并做引用完整性检查）→ Vitest 单元测试 → `astro build`。可选加 Playwright DOM 级冒烟与 Lighthouse 预算。

**开源专属注意**：**fork 发来的 PR 默认拿不到 secrets** → 外部贡献者的 PR 无法部署/预览或跑需密钥的任务,但无密钥的检查(lint/build/test)照常运行。因此把重要闸门设计成**不依赖密钥**。Cloudflare Token、Wasabi 密钥作为仓库 Secrets 存放,**绝不入库**。

**瓦片同步不进每次 CI**：瓦片大且极少变,不随提交上传。可加一个**手动触发**（`workflow_dispatch`）的任务,用 `aws s3 sync`/`rclone`(Wasabi 兼容 S3)把本地 `tiles/` 推到桶里,凭密钥执行。瓦片**永不进 git**,README 写清如何重新生成。

**仓库卫生**（契合"开源"目的，并呼应 §9 版权）：
- `LICENSE`：代码用 **AGPL-3.0-or-later**(网站/网络服务，堵 GPL 的 SaaS 漏洞，详见 README「许可」节);说明地图配准数据(Allmaps 标注)为 CC0,底图需保留 OSM/OpenFreeMap/Protomaps 署名。
- `README`：项目简介、本地起步、"瓦片存于 Wasabi + 如何重新生成"、技术栈。
- `CONTRIBUTING`、`.gitignore`(忽略 `tiles/`、构建产物、`.env`)、来源/版权页。

---

## 11. 风险与权衡

| 风险 | 说明 | 缓解 |
|---|---|---|
| Allmaps 生态较小 | 主要由 TU Delft 图书馆 + 个别开发者维护 | 开源、活跃（2026 年仍在更新）、输出**开放标准**（标注 CC0），且 §4.3 Plan B（QGIS/GDAL）用**同样的控制点概念**随时可替代 → 无锁定 |
| 浏览器内扭合的性能/质量 | 极大或形变极强的图，前端实时扭合可能吃力 | 控制源图分辨率；必要时改走预扭合的栅格瓦片（Plan B）烘焙成静态层 |
| 老图贴合非精确 | 宣统/民国早期图本身测绘有限 | 提前与"对照"定位（写意式近似），多打 TPS 控制点；定位为"演变示意"而非测绘叠加 |
| 依赖第三方公共底图 | OpenFreeMap 无 SLA、靠捐赠 | 其可自托管（planet 下载）；或升级到自有的 Protomaps + R2/Wasabi 方案 |
| Wasabi 无内建 CDN / 公平使用出口 | 直连延迟偏高；出口持续超存储 2–3× 可能被限速 | 个人站绝对流量极小；瓦片按需加载 + MapLibre 缓存；必要时前置 Cloudflare CDN（提速 + 出口归零）；或换 R2 |

---

## 12. 成本估算（个人站流量）

| 项 | 方案 | 成本 |
|---|---|---|
| 应用托管 | Cloudflare Pages | ¥0（带宽无限） |
| 瓦片/重资产存储 | Wasabi（已有账号） | ¥0 边际（几 GB 在已付的 1TB 最低消费内） |
| 现代底图 | 自托管 OpenFreeMap positron 快照（Wasabi，~150–250MB） | ¥0 边际（在已付 1TB 内） |
| CI | GitHub Actions（公开仓库） | ¥0 |
| （可选）CDN / 自托管底图 Worker | Cloudflare | ¥0（免费档内） |
| 配准工具 | Allmaps / QGIS | ¥0（开源） |
| 域名（如需自定义） | 注册商 | ~¥70–100/年（可选） |
| **合计** | | **≈ ¥0/月（+ 可选域名年费）** |

---

## 13. 已确认的关键决策

1. **域名**：启用二级域名 `tools.portkey.click`（指向 Cloudflare Pages，见 runbook §1.3）。
2. **Phase 1 端到端样图**：《1933年成都街市图》（民国测绘类，预期可较好对齐；用 TPS + 较多控制点）。
3. **开发环境**：**Ubuntu**（工具链 apt 即装；与 CI 的 ubuntu runner 一致，减少环境漂移）。Mac 可作备选；Windows 走 WSL2。
4. **标注层**：定为 **Phase 4**，v1 仅按 §5 预留架构。
5. **底图路线**：v1 **已改为自托管 OpenFreeMap positron 快照（Wasabi）**——因公共实例 `tiles.openfreemap.org` 被 GFW 阻断、大陆黑屏（详见 §4.2 / `docs/basemap.md`）。自托管 Protomaps 仍为后续可选学习项。

**Phase 2 期的落地决策（与初稿的差异，便于回看）：**

6. **工具路由精简**：地图页路由由初稿的 `/tools/chengdu-historical-map` **精简为 `/cd-old-map`**；旧路径经 `public/_redirects` 做真 301 跳转（旧分享链接不 404）。`toolId`（对象存储命名空间）仍保留 `chengdu-historical-map`（见 `docs/object-storage.md`）。
7. **来源/版权改为页内弹窗**：§7 初稿设想的独立 `copyright.astro` 页**落地为地图页内的 `SourcesModal` 组件**（左下「ⓘ 来源与版权」按钮触发），构建期遍历 `maps` 登记表自动成表，并含 `mailto:` 举报与 GitHub issue 入口（`bug`/`new-map`/`calibration` 标签）。
8. **拼幅/多页图走方案 B（地理层合并）**：分别扫描的多幅（如《1915年成都街市图》左右两幅）各自切片配准，合并进同一标注的 `items[]`，渲染为一个图层、共享一个透明度滑块（见 `docs/adding-a-map.md` 附二）。
9. **首屏默认 epoch**：由 `epochs.ts` 的 `default: true` 显式指定（当前为 1933，分辨率好）；缺省则退到最新历史图。
10. **交互模型**：方向键二维控制（←→ 切时间轴 / ↑↓ 调透明度）+ 空格「速看」（按住临时隐藏老图看底图）；首屏静态启动遮罩 → React 分阶段加载层无缝接管。

> Phase 0–1 的逐步执行清单见配套文件 `docs/archive/phase-0-1-guide.md`（历史竣工记录）。**项目整体状态速览见 `CLAUDE.md`；开发上手与架构见 `docs/development.md`。**
