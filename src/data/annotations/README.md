# 配准标注（Georeference Annotations）

本目录存放成都老地图工具的**地理配准标注**，每张历史图一份：`<mapId>.json`（如 `chengdu-1933.json`）。

## 这是什么

每个文件是一份 [IIIF Georeference Annotation](https://iiif.io/api/extension/georef/)（Allmaps 导出的开放标准 JSON）：记录该历史图扫描件上的控制点（像素坐标 ↔ WGS-84 经纬度）与变换信息，供 `@allmaps/maplibre` 在浏览器里实时把老图扭合贴到现代底图上。

- 体量只有几 KB，是本仓库内**唯一入库的配准产物**（瓦片与源扫描图存于对象存储，不进 Git）。
- 由 `src/lib/annotations.ts` 经 `import.meta.glob` 自动装载——**新增一张图只需在此放一份 JSON 并在登记表登记**，不碰渲染代码（流程见 [`docs/adding-a-map.md`](../../../docs/adding-a-map.md)）。

## 帮忙修正 / 优化配准（不用写代码，欢迎历史 & 地理爱好者）

如果你发现某张老图贴得不够准（街道错位、城墙歪斜……），**不需要会编程也能帮上忙**。配准本身是一件「在老图和现代地图上点对点」的事，用 Allmaps 的网页编辑器就能做：

1. **打开 Allmaps 编辑器**：<https://editor.allmaps.org/>
2. **加载本项目的图**：把下表对应的 `info.json` 地址粘进编辑器（编辑器顶部的「Load a IIIF resource / URL」输入框），老图扫描件就会加载进来。
3. **校正控制点**：在老图上的地标（城门、桥、街口、庙宇等）与现代底图上的同一点之间，增删或拖动控制点（GCP），让两边对齐。点越多、越均匀，扭合越准。
4. **选择变换方式（Transformation）**：编辑器里可切换「变换方式」，它决定老图被**怎样扭合**贴到底图上。不同方式各有脾气，简单科普如下（选完可在预览里直接看效果，多试几种对比）：
   - **Polynomial 1 次（多项式·线性，默认）**：整体均匀地平移 / 旋转 / 缩放 / 拉斜，全图刚性变形、不局部弯曲。控制点很少也能用；适合**测绘较准、比例一致**的近代实测图。
   - **Helmert（相似变换）**：只允许平移 + 旋转 + 等比缩放，**严格保持原图形状**（不拉伸、不剪切）。适合你相信老图本身几何很准、只想「摆正对位」而不想引入任何扭曲的情况。
   - **Thin Plate Spline（薄板样条，TPS / 橡皮膜）**：像把老图当橡皮膜局部抻拉，**强制穿过每一个控制点**，能吸收手绘老图各处不均匀的误差。**成都这类年代久远、手绘 / 实测不均的老图通常用它效果最好**——但它很「听话」也很敏感：控制点太少、扎堆或点错，没覆盖到的区域就会乱飘。用 TPS 请保证**点数足够且全图均匀铺开**。
   - **Polynomial 2 / 3 次**：比 1 次更灵活、能修一些渐变形变，但点不够时边缘容易「鼓包」摆动，一般不如 TPS 直观，慎用。

   > 经验法则：先用默认的 **Polynomial 1 次**快速对个大概，发现局部（如某个城角）始终对不上，再换 **TPS** 并在那一带补点。在 issue 里**注明你最终用的是哪种变换**。

5. **导出配准结果**：在编辑器里导出 **Georeference Annotation**（一份 JSON）——变换方式会一并写进这份 JSON，无需另外说明。
6. **提交给我们**：到本仓库开一个 [GitHub Issue](https://github.com/MamaShip/portkey-tools/issues/new)，写明是哪张图、改了什么，并把导出的 JSON **作为附件或贴在代码块里**。开发者会替你接入、在预览 URL 上核对后合并。

> **并非所有提交都会被采纳。** 配准好坏需要人工判断，因此请在 issue 里**写清楚关键改进点**——比如「修正了东门城墙的错位」「西半城整体偏移约 50 米已对齐」「补了 8 个桥梁控制点」等，越具体越好。开发者会对照预览**人工确认确有改进后**才合并；若新配准在某些区域反而变差、或改进无法判断，可能会被退回讨论或不予采纳。这不针对个人，只为保证站上每张图的对齐质量。

> 你提交的配准数据会按本目录的 **CC0 1.0** 并入仓库（见下一节）——也就是说，提交即表示你同意把这份标注置于公共领域。

### 各历史图的 `info.json` 地址（粘进 Allmaps 编辑器用）

| 地图 ID（年代）           | IIIF `info.json`                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| `chengdu-1903`（1903）    | <https://s3.ap-southeast-1.wasabisys.com/portkey/tools/chengdu-historical-map/iiif/chengdu-1903/info.json> |
| `chengdu-1911`（1911）    | <https://s3.ap-southeast-1.wasabisys.com/portkey/tools/chengdu-historical-map/iiif/chengdu-1911/info.json> |
| `chengdu-1915`（1915，左幅/城西） | <https://s3.ap-southeast-1.wasabisys.com/portkey/tools/chengdu-historical-map/iiif/chengdu-1915-left/info.json> |
| `chengdu-1915`（1915，右幅/城东） | <https://s3.ap-southeast-1.wasabisys.com/portkey/tools/chengdu-historical-map/iiif/chengdu-1915-right/info.json> |
| `chengdu-1933`（1933）    | <https://s3.ap-southeast-1.wasabisys.com/portkey/tools/chengdu-historical-map/iiif/chengdu-1933/info.json> |
| `chengdu-1944`（1944）    | <https://s3.ap-southeast-1.wasabisys.com/portkey/tools/chengdu-historical-map/iiif/chengdu-1944/info.json> |
| `chengdu-1947`（1947）    | <https://s3.ap-southeast-1.wasabisys.com/portkey/tools/chengdu-historical-map/iiif/chengdu-1947/info.json> |
| `chengdu-1989`（1989）    | <https://s3.ap-southeast-1.wasabisys.com/portkey/tools/chengdu-historical-map/iiif/chengdu-1989/info.json> |

> **关于 1915 拼幅图**：这张图原件分左右两幅，分别扫描、各自配准后在地理上拼合（左=城西、右=城东）。修正它时请**分别加载左、右两个 `info.json`**，每幅单独配准；在 issue 里注明你改的是哪一幅。

## 许可：CC0 1.0 Universal（公共领域弃权）

**本目录下的全部配准标注 JSON 以 [CC0 1.0 Universal](./LICENSE) 发布**，即作者放弃一切著作权及相关权利，置于公共领域。你可以无需署名、无条件地复制、修改、再分发与商用。完整法律文本见同目录的 [`LICENSE`](./LICENSE) 文件。

> 选 CC0 是为了贴合 Allmaps / IIIF 数据集生态：配准标注本质是开放数据，CC0 让它能被任何人无障碍复用、汇入更大的开放配准库。

## 与仓库其他许可的关系（务必区分）

本目录的 CC0 **不等于**仓库根目录的 [`LICENSE`](../../../LICENSE)。本项目刻意分层授权：

| 对象                                | 许可                          |
| ----------------------------------- | ----------------------------- |
| **代码**                            | AGPL-3.0-or-later（根 LICENSE） |
| **配准标注数据**（本目录 `*.json`） | **CC0 1.0**（本目录 LICENSE） |
| **历史地图图像**                    | 公共领域（不在本仓库，逐图标注出处） |
| **现代底图**                        | © OpenStreetMap / OpenFreeMap，需保留署名 |

详见仓库根 [`README.md`](../../../README.md) 的「许可（分层）」一节。
