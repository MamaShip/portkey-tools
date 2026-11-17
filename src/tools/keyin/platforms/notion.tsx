// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
import { useState } from "react";
import { fetchNotion, notionDatabaseId } from "../sources/apis";
import { FormRow, SubmitButton, TextField } from "./fields";
import type { Platform } from "./types";

export const notion: Platform = {
  id: "notion",
  name: "Notion",
  blurb: "数据库里每天的记录数",
  group: "notes",
  guide: {
    steps: [
      "打开 [Notion 集成管理](https://www.notion.so/profile/integrations)，新建一个内部集成（Internal integration），能力里勾选「读取内容」，复制它的 token（`ntn_` 或 `secret_` 开头）。",
      "打开要统计的数据库页面，点右上角「···」→「连接」，把刚才的集成加进来，否则它读不到这个数据库。",
      "复制数据库的链接（或其中 32 位的 ID），和 token 一起填到下面。",
      "日期列可以留空：会自动用第一个有日期的列，都没有就按每条记录的创建时间。",
    ],
    measures:
      "每天的记录条数（按你选的日期列）。适合用 Notion 做打卡、读书、日记的数据库。",
    privacy: { kind: "direct", host: "api.notion.com" },
    tips: [
      "token 只在你的浏览器里使用，不会保存，也不经过本站。用完可以在集成管理里删掉这个集成。",
    ],
  },
  Form({ run }) {
    const [token, setToken] = useState("");
    const [db, setDb] = useState("");
    const [prop, setProp] = useState("");
    const id = notionDatabaseId(db);
    const valid = token.trim().length > 10 && Boolean(id);
    return (
      <FormRow
        onSubmit={() =>
          valid &&
          run("正在读取 Notion 数据库…", async () => {
            const r = await fetchNotion(token.trim(), id!, prop.trim());
            return {
              values: r.values,
              label: "Notion",
              unit: "条",
              scale: "linear",
              note: `共 ${r.rows} 条记录，日期取自「${r.used}」`,
            };
          })
        }
      >
        <TextField
          label="集成 token"
          value={token}
          onChange={setToken}
          secret
        />
        <TextField label="数据库链接或 ID" value={db} onChange={setDb} />
        <TextField
          label="日期列（可留空）"
          value={prop}
          onChange={setProp}
          grow={false}
        />
        <SubmitButton disabled={!valid} />
      </FormRow>
    );
  },
};
