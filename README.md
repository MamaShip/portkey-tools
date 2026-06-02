
# Portkey Tools · 工具箱

> 一个提供有趣小工具的个人网站。
> 入口：**https://tools.portkey.click**

当前第一个工具是 **成都老地图**：在现代地图上叠加经过地理配准的成都历史老地图（宣统年间 ~ 1975 年），可在时间轴上切换时间点、用透明度滑块在古今之间淡入淡出，观察街道与城市形态的演变。


## 它是怎么工作的

- **现代底图**：[OpenFreeMap](https://openfreemap.org) positron（基于 OpenStreetMap 的矢量瓦片）的成都范围**快照，自托管在 Wasabi**（避开被 GFW 阻断的公共服务，大陆免翻墙可用），由 [MapLibre GL JS](https://maplibre.org) 渲染。全程 WGS-84 坐标系。机制与更新指南见 [`docs/basemap.md`](./docs/basemap.md)。
- **历史地图**：每张老地图切成静态 [IIIF](https://iiif.io) 瓦片托管在对象存储；用 [Allmaps](https://allmaps.org) 在浏览器内按控制点实时扭合（warp）叠加到现代底图上。配准产物是一份开放标准的 Georeference Annotation（JSON）。
- **站点**：[Astro](https://astro.build) + TypeScript（islands 架构），地图工具是一个仅客户端渲染的 React island。
- **托管**：应用在 Cloudflare Pages；历史图瓦片在对象存储（Wasabi），不入库。

## 技术栈

Astro · TypeScript · React · MapLibre GL JS · Allmaps（@allmaps/maplibre, @allmaps/annotation）· IIIF · OpenFreeMap / OpenStreetMap · Cloudflare Pages · Wasabi（S3 兼容对象存储）

## 本地开发

前置（Ubuntu 示例；详见 `docs/archive/phase-0-1-guide.md`）：

```bash
# Node 22（Active LTS）+ pnpm
nvm install 22 && nvm use 22 && corepack enable
# 仅“新增历史图”切片时需要：
sudo apt install -y default-jre libvips-tools rclone
```

运行：

```bash
pnpm install
pnpm dev          # http://localhost:4321 → /cd-old-map
```

常用脚本：

| 命令 | 作用 |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm preview` | 开发 / 构建 / 预览 |
| `pnpm check` | 类型检查（astro check） |
| `pnpm lint` · `pnpm format:check` | 代码检查 / 格式检查 |
| `pnpm validate` | 校验地图登记表、时间轴、配准标注与底图样式（schema + 引用完整性） |
| `pnpm test` | 单元测试（含配准 sanity） |
| `pnpm bake:basemap` | 重新烘焙现代底图快照（下载 + 改写样式；机制见 [`docs/basemap.md`](./docs/basemap.md)） |

CI 由 GitHub Actions 跑上述质量闸门（见 `.github/workflows/ci.yml`）；部署与每个 PR 的预览 URL 由 Cloudflare Pages 原生 Git 集成负责。

## 新增一张历史地图

**完整 SOP（含确切命令与踩坑速查）见 [`docs/adding-a-map.md`](./docs/adding-a-map.md)**，可独立照做。概要：

1. 预处理扫描图（裁切、纠斜）。
2. 切静态 IIIF 瓦片：`java -jar iiif-tiler.jar <map>.jpg -version 3 -output ./tiles`。
3. 上传瓦片到对象存储（`rclone copy ...`）——key 目录约定见 [`docs/object-storage.md`](./docs/object-storage.md)，资产放在 `tools/<toolId>/iiif/<mapId>/`。
4. 在 [Allmaps Editor](https://editor.allmaps.org) 对照现代底图打控制点 → 导出 Georeference Annotation 到 `src/data/annotations/<id>.json`。
5. 在 `src/data/maps.ts` 与 `src/data/epochs.ts` 登记该图。
6. `pnpm validate && pnpm test` 通过后提交 PR，在预览 URL 上肉眼确认对齐。

**大文件政策**：IIIF 瓦片（及可选的 PMTiles 底图）体量大、极少变动，**不进 Git**——它们存于对象存储，仓库内只保存其 URL 与几 KB 的标注 JSON。`tiles/` 为本地中转目录，已在 `.gitignore` 内。

## 许可（分层）

本项目刻意区分“代码”“数据”“地图图像”“底图”的许可：

- **代码：[AGPL-3.0-or-later](./LICENSE)（GNU Affero GPL v3）。** AGPL-3.0 与本项目所用的 MIT/BSD 依赖（Astro、React、MapLibre 等）兼容。
  - 若你（fork 者）希望严格锁定 3.0，可在源文件声明里去掉 “or any later version”，即 `AGPL-3.0-only`。
- **配准数据**（Georeference Annotations，`src/data/annotations/*.json`）：贴合 Allmaps 生态，用 CC0。
- **历史地图图像**：**公共领域**（多为当时政府机构所制）。它们不在本仓库内，按站内“来源与版权”页逐图标注出处；不受本仓库许可约束。
- **现代底图**：© OpenStreetMap 贡献者 / OpenFreeMap，**需保留署名**（MapLibre 会自动渲染）。

给源文件加许可声明，推荐使用轻量的 SPDX 标识（放在文件首行注释）：

```
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
```

## 版权与侵权处理

历史地图均取自公共领域。若你认为某张图存在版权问题，请邮件联系 **youdangls@gmail.com**，我会将对应图片下架。每张图的来源与收藏机构在站内“来源与版权”页可查。

## 贡献

欢迎 PR。提交即表示你同意你的贡献按本项目代码许可（AGPL-3.0-or-later）发布。注意：来自 fork 的 PR 默认拿不到仓库 Secrets，因此无法触发需要密钥的部署/预览，但无密钥的 CI 检查（类型检查 / lint / 测试 / 构建）会照常运行。详见 [`CONTRIBUTING.md`](./CONTRIBUTING.md)。

## 致谢

[Allmaps](https://allmaps.org)（TU Delft Library 等）· [glenrobson/iiif-tiler](https://github.com/glenrobson/iiif-tiler) · [OpenStreetMap](https://www.openstreetmap.org) · [OpenFreeMap](https://openfreemap.org) · [MapLibre](https://maplibre.org) · [Astro](https://astro.build) · IIIF 社区
