<!--
SPDX-License-Identifier: AGPL-3.0-or-later
Copyright (C) 2026 MamaShip
-->

# SOP：新增一张历史地图

> 把一张历史扫描图叠到现代成都底图上的**完整、可独立执行**的标准流程。
> 从一张图片到站点上可淡入淡出的叠加层，分 7 步：**预处理 → 切片 → 上传 → 验证 → 配准 → 登记 → 校验预览**。
>
> 本文以 Phase 1 的《1933年成都街市图》（`mapId = chengdu-1933`）为实例，命令可直接照抄改 id。
> 配套阅读：对象存储目录约定见 [`object-storage.md`](./object-storage.md)；整体设计见 [`../plan.md`](../plan.md)。
>
> **核心心智模型**：切片（步骤 2）是纯机械的「把一张大图切成多分辨率瓦片金字塔」，**不涉及任何地理**；
> 真正的「对齐/标定」只发生在 Allmaps 配准（步骤 5），靠人工成对打控制点。两者别混淆。

---

## 0. 一次性环境准备（Ubuntu）

```bash
# Node 22 + pnpm（项目已锁 .nvmrc=22、packageManager=pnpm@10.21.0）
nvm install 22 && nvm use 22 && corepack enable

# 切片需要 Java（跑 iiif-tiler.jar）；上传需要 rclone（S3 兼容）
sudo apt update && sudo apt install -y default-jre rclone

# 校验
node -v && pnpm -v && java -version && rclone version
```

下载切片器 `iiif-tiler.jar`（放到仓库根，**已被 `.gitignore` 忽略，勿入库**）：

```bash
curl -L -o iiif-tiler.jar \
  https://github.com/glenrobson/iiif-tiler/releases/download/1.0.2/iiif-tiler.jar
# 本 SOP 基于 v1.0.2。其用法：java -jar iiif-tiler.jar -help
```

配置 rclone 的 Wasabi remote（仅首次；交互式，密钥不入库，存于 `~/.config/rclone/`）：

```bash
rclone config
#  n) New remote → name: wasabi
#  Storage: 选 5 (s3)            ← Wasabi 不是独立选项，藏在 S3 兼容里
#  provider: Wasabi             ← 下一屏才出现，打 Wasabi
#  env_auth: false
#  access_key_id / secret_access_key: 在 Wasabi 控制台 Access Keys 里新建一对（Root 或限定桶的子用户）
#  region: 留空回车
#  endpoint: s3.ap-southeast-1.wasabisys.com
#  其余默认；y 保存
rclone listremotes   # 应看到 wasabi:
```

---

## 1. 预处理源扫描图

1. 高分辨率扫描；在任意图像编辑器里**裁掉黑边/白边、纠斜（deskew）**，导出。纠斜质量靠肉眼，是后续贴合的基础。
2. **关键：文件名用 ASCII**，命名为 `<mapId>.<ext>`，例如 `chengdu-1933.jpg`。
   - `mapId` 用 kebab-case：`chengdu-<年份>` 或 `chengdu-<年份>-<限定词>`。一经发布即视为稳定，勿改名（会断链）。
   - **为什么必须 ASCII**：`iiif-tiler` 会用「文件名（去扩展名）」当作 IIIF 图像的文件夹名**并拼进 `info.json` 的 `id`**；中文/空格会进 URL，徒增麻烦。源图可叫中文，但切片前先 `cp 原名.jpg chengdu-1933.jpg`。
3. 源图是大二进制，**不入库**（`.gitignore` 已忽略 `*.jpg/*.jpeg/*.tif/*.tiff`）。

---

## 2. 切静态 IIIF 瓦片

```bash
# 通用形式
java -jar iiif-tiler.jar <mapId>.jpg \
  -version 3 -tile_size 512 -output tiles \
  -identifier https://s3.ap-southeast-1.wasabisys.com/portkey/tools/<toolId>/iiif/

# chengdu-1933 实例（toolId = chengdu-historical-map）
java -jar iiif-tiler.jar chengdu-1933.jpg \
  -version 3 -tile_size 512 -output tiles \
  -identifier https://s3.ap-southeast-1.wasabisys.com/portkey/tools/chengdu-historical-map/iiif/
```

