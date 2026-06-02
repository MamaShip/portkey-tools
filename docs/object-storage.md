<!--
SPDX-License-Identifier: AGPL-3.0-or-later
Copyright (C) 2026 MamaShip
-->

# 对象存储目录规则（Wasabi）

> 本站把「重资产」（历史图 IIIF 瓦片、将来的自托管底图 PMTiles 等）放在 Wasabi 对象存储，
> 仓库里只存 URL 与几 KB 的标注 JSON（见 `plan.md` §4.6 / §7）。
> 本文件规定**桶内对象 key 的目录约定**，**所有工具与后续开发都应遵循**，以免不同工具的资产
> 在桶根互相污染。

## 桶与访问

| 项                          | 值                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------- |
| 桶名（bucket）              | `portkey`                                                                             |
| 区域（region）              | `ap-southeast-1`                                                                      |
| Endpoint                    | `s3.ap-southeast-1.wasabisys.com`                                                     |
| 公开 URL 形式（path-style） | `https://s3.ap-southeast-1.wasabisys.com/portkey/<key>`                               |
| 公开访问                    | 桶/前缀设为 public（付费账号）；**CORS 无需配置**，Wasabi 自动返回 permissive CORS 头 |
| Content-Type                | 由 `rclone` 按扩展名自动判定（`.json`→`application/json`，`.jpg`→`image/jpeg`）       |

## 顶层分类（按资产类别，而非按工具）

```
portkey/                                   (bucket 根)
├─ tools/                                   每个工具的私有资产，按工具 id 隔离
│  └─ <toolId>/                             工具 id = 站点路由 /tools/<toolId> 同名
│     └─ <assetType>/                       资产类型：iiif | pmtiles | data | ...
│        └─ <resourceId>/                   单个资源（如一张历史地图的 id）
│           └─ ...
├─ basemaps/                                跨工具共享的自托管底图
│  └─ openfreemap-positron/                 OpenFreeMap positron 成都快照（矢量瓦片，见下）
│     ├─ tiles/{z}/{x}/{y}.pbf
│     ├─ sprites/ofm.json|.png|@2x.json|@2x.png
│     └─ fonts/{fontstack}/{range}.pbf
└─ （其余顶层类别按需新增，如 site/ 等，保持「按类别」而非「按工具」散落桶根）
```

### 约定细则

- **`toolId`**：与站点路由 `/tools/<toolId>` 保持同名（kebab-case）。例：`chengdu-historical-map`。
- **`assetType`**：标识资产种类，便于一个工具下并存多类资产。当前用到：
  - `iiif/` —— IIIF Image API 静态瓦片（Allmaps 实时扭合的输入）。
  - `pmtiles/` / `data/` —— 预留给将来的栅格瓦片、PMTiles、GeoJSON 等。
- **`resourceId`**：单个资源 id。历史地图即 `<mapId>`（与 `src/data/maps.ts` 的 `id` 一致）。
- **命名**：key 一律 **ASCII + kebab-case**，**不要用中文 / 空格**（源扫描图文件名可为中文，但切片/上传前改成 ASCII id，如 `chengdu-1933`）。id 一经发布即视为稳定，勿改名（会断链）。

## IIIF 瓦片专项规则（本站当前主要资产）

一张历史地图切成 IIIF 瓦片后，整组文件放在：

```
portkey/tools/<toolId>/iiif/<mapId>/
├─ info.json
└─ <各级瓦片…>
```

**关键约束**：切片时 `info.json` 里的 `id` 字段**必须等于该 `<mapId>` 目录的公开 URL 基址**，
否则 IIIF 查看器解析瓦片会断链。用 `iiif-tiler` 切片时通过 `-identifier`（**带末尾斜杠**）设定：

