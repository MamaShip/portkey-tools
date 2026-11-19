// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
import { loadGpx } from "../sources/sport";
import { FolderField, Row } from "./fields";
import type { Platform } from "./types";

export const gpx: Platform = {
  id: "gpx",
  name: "GPX 轨迹",
  blurb: "跑步、骑行等运动轨迹",
  group: "sport",
  guide: {
    steps: [
      "从运动 App 导出 `.gpx` 轨迹文件：佳明 Connect、高驰、Keep、咕咚等都能在单次活动里导出 GPX；Strava 的整包导出里 `activities` 文件夹也有。",
      "把这些 `.gpx` 放进同一个文件夹（可以有子文件夹）。",
      "在下面选择这个文件夹。",
    ],
    measures:
      "每天的运动距离（公里），按轨迹开始的日期算，同一天的多条轨迹相加。",
    privacy: { kind: "local" },
    tips: [
      "只认 `.gpx`。`.fit`、`.tcx` 格式请先用 App 或工具转成 GPX；只想要 Strava 的数据，用「Strava」更省事。",
      "距离按经纬度计算，不含海拔，和 App 里显示的会有少许出入。",
    ],
  },
  Form({ run }) {
    return (
      <Row>
        <FolderField
          label="选择放 .gpx 的文件夹"
          onFiles={(files) =>
            run("正在读取轨迹…", async () => {
              const r = await loadGpx(files);
              if (!r.tracks)
                throw new Error("这个文件夹里没有能读的 .gpx 轨迹");
              return {
                values: r.values,
                label: "GPX",
                unit: "公里",
                scale: "linear",
                note: `读取了 ${r.tracks} 条轨迹${r.skipped ? `，${r.skipped} 个文件没有轨迹点被跳过` : ""}`,
              };
            })
          }
        />
      </Row>
    );
  },
};
