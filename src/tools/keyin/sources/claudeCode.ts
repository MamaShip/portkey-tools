// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Li Song (keyin)
//
// Claude Code 的 token 用量，读本地会话日志。移植自 keyin/sources/claude_code.py。
// Claude Code 在 ~/.claude/projects 下为每个会话写一个 JSONL 文件，每条助手回复都带
// API 的 usage。一次回复拆成多个内容块时，会以相同的 message id 和 request id
// 记多次，所以要去重。全部在浏览器里处理，不上传。

import { addTo, localDay, type DailyValues } from "./daily";

export const CLAUDE_METRICS = {
  total: "全部 token（含缓存读取）",
  fresh: "不含缓存读取的 token",
  output: "只算输出 token",
  messages: "回复次数",
} as const;
export type ClaudeMetric = keyof typeof CLAUDE_METRICS;

const FIELDS: Record<ClaudeMetric, readonly string[]> = {
  total: [
    "input_tokens",
    "cache_creation_input_tokens",
    "cache_read_input_tokens",
    "output_tokens",
  ],
  fresh: ["input_tokens", "cache_creation_input_tokens", "output_tokens"],
  output: ["output_tokens"],
  messages: [],
};

export interface ClaudeUsage {
  timestamp: string;
  usage: Record<string, unknown>;
}

/** 逐行解析一个 JSONL 文件，按 (message id, request id) 去重 */
export function* usageEntries(
  text: string,
  seen: Set<string>,
): Generator<ClaudeUsage> {
  for (const line of text.split("\n")) {
    if (!line.includes('"usage"')) continue; // 快速跳过大多数行
    let entry: {
      type?: string;
      timestamp?: string;
      requestId?: string;
      message?: { id?: string; usage?: Record<string, unknown> };
    };
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const usage = entry.message?.usage;
    if (
      entry.type !== "assistant" ||
      !usage ||
      typeof usage !== "object" ||
      !entry.timestamp
    ) {
      continue;
    }
    const id = entry.message?.id;
    if (id !== undefined || entry.requestId !== undefined) {
      const key = `${id}\u0000${entry.requestId}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    yield { timestamp: entry.timestamp, usage };
  }
}

export function usageValue(
  usage: Record<string, unknown>,
  metric: ClaudeMetric,
) {
  const fields = FIELDS[metric];
  if (!fields.length) return 1;
  return fields.reduce((s, k) => s + (Number(usage[k]) || 0), 0);
}

export interface ClaudeResult {
  values: DailyValues;
  responses: number;
  files: number;
}

/** 文件夹里所有 .jsonl 文件 → 每日数值 */
export async function loadClaudeCode(
  files: Iterable<File>,
  metric: ClaudeMetric,
  onProgress?: (done: number, total: number) => void,
): Promise<ClaudeResult> {
  const logs = [...files].filter((f) => f.name.endsWith(".jsonl"));
  const values: DailyValues = {};
  const seen = new Set<string>();
  let responses = 0;
  for (let i = 0; i < logs.length; i++) {
    const text = await logs[i].text();
    for (const { timestamp, usage } of usageEntries(text, seen)) {
      const d = new Date(timestamp);
      if (Number.isNaN(d.getTime())) continue;
      responses++;
      addTo(values, localDay(d), usageValue(usage, metric));
    }
    onProgress?.(i + 1, logs.length);
  }
  return { values, responses, files: logs.length };
}
