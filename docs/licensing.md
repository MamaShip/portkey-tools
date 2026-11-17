<!--
SPDX-License-Identifier: AGPL-3.0-or-later
Copyright (C) 2026 MamaShip
-->

# 许可（分层）

本项目不同部分使用不同许可：

| 对象                                                                 | 许可                                                                                   |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **代码**                                                             | [AGPL-3.0-or-later](../LICENSE)（GNU Affero GPL v3）                                   |
| **配准标注数据**（`src/tools/cd-old-map/data/annotations/*.json`）   | [CC0 1.0](../src/tools/cd-old-map/data/annotations/LICENSE)                            |
| **历史地图图像**                                                     | 公共领域（不在本仓库内，站内「来源与版权」页逐图标注出处）                             |
| **现代底图**                                                         | © OpenStreetMap 贡献者 / OpenFreeMap，需保留署名（MapLibre 会自动渲染）                |
| **刻印的模型与数据读取代码**（`src/tools/keyin/` 下标注 MIT 的文件） | MIT，衍生自 [GitHubPoster](https://github.com/yihong0618/GitHubPoster)，保留原作者声明 |
| **刻印使用的 Noto 字体**                                             | 未经修改，[SIL Open Font License 1.1](../src/tools/keyin/text/fonts/OFL.txt)           |

说明：

- AGPL-3.0 与本项目所用的 MIT / BSD 依赖（Astro、React、MapLibre 等）兼容；刻印中 MIT 许可的文件同样兼容。
- 若你（fork 者）希望严格锁定 3.0，可在源文件声明里去掉 “or any later version”，即 `AGPL-3.0-only`。
- 配准标注选 CC0 是为了贴合 Allmaps / IIIF 数据集生态，说明见 [`annotations/README.md`](../src/tools/cd-old-map/data/annotations/README.md)。
- 提交 PR 即表示你同意你的贡献按本项目代码许可（AGPL-3.0-or-later）发布。

## 源文件许可声明

推荐使用轻量的 SPDX 标识（放在文件首行注释）：

```
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 <Author>
```

## 版权与侵权处理

历史地图均取自公共领域。若你认为某张图存在版权问题，请邮件联系 **youdangls@gmail.com**，我会将对应图片下架。每张图的来源与收藏机构在站内「来源与版权」页可查。
