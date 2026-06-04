<!--
SPDX-License-Identifier: AGPL-3.0-or-later
Copyright (C) 2026 MamaShip
-->

# 现代底图：机制说明 + 更新指南

本文面向**第一次接触这套底图的开发者**。读完你能：①弄懂现代底图是怎么来的、为什么这么设计；
②在需要时把底图刷新到最新（跟着复制粘贴就能做完）。

底图的「目录约定 / key 规则」属于参考资料，放在 [object-storage.md](./object-storage.md)；
本文讲「原理 + 怎么操作」。

---

## 一、一句话原理

> 现代底图不是实时从外网地图服务拉取的，而是**一份提前烘焙好、存放在我们自己 Wasabi 对象存储里的静态快照**。
> 浏览器直接从 Wasabi 取图，所以**大陆用户免翻墙也能用**。

为什么要这样：原来底图直连 `tiles.openfreemap.org`（OpenFreeMap 公共服务），该域名被 GFW 阻断，
大陆未翻墙会**整页黑屏**。把成都范围的瓦片下载下来自托管到 Wasabi（已验证大陆可稳定访问），问题就消失了。
OpenFreeMap 本就是基于 OpenStreetMap 的开放数据、**鼓励自托管**，所以这么做完全合规（保留署名即可）。

---

## 二、它由哪些部分组成

```
                         ┌─────────────────────────────────────────────┐
  外网（仅烘焙时用一次）   │ OpenFreeMap  tiles.openfreemap.org           │
                         │  · positron 样式 / 矢量瓦片 / 字形 / sprite   │
                         └───────────────┬─────────────────────────────┘
                                         │  pnpm bake:basemap（下载 + gzip）
                                         ▼
                            本地 basemap-dist/（临时，gitignore）
                                         │  rclone copy（上传，设好 HTTP 头）
                                         ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │ Wasabi 对象存储  portkey/basemaps/openfreemap-positron/            │
   │   tiles/{z}/{x}/{y}.pbf   sprites/ofm.*   fonts/{fontstack}/*.pbf  │
   └───────────────┬──────────────────────────────────────────────────┘
                   │  浏览器直接取图（大陆可达）
                   ▼
   src/data/basemap/positron.json  ──►  MapLibre GL（MapViewer.tsx 渲染）
   （样式：把上面这些 Wasabi URL 写死进去）
```

### 关键文件一览

| 文件                                                                | 作用                                                                                    |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [src/data/basemap/extent.ts](../src/data/basemap/extent.ts)         | **单一事实来源**：成都包围盒 bbox、缩放上下限。MapViewer 和烘焙脚本都读它，**永不漂移** |
| [scripts/bake-basemap.ts](../scripts/bake-basemap.ts)               | 烘焙脚本：从 OpenFreeMap 下载范围内的瓦片/字形/sprite，gzip 后落到 `basemap-dist/`      |
| [src/data/basemap/positron.json](../src/data/basemap/positron.json) | 改写后的 MapLibre 样式：把瓦片/字形/sprite 的地址全部指向 Wasabi。提交入库、可评审      |
| [src/components/MapViewer.tsx](../src/components/MapViewer.tsx)     | 地图组件：`import` 上面的样式来渲染，并按 extent 限制拖拽/缩放范围                      |

### 四个要记住的设计点

1. **零坐标改动**：OpenFreeMap 是 WGS-84（和 OSM/GPS 一致），1933 老图的配准控制点照旧精确对齐——
   换底图来源**不需要**重新配准。
2. **中文不烘焙字形**：汉字由浏览器本地字体渲染（MapLibre 的 `localIdeographFontFamily`），
   所以只烘焙了少量拉丁字形，体积很小。
3. **冻结快照**：现代街道定格在「上次烘焙的时刻」。想刷新就重跑一遍（见下）。这对「古今对比」工具完全够用。
4. **缓存 3 个月**：瓦片 URL 不带版本/哈希，浏览器缓存 3 个月。含义见下面「更新后多久能看到」。

---

## 三、什么时候需要更新底图

- 现代街道/地名有较大变化，想让底图跟上现实；
- 想**扩大/缩小覆盖范围**或**调整缩放级别**（这要先改 `extent.ts`，见第六节）。

平时不需要动它。下面是更新的完整步骤。

---

## 四、准备工作（第一次更新前检查一次）

更新底图需要两样东西：**能跑这个仓库的环境** + **配好的 rclone**。

### 1. 仓库能跑

能 `pnpm dev` 起本地站点就说明 Node 22 / pnpm 都就绪了。没有的话见 README「本地开发」。

### 2. rclone 已安装并配好 `wasabi` 远端

