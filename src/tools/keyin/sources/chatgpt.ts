// SPDX-License-Identifier: MIT
// Copyright (c) 2021 yihong (GitHubPoster, https://github.com/yihong0618/GitHubPoster)
// Copyright (c) 2026 MamaShip
//
// ChatGPT 官方数据导出里的 conversations.json。导出文件里没有 token 数，
// 所以统计你每天发出的消息数。移植自 GitHubPoster 的 chatgpt_loader.py。

import { addTo, localDay, type DailyValues } from "./daily";

interface Conversation {
  mapping?: Record<
    string,
    {
      message?: {
        author?: { role?: string };
        create_time?: number | null;
      } | null;
    } | null
  >;
}

export function parseChatGpt(text: string): DailyValues {
  let conversations: unknown;
  try {
    conversations = JSON.parse(text);
  } catch {
    throw new Error("这不是有效的 JSON 文件");
  }
  if (!Array.isArray(conversations)) {
    throw new Error("没认出格式：conversations.json 应该是一个对话列表");
  }
  const values: DailyValues = {};
  for (const c of conversations as Conversation[]) {
    for (const node of Object.values(c?.mapping ?? {})) {
      const m = node?.message;
      if (m?.author?.role !== "user" || !m.create_time) continue;
      addTo(values, localDay(new Date(m.create_time * 1000)), 1);
    }
  }
  return values;
}