产物：`tiles/<mapId>/`（含 `info.json` + 各级瓦片，本例 437 个文件、约 43 MB）。`tiles/` 已 gitignore。

**⚠️ 三个必须拧对的点：**

1. **`-identifier` 必须带末尾斜杠 `/`**。工具把图名直接拼到 identifier 之后——
   - 带 `/`：`.../iiif/` + `chengdu-1933` → `.../iiif/chengdu-1933` ✅
   - 漏 `/`：`.../iiif` + `chengdu-1933` → `.../iiifchengdu-1933` ❌（断链）
2. **identifier 必须等于该图瓦片在 Wasabi 上的公开 URL 基址**（即步骤 3 上传到的前缀）。所以**切片前就要定好 `toolId`/`mapId` 与目录约定**（见 [`object-storage.md`](./object-storage.md)）。
3. `-version 3` 切 IIIF v3（Allmaps 用）；`-tile_size 512` 合理；不传时默认是 v2.1.1 / 1024，别用错。

**验证 `info.json` 正确**（切完立刻看）：

```bash
grep -oE '"(id|type)" : "[^"]*"|"width" : [0-9]+|"height" : [0-9]+' tiles/<mapId>/info.json | tail -3
# 期望：id = .../iiif/<mapId>（无多余/缺失斜杠）；type = ImageService3；width/height = 源图实际像素
```

---

## 3. 上传到 Wasabi

```bash
# 通用形式（注意：传到「命名空间前缀」，不是桶根！）
rclone copy ./tiles/<mapId> \
  wasabi:portkey/tools/<toolId>/iiif/<mapId> --transfers 16 --progress

# chengdu-1933 实例
rclone copy ./tiles/chengdu-1933 \
  wasabi:portkey/tools/chengdu-historical-map/iiif/chengdu-1933 --transfers 16 --progress
```

- **⚠️ 目录约定**：所有工具资产按 `tools/<toolId>/<assetType>/<resourceId>/` 命名隔离，**不要直接传到桶根**（详见 [`object-storage.md`](./object-storage.md)）。
- **Content-Type 自动**：rclone 按扩展名设（`.json`→`application/json`，`.jpg`→`image/jpeg`），无需手动。
- **桶/前缀须 public**（在 Wasabi 控制台设）；**CORS 无需配置**，Wasabi 自动返回 permissive 头。

得到 `info.json` 公开 URL：
`https://s3.ap-southeast-1.wasabisys.com/portkey/tools/<toolId>/iiif/<mapId>/info.json`

---

## 4. 验证 public + CORS + Content-Type

带 `Origin` 头 curl，复现浏览器请求：

```bash
BASE=https://s3.ap-southeast-1.wasabisys.com/portkey/tools/chengdu-historical-map/iiif/chengdu-1933
curl -s -I -H "Origin: https://tools.portkey.click" "$BASE/info.json" \
  | grep -iE 'HTTP/|content-type|access-control-allow-origin'
# 期望：200 OK · Content-Type: application/json · Access-Control-Allow-Origin: *
```

- 200 + `Access-Control-Allow-Origin: *` → 公开且 CORS 正常，浏览器可读。
- 403/拿不到 CORS 头 → 桶/前缀没设 public，回步骤 3 检查。
- 也可顺手验一个瓦片（`.jpg`）应是 `Content-Type: image/jpeg`。

---

## 5. 在 Allmaps Editor 地理配准（唯一的人工对齐步骤）

1. 打开 **https://editor.allmaps.org**，粘贴上面的 `info.json` URL，回车加载老图。
2. 进入控制点模式，**成对打控制点**：先点老图上一个可辨地物，再点现代底图上它今天的位置。
   - **8–15 个、分布均匀**（四角 + 中心都要，别全挤在市中心）。
   - 选稳定地物：城门遗址/城墙拐角、河道交汇（府河+南河/合江亭）、文庙/武侯祠/青羊宫、主要十字路口、桥梁等。
3. **选变换方式**：
   - 默认 polynomial order 1（仿射，全局刚性）。民国测绘图整体能用。
   - **越老/形变越大的图，改用 TPS（薄板样条）**做局部「橡皮拉伸」，并多打、补四角点。
