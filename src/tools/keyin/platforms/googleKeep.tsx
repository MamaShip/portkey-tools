// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
import { loadKeep } from "../sources/takeout";
import { FolderField, Row } from "./fields";
import type { Platform } from "./types";

export const googleKeep: Platform = {
  id: "google-keep",
  name: "Google Keep",
  blurb: "Google Takeout 里的笔记",
  group: "notes",
  guide: {
    steps: [
      "打开 [Google Takeout](https://takeout.google.com/settings/takeout)，先点「取消选择所有项目」，再只勾选「Keep」，创建导出。",
      "下载压缩包并解压，里面有一个 `Keep` 文件夹，每条笔记是一个 `.json` 文件。",
      "在下面选择这个 `Keep` 文件夹。",
    ],
    measures: "每天新建的笔记数（不算回收站里的）。",
    privacy: { kind: "local" },
  },
  Form({ run }) {
    return (
      <Row>
        <FolderField
          label="选择 Keep 文件夹"
          onFiles={(files) =>
            run("正在读取笔记…", async () => {
              const r = await loadKeep(files);
              if (!r.notes)
                throw new Error("这个文件夹里没有 Keep 笔记的 .json 文件");
              return {
                values: r.values,
                label: "Google Keep",
                unit: "条笔记",
                scale: "linear",
                note: `共 ${r.notes} 条笔记`,
              };
            })
          }
        />
      </Row>
    );
  },
};