`rclone` 是一个把本地文件同步到对象存储的命令行工具。检查是否已配好：

```bash
rclone listremotes        # 期望输出里包含一行：wasabi:
```

如果**没有** `wasabi:`，用下面命令一次配好（把 KEY / SECRET 换成你的 Wasabi 凭据）：

```bash
rclone config create wasabi s3 \
  provider Wasabi \
  access_key_id YOUR_WASABI_KEY \
  secret_access_key YOUR_WASABI_SECRET \
  region ap-southeast-1 \
  endpoint s3.ap-southeast-1.wasabisys.com
```

验证连得上：

```bash
rclone lsd wasabi:portkey        # 能列出桶里的目录就 OK
```

> 凭据从 Wasabi 控制台拿。`basemaps/` 前缀需要是 **public**（公开可读）——首次已经设好，平时无需再动。

---

## 五、更新底图：跟着做就行

整个过程约 **5–15 分钟**（取决于网速；从外网下载数十 MB、gzip 落盘约 25MB，**烘焙这一步需要能访问外网/翻墙**）。

### 第 1 步 · 烘焙（下载 + 改写样式，不需要任何密钥）

```bash
pnpm bake:basemap
```

会看到进度（下载约 2,000 张瓦片 + 字形 + sprite），结束时脚本会**打印出 3 条 rclone 上传命令**。
产物落在本地 `basemap-dist/`（已 gitignore，不会进仓库）。

### 第 2 步 · 规整 + 提交样式文件

```bash
pnpm format
git add src/data/basemap/positron.json
git commit -m "刷新现代底图快照"     # 若该文件无变化，跳过这步即可（很正常）
```

> 多数刷新只是瓦片内容变了、URL 没变，所以 `positron.json` 常常**没有 diff**——这是正常的。

### 第 3 步 · 上传到 Wasabi

直接复制**脚本第 1 步打印出来的那 3 条命令**执行即可。它们形如：

```bash
rclone copy basemap-dist/openfreemap-positron/tiles   wasabi:portkey/basemaps/openfreemap-positron/tiles \
  --header-upload "Content-Type: application/x-protobuf" \
  --header-upload "Content-Encoding: gzip" \
  --header-upload "Cache-Control: public, max-age=7776000" --transfers 32 --progress

rclone copy basemap-dist/openfreemap-positron/fonts   wasabi:portkey/basemaps/openfreemap-positron/fonts \
  --header-upload "Content-Type: application/x-protobuf" \
  --header-upload "Content-Encoding: gzip" \
  --header-upload "Cache-Control: public, max-age=7776000" --transfers 16 --progress

rclone copy basemap-dist/openfreemap-positron/sprites wasabi:portkey/basemaps/openfreemap-positron/sprites \
  --header-upload "Cache-Control: public, max-age=7776000" --transfers 8 --progress
```

> 🚨 **最容易踩的坑：上传瓦片/字形必须带 `Content-Encoding: gzip`。**
> 这些 `.pbf` 是 gzip 压缩过的；漏了这个头，浏览器拿到的是压缩字节、MapLibre 解不开 → **底图空白**。
> 用脚本打印的命令就不会漏（已经带好了）。sprite（图标）不是 gzip，所以它那条命令**不带**这个头。

### 为什么用 `copy` 而不是 `sync`？（重要，别用错）

`rclone` 上传有两个很像、但后果差很大的命令：

| 命令                  | 它做什么                                  | 会不会删东西                             |
| --------------------- | ----------------------------------------- | ---------------------------------------- |
| `rclone copy 源 目标` | 把「源」里的文件**新增 / 覆盖**到「目标」 | **不会**。目标里多出来的文件原样保留     |
| `rclone sync 源 目标` | 让「目标」**变得和「源」一模一样**        | **会**。目标里「源中没有」的文件全部删掉 |

记忆法：**`copy` 只加不减，`sync` 是镜像（多退少补）**。

- **日常刷新底图：永远用 `copy`**（脚本打印的就是 `copy`）。同一个 bbox 重烘焙时坐标集不变，纯覆盖、零风险。
- **只有一种情况才考虑 `sync`**：你把覆盖范围**改小**了（见第六节），想顺手删掉 Wasabi 上范围外、已经没人用的旧瓦片。`sync` 强大但**删错找不回**，所以务必：

  ```bash
  # 先用 --dry-run 预演：只打印「会删 / 会传」哪些文件，不真的动手
  rclone sync basemap-dist/openfreemap-positron/tiles wasabi:portkey/basemaps/openfreemap-positron/tiles \
    --header-upload "Content-Type: application/x-protobuf" \
    --header-upload "Content-Encoding: gzip" \
    --header-upload "Cache-Control: public, max-age=7776000" --dry-run
  # 看清楚要删的确实是范围外的旧瓦片，再去掉 --dry-run 实跑
  ```

