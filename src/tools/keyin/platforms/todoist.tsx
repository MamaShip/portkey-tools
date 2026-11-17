// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
import { useState } from "react";
import { fetchTodoist } from "../sources/apis";
import {
  FormRow,
  SubmitButton,
  TextField,
  thisYear,
  YearField,
} from "./fields";
import type { Platform } from "./types";

export const todoist: Platform = {
  id: "todoist",
  name: "Todoist",
  blurb: "每天完成的任务",
  group: "notes",
  guide: {
    steps: [
      "打开 Todoist 的 [设置 → 集成 → 开发者](https://app.todoist.com/app/settings/integrations/developer)，复制 API token。",
      "把 token 粘贴到下面，选年份，点「读取」。",
    ],
    measures: "每天完成的任务数。",
    privacy: { kind: "direct", host: "api.todoist.com" },
    tips: [
      "Todoist 免费版只保留近期的完成记录，更早的需要 Pro 版才查得到。",
      "token 只在你的浏览器里使用，不会保存，也不经过本站。担心的话用完可以在同一页重新生成，旧 token 会失效。",
    ],
  },
  Form({ run }) {
    const [token, setToken] = useState("");
    const [year, setYear] = useState(thisYear);
    const valid = token.trim().length > 10;
    return (
      <FormRow
        onSubmit={() =>
          valid &&
          run("正在读取完成的任务…", async () => ({
            values: await fetchTodoist(token.trim(), year),
            label: "Todoist",
            unit: "个任务",
            scale: "linear",
            year,
          }))
        }
      >
        <TextField label="API token" value={token} onChange={setToken} secret />
        <YearField value={year} onChange={setYear} first={2008} />
        <SubmitButton disabled={!valid} />
      </FormRow>
    );
  },
};