4. **导出 Georeference Annotation**（一小段 JSON），保存为 `src/data/annotations/<mapId>.json`。
   - **⚠️ 校验**：该 JSON 里 `target.source.id` 必须等于 `info.json` 的 `id`（即 `.../iiif/<mapId>`），否则加载时取不到瓦片。
   - 这份标注是本仓库**唯一需要入库**的产物（几 KB），数据按 CC0 发布。

> 重配只需回 Editor 改点、重新导出覆盖该 JSON，**无需重新切片/重传**（除非换了源图）。

---

## 6. 登记到站点

### 6.1 历史地图登记表 `src/data/maps.ts`

```ts
{
  id: "chengdu-1933",
  title: "1933年成都街市图",
  year: 1933,
  iiifInfoUrl:
    "https://s3.ap-southeast-1.wasabisys.com/portkey/tools/chengdu-historical-map/iiif/chengdu-1933/info.json",
  annotationPath: "src/data/annotations/chengdu-1933.json",
  defaultOpacity: 0.7,
  provenance: { source: "（填收藏机构/出处）", license: "Public Domain" },
  attribution: "《1933年成都街市图》（公共领域）",
}
```

字段含义见 [`../src/data/schema.ts`](../src/data/schema.ts)。`provenance.source` 务必补真实出处（供「来源与版权」页）。

### 6.2 时间轴站点 `src/data/epochs.ts`

```ts
{ id: "1933", label: "1933", order: 50, kind: "historical", mapId: "chengdu-1933" }
```

`order` 越大越新（时间轴左旧 → 右新，最右是 `present`）；`mapId` 必须指向 6.1 的 `id`（`pnpm validate` 会查引用完整性）。

### 6.3 ✅ 渲染器已泛化：新增图无需改组件代码（Phase 2 起）

[`MapViewer.tsx`](../src/components/MapViewer.tsx) 已从「硬编码单图」泛化为**遍历 `epochs`/`maps` 登记表 + 离散时间轴驱动**：

- 标注由 [`src/lib/annotations.ts`](../src/lib/annotations.ts) 用 `import.meta.glob` **按约定自动装载**（`src/data/annotations/<mapId>.json` 一放即被纳入，键 = 文件名 = `mapId`）。
- 时间轴每图一站，单选切换；活动历史图层**首访才懒建**（未访问的图永不拉瓦片）。

因此**新增一张图 = 6.1 登记 + 6.2 登记 + 放一个标注 JSON**，三者齐备即自动出现在时间轴上，**不再触碰渲染代码**。配准 sanity 测试（步骤 7）也已遍历 `maps`，新图自动获得覆盖。

---

## 7. 本地校验 + 预览

```bash
pnpm validate   # schema + 引用完整性（会检查 annotationPath 文件确实存在）
pnpm test       # 配准 sanity（控制点数量/地理坐标在成都框内）+ 透明度/时间轴单测
pnpm check && pnpm lint && pnpm format:check && pnpm build   # 类型/规范/构建
pnpm dev        # http://localhost:4321/tools/chengdu-historical-map → 肉眼核对对齐 + 拖滑块淡入淡出
```

- **配准 sanity 测试** [`tests/georef.test.ts`](../tests/georef.test.ts) 已**遍历 `maps` 登记表**（标注经 `src/lib/annotations.ts` 自动装载），断言每图控制点 ≥6、`geo` 落在成都经纬度框（lng 103.6–104.4 / lat 30.3–30.9）、像素坐标在源图尺寸内。新增图**自动获得覆盖，无需手写断言**。
- **预览里看什么**：① 老图叠在正确位置、主要街道/城门/河道大致对应（老图是近似贴合，非像素级）；② 滑块在「现今 0% ↔ 历史 100%」平滑过渡；③ 控制台无与我们相关的报错。
- **关于控制台告警**：底图用的是 OpenFreeMap 公共样式（`positron`），可能残留几条 `Expected number, found null` 之类的**第三方样式 worker 告警**——纯 dev 噪声、对用户无影响，根治要等自托管底图（plan §4.2）。我们自己的代码不应有报错。

---

## 8. 提交（git 卫生）

只提交**几 KB 的标注 JSON + 登记表/渲染代码改动**：

```
src/data/annotations/<mapId>.json
src/data/maps.ts
src/data/epochs.ts
```

