// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
import { useState } from "react";
import {
  CLAUDE_METRICS,
  loadClaudeCode,
  type ClaudeMetric,
} from "../sources/claudeCode";
import { FolderField, Row, SelectField } from "./fields";
import type { Platform, Run } from "./types";

const METRICS = Object.entries(CLAUDE_METRICS) as [ClaudeMetric, string][];

function read(run: Run, files: File[], metric: ClaudeMetric) {
  run("正在读取会话日志…", async () => {
    const r = await loadClaudeCode(files, metric);
    if (!r.files) {
      throw new Error(
        "这个文件夹里没有 .jsonl 会话日志，请选择 .claude 下面的 projects 文件夹",
      );
    }
    return {
      values: r.values,
      label: "Claude Code",
      unit: metric === "messages" ? "次回复" : "token",
      scale: metric === "messages" ? "linear" : "sqrt",
      note: `读取了 ${r.files} 个日志文件、${r.responses.toLocaleString("zh-CN")} 次回复`,
    };
  });
}

export const claudeCode: Platform = {
  id: "claude-code",
  name: "Claude Code",
  blurb: "本地会话日志里的 token 用量",
  group: "ai",
  guide: {
    steps: [
      "Claude Code 把每次会话记在本机的 `projects` 文件夹里：Windows 是 `C:\\Users\\你的用户名\\.claude\\projects`，macOS / Linux 是 `~/.claude/projects`。",
      "在下面点选择文件夹，选中这个 `projects` 文件夹。",
      "选统计方式。换统计方式不用重新选文件夹。",
    ],
    measures:
      "默认是每天用掉的全部 token。长会话里「缓存读取」往往占大头，想看「新」工作量可以选不含缓存读取。",
    privacy: { kind: "local" },
    tips: [
      "macOS 的选择窗口默认不显示 `.claude` 这样的隐藏文件夹，按 **⌘ ⇧ .** 就能看到。",
      "浏览器会提示「上传」整个文件夹，其实文件只在本页面里读取，不会离开你的电脑。",
      "同一次回复在日志里出现多次时只算一次。",
    ],
  },
  Form({ run }) {
    const [files, setFiles] = useState<File[] | null>(null);
    const [metric, setMetric] = useState<ClaudeMetric>("total");
    return (
      <Row>
        <FolderField
          label="选择 projects 文件夹"
          onFiles={(f) => {
            setFiles(f);
            read(run, f, metric);
          }}
        />
        <SelectField
          label="统计"
          value={metric}
          options={METRICS}
          onChange={(m) => {
            setMetric(m);
            if (files) read(run, files, m);
          }}
        />
      </Row>
    );
  },
};
