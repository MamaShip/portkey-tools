// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
import { useState } from "react";
import {
  fetchIssueComments,
  parseRepo,
  type IssueMetric,
} from "../sources/apis";
import { FormRow, SelectField, SubmitButton, TextField } from "./fields";
import type { Platform } from "./types";

const METRICS = [
  ["number", "评论第一行的数字"],
  ["count", "评论条数"],
] as const;

export const githubIssue: Platform = {
  id: "github-issue",
  name: "GitHub Issue 打卡",
  blurb: "用 issue 评论记录每天的数字",
  group: "code",
  guide: {
    steps: [
      "在你的某个仓库里开一个 issue 当打卡本，每天发一条评论，**第一行只写当天的数字**（比如跑了几公里、读了几页），后面可以随便写。可以参考 [yihong0618 的打卡 issue](https://github.com/yihong0618/2021/issues/5)。",
      "填仓库（`用户名/仓库名`，或直接粘贴仓库网址）和 issue 编号。",
      "私有仓库还需要一个 token：在 [GitHub 新建 fine-grained token](https://github.com/settings/personal-access-tokens/new)，只选这个仓库，权限给 **Issues: Read-only** 就够了。",
    ],
    measures: "每天评论第一行的数字之和；也可以改成只数每天的评论条数。",
    privacy: { kind: "direct", host: "api.github.com" },
    tips: [
      "公开仓库不填 token 也能读，一小时内最多能读约 6000 条评论，一般够用。",
      "第一行不是数字的评论按 0 计。",
    ],
  },
  Form({ run }) {
    const [repoText, setRepoText] = useState("");
    const [issue, setIssue] = useState("");
    const [token, setToken] = useState("");
    const [metric, setMetric] = useState<IssueMetric>("number");
    const repo = parseRepo(repoText);
    const n = Number(issue.replace(/^#/, ""));
    const valid = Boolean(repo) && Number.isInteger(n) && n > 0;
    return (
      <FormRow
        onSubmit={() =>
          valid &&
          run("正在读取 issue 评论…", async () => ({
            values: await fetchIssueComments(repo!, n, metric, token.trim()),
            label: "打卡",
            unit: metric === "count" ? "条" : "",
            scale: "linear",
          }))
        }
      >
        <TextField
          label="仓库"
          value={repoText}
          onChange={setRepoText}
          placeholder="例如 yihong0618/2021"
        />
        <TextField
          label="issue 编号"
          value={issue}
          onChange={setIssue}
          placeholder="例如 5"
          grow={false}
        />
        <SelectField
          label="统计"
          value={metric}
          options={METRICS}
          onChange={setMetric}
        />
        <TextField
          label="token（私有仓库才需要）"
          value={token}
          onChange={setToken}
          secret
        />
        <SubmitButton disabled={!valid} />
      </FormRow>
    );
  },
};
