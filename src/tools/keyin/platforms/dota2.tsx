// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
import { useState } from "react";
import { dotaAccountId, fetchDota2 } from "../sources/apis";
import { FormRow, SubmitButton, TextField } from "./fields";
import type { Platform } from "./types";

export const dota2: Platform = {
  id: "dota2",
  name: "Dota 2",
  blurb: "OpenDota 上的比赛记录",
  group: "game",
  guide: {
    steps: [
      "找到你的 Dota 2 好友 ID：游戏里点自己的头像，个人资料里就有（一串数字）。也可以填 17 位的 Steam ID。",
      "在 Dota 2 的「设置 → 选项 → 社交」里打开 **公开比赛数据**（Expose Public Match Data），否则 OpenDota 看不到你的比赛。",
      "填 ID，点「读取」。可以先在 [OpenDota](https://www.opendota.com) 上搜一下自己，确认有比赛记录。",
    ],
    measures: "每天打的比赛场数。",
    privacy: { kind: "direct", host: "api.opendota.com" },
  },
  Form({ run }) {
    const [text, setText] = useState("");
    const id = dotaAccountId(text);
    return (
      <FormRow
        onSubmit={() =>
          id &&
          run("正在读取比赛记录…", async () => ({
            values: await fetchDota2(id),
            label: "Dota 2",
            unit: "场",
            scale: "linear",
          }))
        }
      >
        <TextField
          label="好友 ID 或 Steam ID"
          value={text}
          onChange={setText}
          placeholder="例如 70388657"
        />
        <SubmitButton disabled={!id} />
      </FormRow>
    );
  },
};
