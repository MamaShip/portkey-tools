<!--
SPDX-License-Identifier: AGPL-3.0-or-later
Copyright (C) 2026 MamaShip
-->

# 刻印（keyin）

路由 `/keyin`。把一年的每日记录做成可以 3D 打印的 STL：一天一根柱子，底座斜面压印平台名、名字和年份。支持 17 个平台（见下表），全部在浏览器里完成，只有 GitHub 和 LeetCode 的公开日历经 Pages Function 转发。

模型生成移植自开源项目 keyin（Python，MIT），keyin 衍生自 [GitHubPoster](https://github.com/yihong0618/GitHubPoster)（MIT）。

## 数据流

```
platforms/<id>.tsx（说明 + 表单）  →  sources/*.ts  →  {"YYYY-MM-DD": 数值}
        │                                              │
        ▼                                              ▼
KeyinTool.tsx（状态：数据、年份、名字、平台名、柱高、汉字写法）
        │  useBuilder.ts：输入一变，防抖 300 ms 后发给 worker，只保留最新结果
        ▼
worker.ts（Web Worker）
        │  model/skyline.ts  底座 + 每天一根柱子 + 斜面文字
        │  text/shape.ts     文字 → 像素掩码（HarfBuzz 排版，字体按需下载）
        │  model/mesh.ts     掩码挤出成流形网格，写二进制 STL
        ▼
Preview.tsx（three.js，按需加载）     下载按钮（Blob → keyin_<平台>_<年>.stl）
```

## 目录

| 路径                                | 是什么                                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/tools/keyin/model/`            | 网格与 skyline 模型（从 keyin 移植，MIT）。`config.ts` 是所有尺寸。                           |
| `src/tools/keyin/text/`             | 字体清单、下载缓存、双向文字、HarfBuzz 排版与填充（MIT）。                                    |
| `src/tools/keyin/text/catalog.json` | 169 个 Noto 字体的清单（固定提交 + sha256 + 覆盖范围），由 keyin 仓库的脚本生成，原样拷贝。   |
| `src/tools/keyin/text/fonts/`       | 随站点发布的 Noto Sans 与 OFL 许可。                                                          |
| `src/tools/keyin/sources/`          | 各平台的解析与请求（纯函数）；`github.ts`、`leetcode.ts` 里还有 Pages Function 的实现。       |
| `src/tools/keyin/platforms/`        | 每个平台一个文件：说明 + 表单；`index.ts` 登记顺序，`types.ts` 定义接口与分组。               |
| `src/tools/keyin/components/`       | React island：`KeyinTool`（主体）、`PlatformPanel`（选择器 + 说明）、`Preview`、样式等。      |
| `src/tools/keyin/worker.ts`         | 模型 worker；消息格式在 `protocol.ts`。                                                       |
| `functions/api/keyin/`              | Pages Function：`github?user=&year=`、`leetcode?user=&year=&site=com\|cn`。                   |
| `scripts/keyin/stage-fonts.ts`      | `pnpm keyin:stage-fonts`：下载并校验全部字体，摆成 Wasabi 上的目录结构。                      |
| `tests/keyin/`、`e2e/keyin/`        | 单测（网格流形、双向文字、各平台解析、接口翻页、两个转发）与 e2e 冒烟（读 JSON → 下载 STL）。 |

## 平台

| 平台              | 分组       | 数据从哪来                                     | 统计                           |
| ----------------- | ---------- | ---------------------------------------------- | ------------------------------ |
| GitHub            | 编程       | 公开贡献日历，**本站转发**                     | 每天贡献数                     |
| LeetCode / 力扣   | 编程       | 公开提交日历（GraphQL），**本站转发**          | 每天提交次数                   |
| GitHub Issue 打卡 | 编程       | api.github.com，浏览器直连（私有仓库需 token） | 评论第一行的数字或评论条数     |
| WakaTime          | 编程       | 导出的 JSON                                    | 每天编程小时数                 |
| Claude Code       | AI         | 本地 `~/.claude/projects` 文件夹               | token 或回复次数               |
| ChatGPT           | AI         | 数据导出的 `conversations.json`                | 每天发出的消息                 |
| Apple 健康        | 运动与健康 | `export.xml`（流式读取）                       | 圆环三项、步数、距离           |
| Strava            | 运动与健康 | 账户存档里的 `activities.csv`                  | 距离、次数、时长，可按运动类型 |
| GPX 轨迹          | 运动与健康 | 一个文件夹的 `.gpx`                            | 每天距离                       |
| AutoSleep         | 运动与健康 | App 导出的 CSV                                 | 每天睡眠小时                   |
| YouTube           | 影音与阅读 | Google Takeout 的 `watch-history.json`         | 每天看的视频数                 |
| NeoDB             | 影音与阅读 | NeoDB API，浏览器直连（token）                 | 每天标记数                     |
| Notion            | 笔记与任务 | Notion API，浏览器直连（集成 token）           | 数据库每天的记录数             |
| Todoist           | 笔记与任务 | Todoist API v1，浏览器直连（token）            | 每天完成的任务数               |
| Google Keep       | 笔记与任务 | Google Takeout 的 `Keep` 文件夹                | 每天新建的笔记                 |
| Dota 2            | 游戏       | OpenDota API，浏览器直连                       | 每天比赛场数                   |
| 自己的数据        | 通用       | JSON 或 CSV                                    | 你给的数值                     |

**为什么其他平台没有上网页版**：B 站、Kindle、微信读书、即刻、佳明、Forest、Switch、Nike Run Club、开心词场、OpenLanguage、多邻国在 GitHubPoster 里都要登录 Cookie 或密码，网页版要让用户把它们交给本站，不做；佳明等运动数据可以导出 GPX 用上面的「GPX 轨迹」。扇贝的接口已经要求登录。GitLab 继续只在命令行版 keyin 里支持。

### 新增一个平台

1. 在 `sources/` 里写解析或请求的纯函数（文件解析接收文本 / `File`，接口请求用浏览器的 `fetch`），返回 `{"YYYY-MM-DD": 数值}`，并在 `tests/keyin/` 里加单测。
2. 在 `platforms/<id>.tsx` 写一个 `Platform`：`guide`（步骤、统计什么、隐私类型、提示；步骤里可用 `[文字](https://…)`、`` `代码` ``、`**加粗**`）和 `Form`（用 `platforms/fields.tsx` 里的控件，读到数据后调用 `run(提示, 异步任务)`）。
3. 在 `platforms/index.ts` 登记。单测会检查 id 不重复、说明齐全、链接都是 https。
4. 平台接口不允许浏览器跨域、但数据是公开的：照 `sources/leetcode.ts` 写一个 `handleXxxRequest`，再在 `functions/api/keyin/` 加一个转发文件。**需要用户密码或 Cookie 的平台不要做成转发。**

## 字体

- **回退链**：按 `catalog.json` 的顺序，每个字符用第一个收录它的字体。只有 Noto Sans（431 KB）随站点发布，其他字体在第一次用到时下载，全部 168 个共 43 MB，其中中日韩字体 18.4 MB。
- **下载顺序**：Wasabi（`portkey/tools/keyin/fonts/<提交前 12 位>/<文件名>`）→ raw.githubusercontent.com → jsDelivr。每个文件都校验 sha256，通过后存进浏览器的 Cache Storage（`keyin-fonts-v1`），下次不再下载。
- **为什么要放 Wasabi**：raw.githubusercontent.com 在大陆被墙，jsDelivr 在大陆也不稳定。Wasabi 上没有时会自动退回上游，所以上传之前功能也正常，只是大陆用户可能下载不了非西文字体。
- **汉字写法**：中日韩字体是一个 TTC，内含简体、繁体、香港、日本、韩国五个字面。按「页面上选的汉字写法 → 文字里的假名 / 韩文字母 → 浏览器语言 → 简体」挑选。

### 上传字体到 Wasabi（首次，以及更新 catalog.json 之后）

```bash
pnpm keyin:stage-fonts      # 下载到 keyin-fonts-dist/（已在 .gitignore），逐个校验 sha256
# 然后运行脚本末尾打印的 rclone 命令（需要 wasabi remote，见 adding-a-map.md）：
rclone copy keyin-fonts-dist wasabi:portkey/tools/keyin/fonts \
  --header-upload "Cache-Control: public, max-age=31536000, immutable" --transfers 8 --progress
```

路径里带着上游提交号，文件永不改变，所以可以缓存一年。机器走 HTTP 代理时，Node 的 `fetch` 默认不读代理环境变量，加上 `NODE_USE_ENV_PROXY=1`。

### 更新字体清单

`catalog.json` 由 keyin 仓库的 `tools/build_font_catalog.py` 生成。更新后把新文件拷到 `src/tools/keyin/text/`，重新跑上面的上传步骤（旧提交号目录可以留着，不影响新版本）。

## GitHub 与 LeetCode 转发

LeetCode 的转发（`functions/api/keyin/leetcode.ts`）向 `leetcode.com/graphql` 或 `leetcode.cn/graphql/noj-go/` 查询公开的 `userCalendar.submissionCalendar`，用法和缓存规则与 GitHub 相同。

github.com 不允许浏览器跨域读取贡献日历，所以 `functions/api/keyin/github.ts` 代为请求 `https://github.com/users/<user>/contributions?from=<年>-01-01&to=<年>-12-31`，解析成 `{user, year, days}` 返回，并放进 Cloudflare 边缘缓存（今年 1 小时，往年 1 天）。用户名和年份都先校验格式，不碰任何密钥。计入 Workers 免费额度（每天 10 万次请求）。

**本地开发**：`pnpm dev` 不运行 Pages Function，GitHub、LeetCode 会报错，其他平台正常。要在本地试它们，可以先 `pnpm build`，再用 Cloudflare 的 `wrangler pages dev dist` 同时起静态站和函数。

## 许可

- `src/tools/keyin/model/`、`text/`、`sources/` 里移植自 keyin 的文件保留 MIT 声明（GitHubPoster 原作者与 keyin 两行版权），MIT 代码可以并入本仓库的 AGPL 项目。
- 本工具新写的界面、worker、Pages Function 用 AGPL-3.0-or-later，和仓库其他代码一致。
- Noto 字体未经修改，SIL Open Font License 1.1；`text/fonts/OFL.txt` 随站点发布，也随字体一起上传到 Wasabi。页面底部有许可说明和链接。
