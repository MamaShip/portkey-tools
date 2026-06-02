<!--
SPDX-License-Identifier: AGPL-3.0-or-later
Copyright (C) 2026 MamaShip
-->

# 贡献指南

欢迎贡献！无论是修 bug、提供新的成都老地图、贡献更准确的配准数据，还是改进文档，都很感谢。

> 先读 **[`CLAUDE.md`](./CLAUDE.md)**（项目状态速览）与 **[`docs/development.md`](./docs/development.md)**（上手与架构），能少走很多弯路。

## 开发环境

```bash
nvm install 22 && nvm use 22 && corepack enable
pnpm install
pnpm dev          # → http://localhost:4321/cd-old-map
```

详见 [`docs/development.md`](./docs/development.md) §1。

## 提交 PR 前

本地把全部质量闸门跑绿（与 CI 同序）：

```bash
pnpm check && pnpm lint && pnpm format:check && pnpm validate && pnpm test
```

- 文档/Markdown 改动也会过 `format:check`（除 `.prettierignore` 列出的手写文档外）——写完跑一次 `pnpm format` 写回即可。
- 新建源文件请加 SPDX 头：

  ```
  // SPDX-License-Identifier: AGPL-3.0-or-later
  // Copyright (C) 2026 <Author>
  ```

## PR / Issue 流程

- 从 `master` 开分支，小步提交，PR 描述写清**动机**与**改了什么**。
- CI（[`.github/workflows/ci.yml`](./.github/workflows/ci.yml)）会在 PR 上自动跑闸门；Cloudflare Pages 会给每个 PR 生成**预览 URL**，请在预览上自检（地图类改动尤其要肉眼确认对齐/交互）。
- **关于 fork PR**：来自 fork 的 PR 默认**拿不到仓库 Secrets**，因此无法触发需要密钥的部署/预览；但无密钥的检查（类型检查 / lint / 格式 / 数据校验 / 测试 / 构建）会照常运行。维护者会在需要时帮忙跑预览。Cloudflare Token、Wasabi 密钥等**绝不入库**。
- 报 bug / 提交老地图 / 提供校准数据，请用对应的 **Issue 模板**（[`.github/ISSUE_TEMPLATE/`](./.github/ISSUE_TEMPLATE/) 下的结构化表单，开 issue 时自动可选，会带好标签 `bug` / `new-map` / `calibration`）；地图页「ⓘ 来源与版权」弹窗里的按钮会直接打开对应表单。版权/侵权问题走 issue 选择页的「侵权举报」邮件入口、私下处理。

## 贡献一张历史地图 / 配准数据

完整流程见 **[`docs/adding-a-map.md`](./docs/adding-a-map.md)**。要点：

- 瓦片与源扫描图体量大、**永不进 Git**——它们存于对象存储（Wasabi），仓库内只提交几 KB 的 Allmaps 配准标注 JSON 与登记表改动。
- 历史地图须为**公共领域**（多为当时政府机构所制）；在 `src/data/maps.ts` 的 `provenance` 里如实填写来源/收藏/制图者，会自动出现在「来源与版权」弹窗。

## 许可

- **代码**按 **[AGPL-3.0-or-later](./LICENSE)** 发布；提交 PR 即表示你同意你的贡献以此许可发布。
- **配准标注数据**（`src/data/annotations/*.json`）以 **CC0** 发布。
- 详见 [`README.md`](./README.md) 的「许可（分层）」一节。
