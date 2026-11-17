// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
import { useState } from "react";
import { fetchGithub, FIRST_GITHUB_YEAR, GITHUB_USER } from "../sources/github";
import {
  FormRow,
  SubmitButton,
  TextField,
  thisYear,
  YearField,
} from "./fields";
import type { Platform } from "./types";

export const github: Platform = {
  id: "github",
  name: "GitHub",
  blurb: "公开的贡献日历",
  group: "code",
  guide: {
    steps: [
      "填你的 GitHub 用户名，也就是个人主页地址 `github.com/用户名` 里的那一段。",
      "选年份，点「读取」。",
    ],
    measures:
      "每天的贡献数（提交、PR、issue、代码评审等），和个人主页上的绿格子一致。",
    privacy: { kind: "proxy", host: "github.com" },
    tips: [
      "私有仓库里的贡献，要先在 [GitHub 个人资料设置](https://github.com/settings/profile) 里勾选 **Include private contributions on my profile** 才会算进来。",
    ],
  },
  Form({ run }) {
    const [user, setUser] = useState("");
    const [year, setYear] = useState(thisYear);
    const valid = GITHUB_USER.test(user.trim());
    return (
      <FormRow
        onSubmit={() =>
          valid &&
          run("正在读取 GitHub 贡献日历…", async () => ({
            values: await fetchGithub(user.trim(), year),
            label: "GitHub",
            unit: "次贡献",
            scale: "linear",
            year,
          }))
        }
      >
        <TextField
          label="GitHub 用户名"
          value={user}
          onChange={setUser}
          placeholder="例如 yihong0618"
        />
        <YearField value={year} onChange={setYear} first={FIRST_GITHUB_YEAR} />
        <SubmitButton disabled={!valid} />
      </FormRow>
    );
  },
};