```bash
java -jar iiif-tiler.jar <ascii-name>.jpg -version 3 -tile_size 512 -output tiles \
  -identifier https://s3.ap-southeast-1.wasabisys.com/portkey/tools/<toolId>/iiif/
# iiif-tiler 会把图名追加到 identifier 之后 → info.json id 即 .../iiif/<mapId>
```

## 自托管底图：OpenFreeMap positron（成都快照）

交互底图原本直连 `tiles.openfreemap.org`，该域名被 GFW 阻断，大陆未翻墙会黑屏。改为把
positron 在**成都包围盒 + z10–14** 范围内的矢量瓦片/sprite/拉丁字形快照到 Wasabi 自托管，
运行时浏览器直连 Wasabi 取底图，大陆免翻墙可用，且零坐标改动（OSM/WGS-84，老图配准照旧）。

| 项         | 值                                                                                  |
| ---------- | ----------------------------------------------------------------------------------- |
| 资产前缀   | `portkey/basemaps/openfreemap-positron/`                                            |
| 范围/缩放  | 见 `src/data/basemap/extent.ts`（bbox 与 z 由它单一来源，MapViewer 与烘焙脚本共用） |
| 运行时引用 | `src/data/basemap/positron.json`（改写后指向 Wasabi 的 style，提交入库、可评审）    |
| 瓦片数量   | z10–14 约 1,300 张（区域小，故可自托管）                                            |

**（重新）烘焙 + 上传步骤**（面向小白的完整图文指南见 [basemap.md](./basemap.md)）：

```bash
pnpm bake:basemap          # 下载到 basemap-dist/ 并改写 src/data/basemap/positron.json（无需密钥）
pnpm format                # 规整改写后的 positron.json
# 然后按脚本末尾打印的 rclone 命令上传（需 wasabi remote）：
rclone copy basemap-dist/openfreemap-positron/tiles   wasabi:portkey/basemaps/openfreemap-positron/tiles \
  --header-upload "Content-Type: application/x-protobuf" \
  --header-upload "Content-Encoding: gzip" \
  --header-upload "Cache-Control: public, max-age=7776000" --transfers 32 --progress
# fonts/ 同上头部；sprites/ 仅加 Cache-Control（Content-Type 由 rclone 按扩展名自动判定）
```

> **关键坑**：瓦片/字形是 **gzip 压缩的 protobuf**，上传时**必须**带 `Content-Encoding: gzip`
> （`bake:basemap` 已把字节 gzip 好，rclone 命令也带了该头）；否则浏览器拿到压缩字节、
> MapLibre 解不开 → 底图空白。CJK 汉字字形不烘焙（MapLibre `localIdeographFontFamily`
> 用浏览器本地字体渲染）。底图为冻结快照、缓存 3 个月（`max-age=7776000`）：URL 不带哈希，
> 故重烘焙覆盖同名对象后，回访用户最长 3 个月内自然刷新（全新访客立即生效）。

## 当前实例：成都老地图

| 项                 | 值                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| toolId             | `chengdu-historical-map`                                                                                   |
| mapId              | `chengdu-1933`（《1933年成都街市图》）                                                                     |
| 资产前缀           | `portkey/tools/chengdu-historical-map/iiif/chengdu-1933/`                                                  |
| info.json 公开 URL | `https://s3.ap-southeast-1.wasabisys.com/portkey/tools/chengdu-historical-map/iiif/chengdu-1933/info.json` |
| info.json `id`     | `https://s3.ap-southeast-1.wasabisys.com/portkey/tools/chengdu-historical-map/iiif/chengdu-1933`           |

**上传命令模板**（本地 `tiles/<mapId>/` → 桶内对应前缀）：

```bash
rclone copy ./tiles/<mapId> \
  wasabi:portkey/tools/<toolId>/iiif/<mapId> --transfers 16 --progress
```

> 瓦片体量大、极少变动，**永不进 git**（`.gitignore` 已忽略 `tiles/`、`*.jpg` 等）。
> 重新生成方式见本文件与 `phase-0-1-guide.md` §2.2–2.3。
