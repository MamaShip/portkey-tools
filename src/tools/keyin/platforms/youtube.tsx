// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
import { parseYouTubeHistory } from "../sources/takeout";
import { FileField, Row } from "./fields";
import type { Platform } from "./types";

export const youtube: Platform = {
  id: "youtube",
  name: "YouTube",
  blurb: "Google Takeout 里的观看记录",
  group: "media",
  guide: {
    steps: [
      "打开 [Google Takeout](https://takeout.google.com/settings/takeout)，先点「取消选择所有项目」，再只勾选「YouTube 和 YouTube Music」。",
      "点这一项下面的「包含所有 YouTube 数据」，只留「历史记录」；再点「多种格式」，把「历史记录」的格式从 HTML 改成 **JSON**。",
      "创建导出，下载压缩包并解压，在 `YouTube 和 YouTube Music/历史记录/` 里找到 `watch-history.json`，在下面选择它。",
    ],
    measures: "每天看过的视频数（包括 YouTube Music，不算广告）。",
    privacy: { kind: "local" },
    tips: [
      "如果选到的是 `watch-history.html`，说明格式没改成 JSON，需要重新导出。",
    ],
  },
  Form({ run }) {
    return (
      <Row>
        <FileField
          label="选择 watch-history.json"
          accept=".json,application/json"
          onFile={(f) =>
            run("正在读取观看记录…", async () => ({
              values: parseYouTubeHistory(await f.text()),
              label: "YouTube",
              unit: "个视频",
              scale: "linear",
            }))
          }
        />
      </Row>
    );
  },
};
