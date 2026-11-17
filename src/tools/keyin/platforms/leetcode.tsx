// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
import { useState } from "react";
import {
  fetchLeetCode,
  FIRST_LEETCODE_YEAR,
  LEETCODE_USER,
  type LeetCodeSite,
} from "../sources/leetcode";
import {
  FormRow,
  SelectField,
  SubmitButton,
  TextField,
  thisYear,
  YearField,
} from "./fields";
import type { Platform } from "./types";

const SITES = [
  ["cn", "力扣（leetcode.cn）"],
  ["com", "LeetCode（leetcode.com）"],
] as const;

export const leetcode: Platform = {
  id: "leetcode",
  name: "LeetCode / 力扣",
  blurb: "公开的提交日历",
  group: "code",
  guide: {
    steps: [
      "选你用的站点：力扣（leetcode.cn）或 LeetCode 国际站（leetcode.com）。",
      "填用户名：打开你的个人主页，地址是 `leetcode.cn/u/用户名/` 或 `leetcode.com/u/用户名/`，填其中「用户名」那一段（不是昵称）。",
      "选年份，点「读取」。不需要登录。",
    ],
    measures: "每天的提交次数（包括没通过的），和个人主页上的提交日历一致。",
    privacy: { kind: "proxy", host: "leetcode.cn / leetcode.com" },
    tips: [
      "个人主页需要是公开的；如果在隐私设置里隐藏了提交记录，这里也读不到。",
    ],
  },
  Form({ run }) {
    const [site, setSite] = useState<LeetCodeSite>("cn");
    const [user, setUser] = useState("");
    const [year, setYear] = useState(thisYear);
    const valid = LEETCODE_USER.test(user.trim());
    return (
      <FormRow
        onSubmit={() =>
          valid &&
          run("正在读取提交日历…", async () => ({
            values: await fetchLeetCode(user.trim(), year, site),
            label: site === "cn" ? "力扣" : "LeetCode",
            unit: "次提交",
            scale: "linear",
            year,
          }))
        }
      >
        <SelectField
          label="站点"
          value={site}
          options={SITES}
          onChange={setSite}
        />
        <TextField
          label="用户名"
          value={user}
          onChange={setUser}
          placeholder="个人主页地址里的那一段"
        />
        <YearField
          value={year}
          onChange={setYear}
          first={FIRST_LEETCODE_YEAR}
        />
        <SubmitButton disabled={!valid} />
      </FormRow>
    );
  },
};