> ⚠️ `sync` 的方向是「**让右边等于左边**」。一旦把源和目标写反（`sync wasabi:… 本地…`），
> 会反过来删本地文件。`copy` 没有这个风险，这也是日常坚持用 `copy` 的原因。

### 更新后多久能看到？

- **全新访客**：立即看到新底图。
- **老访客（浏览器里有旧缓存）**：因为缓存 3 个月，**最长 3 个月内**自然刷新；想本地立刻看到，用浏览器硬刷新（Ctrl/Cmd+Shift+R）或无痕窗口。

---

## 六、想改「覆盖范围 / 缩放级别」

范围和缩放都集中在 [src/data/basemap/extent.ts](../src/data/basemap/extent.ts) 一个文件里
（MapViewer 和烘焙脚本共用，改一处即可，不会两边对不上）：

| 常量             | 含义                                              |
| ---------------- | ------------------------------------------------- |
| `CHENGDU_BOUNDS` | 可拖拽/烘焙的地理包围盒 `[[西,南],[东,北]]`       |
| `MIN_ZOOM`       | 最小缩放（再小看不到成都）                        |
| `MAX_ZOOM`       | 最大缩放（>14 由 MapLibre 自动放大复用 z14）      |
| `SOURCE_MAXZOOM` | 烘焙的最高瓦片层级（=14，OpenFreeMap 矢量源上限） |

改完**必须重新烘焙 + 上传**（第五节），否则新范围里没有瓦片会留白。

> ⚠️ 包围盒**放大**会让瓦片数量按面积快速增长（下载/存储变大）；缩小则更省。改完看脚本打印的瓦片张数心里有数。
> 若把范围**缩小**了、想清掉 Wasabi 上范围外的残留旧瓦片，这才是少数该用 `rclone sync` 的场景——
> 用法与风险见第五节「为什么用 `copy` 而不是 `sync`」。

---

## 七、常见问题排查

| 现象                        | 多半原因 / 处理                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| 底图整片空白/黑             | 上传瓦片漏了 `Content-Encoding: gzip`。用脚本打印的命令重传一次                                |
| 某个区域空白、别处正常      | 拖出了烘焙范围（`CHENGDU_BOUNDS` 之外没瓦片）。要么是范围设小了，要么改 extent 后忘了重烘焙    |
| 改了底图但页面还是旧的      | 浏览器缓存（最长 3 个月）。硬刷新 / 无痕窗口确认；要让所有人立刻生效需走「路径版本化」（见下） |
| 控制台报 403 / 取不到瓦片   | Wasabi 上 `basemaps/` 前缀不是 public，或 rclone 传错了 key 前缀                               |
| 中文地名不显示              | 与字形无关（汉字走本地字体）；多半是系统缺中文字体，换台设备验证                               |
| `rclone: command not found` | 没装 rclone：`sudo apt install -y rclone`（或见官网），再按第四节配 `wasabi` 远端              |

> **想「立刻对所有人生效」**：把上传前缀换成带版本的，如 `…/openfreemap-positron-2026q3/`，
> 并同步改 `positron.json` 里的 URL 基址——新 URL 必然绕过旧缓存。目前为求简单未做版本化，
> 采用「缓存 3 个月自然过期」。需要版本化可随时加。

---

## 八、术语小词典（给第一次接触的人）

- **瓦片 / tile**：地图被切成的小方块。`{z}/{x}/{y}` 分别是缩放级、列、行。
- **矢量瓦片 / `.pbf`**：不是图片，而是「线和点的数据」（protobuf 格式），由浏览器按样式现画，
  所以放大也清晰、还能换配色。
- **样式 / style（positron.json）**：告诉 MapLibre「这些瓦片该画成什么样、字体/图标在哪」。
- **fontstack / 字形 range**：地图文字用的字体切片。一个 `.pbf` 装 256 个字符（如 `0-255` 是基本拉丁+数字）。
- **sprite**：地图图标打包成的一张图 + 一份坐标表（`ofm.png` / `ofm.json`）。
- **bbox / 包围盒**：一个矩形地理范围，`[[西,南],[东,北]]` 四个经纬度。
- **rclone**：把本地文件传到对象存储（这里是 Wasabi）的命令行工具。
- **gzip / `Content-Encoding`**：一种压缩；HTTP 头 `Content-Encoding: gzip` 告诉浏览器「收到的是压缩的，请解压」。
