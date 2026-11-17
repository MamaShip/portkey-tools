// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
import { parseWakaTime } from "../sources/health";
import { FileField, Row } from "./fields";
import type { Platform } from "./types";

export const wakatime: Platform = {
  id: "wakatime",
  name: "WakaTime",
  blurb: "每天的编程时长",
  group: "code",
  guide: {
    steps: [
      "登录 WakaTime，打开 [账户设置](https://wakatime.com/settings/account)，找到 **Export**（导出数据），导出每天的汇总（daily summaries / totals）。",
      "WakaTime 准备好后会发邮件，下载里面的 JSON 文件（如果是压缩包就先解压）。",
      "在下面选择这个 JSON 文件。",
    ],
    measures: "每天的编程时长（小时）。",
    privacy: { kind: "local" },
    tips: [
      "WakaTime 的接口不允许网页直接调用，所以这里读导出文件，不需要 API key。",
      "免费账户在网站上只能看到最近的数据，但导出文件里有全部历史。",
    ],
  },
  Form({ run }) {
    return (
      <Row>
        <FileField
          label="选择 WakaTime 导出的 JSON"
          accept=".json,application/json"
          onFile={(f) =>
            run("正在读取 WakaTime 数据…", async () => ({
              values: parseWakaTime(await f.text()),
              label: "WakaTime",
              unit: "小时",
              scale: "linear",
            }))
          }
        />
      </Row>
    );
  },
};
