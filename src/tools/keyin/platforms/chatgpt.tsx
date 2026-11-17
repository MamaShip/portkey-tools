// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
import { parseChatGpt } from "../sources/chatgpt";
import { FileField, Row } from "./fields";
import type { Platform } from "./types";

export const chatgpt: Platform = {
  id: "chatgpt",
  name: "ChatGPT",
  blurb: "数据导出里你发出的消息",
  group: "ai",
  guide: {
    steps: [
      "打开 ChatGPT 的 [设置 → 数据控制](https://chatgpt.com/#settings/DataControls)，点「导出数据」并确认。",
      "OpenAI 会把下载链接发到你的邮箱（可能要几分钟到几小时），下载压缩包并解压。",
      "在下面选择解压出来的 `conversations.json`。",
    ],
    measures:
      "每天你发出的消息数。导出文件里没有 token 数，所以没法按 token 统计。",
    privacy: { kind: "local" },
    tips: ["文件可能有几十 MB，读取要几秒钟。"],
  },
  Form({ run }) {
    return (
      <Row>
        <FileField
          label="选择 conversations.json"
          accept=".json,application/json"
          onFile={(f) =>
            run("正在读取对话记录…", async () => ({
              values: parseChatGpt(await f.text()),
              label: "ChatGPT",
              unit: "条消息",
              scale: "linear",
            }))
          }
        />
      </Row>
    );
  },
};