**永不入库**（已在 `.gitignore`）：`tiles/`、源图 `*.jpg`、`iiif-tiler.jar`、`node_modules/`、`dist/`。
瓦片体量大、极少变动，是对象存储的资产，仓库里只留它的 URL。推 PR 后在 Cloudflare 预览 URL 上再核一遍对齐。

---

## 附：常见坑速查

| 现象                                          | 原因                                         | 解决                                                         |
| --------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------ |
| `info.json` id 出现 `iiif<mapId>`（少个斜杠） | `-identifier` 漏了末尾 `/`                   | 加 `/` 重切（步骤 2）                                        |
| 浏览器/Allmaps 取不到瓦片、断链               | `info.json` id ≠ 瓦片实际公开 URL 基址       | 让 identifier == 上传前缀；或改 id 重切                      |
| 标注加载报错、图不显示                        | 标注 `target.source.id` ≠ `info.json` id     | 在 Editor 用正确 info.json URL 重配导出                      |
| curl 403 / 无 CORS 头                         | 桶/前缀没设 public                           | Wasabi 控制台设 public（步骤 3）                             |
| 瓦片散落桶根、与别的工具混在一起              | 上传到了 `wasabi:portkey/<mapId>`            | 传到 `tools/<toolId>/iiif/<mapId>`（步骤 3）                 |
| URL 里出现中文/`%E5%9B%BE`                    | 源图用了中文文件名                           | 切片前 `cp` 成 ASCII 的 `<mapId>.jpg`（步骤 1）              |
| `pnpm validate` 报标注文件缺失                | `maps.ts` 的 `annotationPath` 写错或文件没放 | 路径对齐 `src/data/annotations/<mapId>.json`                 |
| 老图边角对不齐                                | 用了仿射（order 1）                          | Editor 改 TPS + 补四角控制点，重新导出（步骤 5，无需重切片） |

---

## 附二：多页 / 拼幅地图（方案 B）

有些图源是**分成多张分别扫描**的（如《1915年成都街市图》分左右两张，尺寸还不一致：左 7936×12606、右 8134×12917）。**不要在像素层硬拼**——分别扫描的图有比例/朝向差异，`+append` 会错位且把误差永久烤进瓦片。改在**地理层**合并：每幅各自配准到底图，各自独立钉到真实经纬度，于是在底图上自然对齐相遇，接缝是「地理正确」而非「像素硬拼」。

本仓库的标注是带 `items[]` 的 `AnnotationPage`，渲染器对整页 `addGeoreferenceAnnotation` 并整层 `setOpacity` ⇒ **多幅放进一个标注的 `items` 里 = 一个图层 = 时间轴一站 = 共享一个透明度滑块**。相对主流程（单图）只有这些差异：

1. **切片/上传（步骤 2–4）跑 N 遍**：每幅一个 ASCII 图幅 id（`<mapId>-left` / `<mapId>-right` …），各自切片、各自传到 `.../iiif/<图幅id>`、各自验 public+CORS。
2. **配准（步骤 5）每幅一次**：分别用各自 `info.json` 在 Editor 配准。**接缝一侧额外多打几个控制点**；若两幅有**重叠带**，在重叠带选同一批地物，把各幅那份都钉到**同一经纬度** → 接缝必然重合。各幅独立 warp 会各自吸收各次扫描的比例/朝向差。
3. **合并标注**：把各幅导出的 Annotation 收进**一个** `src/data/annotations/<mapId>.json` 的 `items`（数组）。**主图幅放 `items[0]`**——`maps.ts` 的 `iiifInfoUrl` 填这一幅的 info.json，`validate` 用它做断链主锚点。
4. **登记/渲染照常**：`maps.ts` + `epochs.ts` 各一行，**渲染器零改动**。
5. **测试与数据闸门已支持多 items**：[`tests/georef.test.ts`](../tests/georef.test.ts) 遍历每一幅断言控制点数/地理框/像素尺寸；[`scripts/validate-data.ts`](../scripts/validate-data.ts) 除主锚点外，还校验其余每幅 `source.id` 都落在同一 `/iiif/` 前缀下（防某幅断链漏过 CI）。

实例：`mapId=chengdu-1915`，图幅 `chengdu-1915-left` / `chengdu-1915-right`，`iiifInfoUrl` 指 `chengdu-1915-left/info.json`。
