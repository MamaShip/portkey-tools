// SPDX-License-Identifier: MIT
// Copyright (c) 2021 yihong (GitHubPoster, https://github.com/yihong0618/GitHubPoster)
// Copyright (c) 2026 MamaShip
//
// Google Takeout 导出：YouTube 观看记录、Google Keep 笔记。
// 移植自 GitHubPoster 的 youtube_loader.py、googlekeep_loader.py。

import { addTo, localDay, type DailyValues } from "./daily";

function parseJson(text: string, what: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    if (/^\s*</.test(text)) {
      throw new Error(
        `这是 HTML 格式的${what}。导出时请把格式改成 JSON（见上面的步骤）`,
      );
    }
    throw new Error("这不是有效的 JSON 文件");
  }
}

interface WatchEntry {
  time?: string;
  details?: { name?: string }[];
}

/** watch-history.json → 每天看过的视频数（不算广告） */
export function parseYouTubeHistory(text: string): DailyValues {
  const entries = parseJson(text, "观看记录");
  if (!Array.isArray(entries))
    throw new Error("没认出格式：watch-history.json 应该是一个列表");
  const values: DailyValues = {};
  for (const e of entries as WatchEntry[]) {
    if (!e?.time) continue;
    // Takeout 也会把看过的广告记进来
    if (e.details?.some((d) => d?.name === "From Google Ads")) continue;
    const t = new Date(e.time);
    if (!Number.isNaN(t.getTime())) addTo(values, localDay(t), 1);
  }
  return values;
}

interface KeepNote {
  createdTimestampUsec?: number;
  userEditedTimestampUsec?: number;
  isTrashed?: boolean;
}

/** Keep 文件夹里每条笔记一个 .json → 每天新建的笔记数（不算回收站里的） */
export async function loadKeep(files: Iterable<File>) {
  const values: DailyValues = {};
  let notes = 0;
  for (const f of files) {
    if (!f.name.endsWith(".json")) continue;
    let note: KeepNote;
    try {
      note = JSON.parse(await f.text());
    } catch {
      continue;
    }
    if (!note || typeof note !== "object" || note.isTrashed) continue;
    const usec = note.createdTimestampUsec ?? note.userEditedTimestampUsec;
    if (!usec) continue;
    notes++;
    addTo(values, localDay(new Date(usec / 1000)), 1);
  }
  return { values, notes };
}
