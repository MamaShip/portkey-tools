// SPDX-License-Identifier: MIT
// Copyright (c) 2021 yihong (GitHubPoster, https://github.com/yihong0618/GitHubPoster)
// Copyright (c) 2026 Li Song (keyin)
//
// 浏览器能直接调用的平台接口（都允许跨域访问）：请求从用户的浏览器直接发往平台，
// token 不经过本站。参考 GitHubPoster 的 from_github_issue / dota2 / neodb /
// todoist / notion 各 loader；Todoist 的旧接口（Sync v9）已停用，改用 v1。

import { addTo, localDay, type DailyValues } from "./daily";

async function getJson<T>(
  url: string,
  init: RequestInit,
  service: string,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error(`连不上 ${service}，请检查网络（部分平台在大陆需要代理）`);
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `${service} 拒绝了请求（HTTP ${res.status}），请检查 token 是否正确、是否有权限`,
    );
  }
  if (res.status === 404)
    throw new Error(`${service} 上找不到这个对象（HTTP 404）`);
  if (res.status === 429)
    throw new Error(`${service} 说请求太频繁了，请过一会儿再试`);
  if (!res.ok) throw new Error(`${service} 返回 HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

const dayOfIso = (iso: string | null | undefined) => {
  if (!iso) return null;
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? null : localDay(t);
};

// --- GitHub Issue 打卡 -----------------------------------------------------

export type IssueMetric = "number" | "count";

/** 「owner/repo」或仓库网址 → owner/repo；认不出时为 null */
export function parseRepo(text: string): string | null {
  const m =
    /(?:github\.com\/)?([A-Za-z0-9-]+\/[A-Za-z0-9._-]+?)(?:\.git)?\/?$/.exec(
      text.trim(),
    );
  return m ? m[1] : null;
}

/** 评论第一行是数字就取这个数（GitHubPoster 的约定），否则为 0 */
export function firstLineNumber(body: string | null | undefined) {
  const n = Number((body ?? "").split(/\r?\n/)[0].trim());
  return Number.isFinite(n) ? n : 0;
}

export async function fetchIssueComments(
  repo: string,
  issue: number,
  metric: IssueMetric,
  token = "",
): Promise<DailyValues> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
  };
  if (token) headers.authorization = `Bearer ${token}`;
  const values: DailyValues = {};
  for (let page = 1; page <= 100; page++) {
    const url = `https://api.github.com/repos/${repo}/issues/${issue}/comments?per_page=100&page=${page}`;
    const comments = await getJson<{ created_at: string; body?: string }[]>(
      url,
      { headers },
      "GitHub",
    );
    for (const c of comments) {
      const day = dayOfIso(c.created_at);
      if (day)
        addTo(values, day, metric === "count" ? 1 : firstLineNumber(c.body));
    }
    if (comments.length < 100) break;
  }
  return values;
}

// --- Dota 2（OpenDota） ----------------------------------------------------

const STEAM64_BASE = 76561197960265728n;

/** 接受 32 位的 Dota 2 好友 ID，也接受 64 位 Steam ID；认不出时为 null */
export function dotaAccountId(text: string): string | null {
  const t = text.trim();
  if (!/^\d{1,20}$/.test(t)) return null;
  const n = BigInt(t);
  return (n > STEAM64_BASE ? n - STEAM64_BASE : n).toString();
}

export async function fetchDota2(accountId: string): Promise<DailyValues> {
  const matches = await getJson<{ start_time: number }[]>(
    `https://api.opendota.com/api/players/${accountId}/matches`,
    {},
    "OpenDota",
  );
  const values: DailyValues = {};
  for (const m of matches)
    addTo(values, localDay(new Date(m.start_time * 1000)), 1);
  return values;
}

// --- NeoDB ----------------------------------------------------------------

export const NEODB_SHELVES = {
  complete: "看过 / 读过 / 听过",
  progress: "在看 / 在读",
  wishlist: "想看 / 想读",
  dropped: "不看了",
  all: "全部标记",
} as const;
export type NeoDbShelf = keyof typeof NEODB_SHELVES;

export async function fetchNeoDb(
  token: string,
  shelf: NeoDbShelf,
  host = "neodb.social",
): Promise<DailyValues> {
  const base = `https://${host.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  const shelves =
    shelf === "all"
      ? (["complete", "progress", "wishlist", "dropped"] as const)
      : [shelf];
  const values: DailyValues = {};
  for (const s of shelves) {
    for (let page = 1; page <= 500; page++) {
      const body = await getJson<{
        data?: { created_time?: string }[];
        pages?: number;
      }>(
        `${base}/api/me/shelf/${s}?page=${page}`,
        { headers: { authorization: `Bearer ${token}` } },
        "NeoDB",
      );
      for (const mark of body.data ?? []) {
        const day = dayOfIso(mark.created_time);
        if (day) addTo(values, day, 1);
      }
      if (page >= (body.pages ?? 1)) break;
    }
  }
  return values;
}

// --- Todoist --------------------------------------------------------------

/** 一年里每天完成的任务数。接口一次最多查 3 个月，所以按季度分段 */
export async function fetchTodoist(
  token: string,
  year: number,
  onProgress?: (done: number) => void,
): Promise<DailyValues> {
  const values: DailyValues = {};
  let done = 0;
  for (let q = 0; q < 4; q++) {
    const since = new Date(year, q * 3, 1).toISOString();
    const until = new Date(year, q * 3 + 3, 1).toISOString();
    let cursor: string | null = null;
    do {
      const params = new URLSearchParams({ since, until, limit: "50" });
      if (cursor) params.set("cursor", cursor);
      const body: {
        items?: { completed_at?: string | null }[];
        next_cursor?: string | null;
      } = await getJson(
        `https://api.todoist.com/api/v1/tasks/completed/by_completion_date?${params}`,
        { headers: { authorization: `Bearer ${token}` } },
        "Todoist",
      );
      for (const item of body.items ?? []) {
        const day = dayOfIso(item.completed_at);
        if (day) addTo(values, day, 1);
      }
      done += body.items?.length ?? 0;
      onProgress?.(done);
      cursor = body.next_cursor ?? null;
    } while (cursor);
  }
  return values;
}

// --- Notion ---------------------------------------------------------------

/** 数据库网址或 ID → 32 位 ID；认不出时为 null */
export function notionDatabaseId(text: string): string | null {
  const t = text.trim();
  // 带连字符的 UUID 写法
  const uuid =
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.exec(t);
  if (uuid) return uuid[0].replace(/-/g, "").toLowerCase();
  // 网址：ID 在路径最后一段的末尾（前面可能是标题，如 My-DB-<id>，标题里也可能有 a-f 字母）
  const last = t.split(/[?#]/)[0].replace(/\/+$/, "").split("/").pop() ?? "";
  const id =
    /(?:^|[^0-9a-f])([0-9a-f]{32})$/i.exec(last) ??
    /^([0-9a-f]{32})$/i.exec(last);
  return id ? id[1].toLowerCase() : null;
}

interface NotionPage {
  created_time?: string;
  properties?: Record<
    string,
    { type?: string; date?: { start?: string } | null }
  >;
}

/**
 * 数据库里每条记录算一次，日期取 dateProperty 这一列；不填时用第一个有值的日期列，
 * 都没有就用创建时间。返回值里带上实际用的是哪一列。
 */
export async function fetchNotion(
  token: string,
  databaseId: string,
  dateProperty = "",
): Promise<{ values: DailyValues; used: string; rows: number }> {
  const values: DailyValues = {};
  let used = dateProperty || "";
  let rows = 0;
  let cursor: string | undefined;
  for (let i = 0; i < 1000; i++) {
    const body: {
      results?: NotionPage[];
      has_more?: boolean;
      next_cursor?: string | null;
    } = await getJson(
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "notion-version": "2022-06-28",
          "content-type": "application/json",
        },
        body: JSON.stringify(
          cursor
            ? { page_size: 100, start_cursor: cursor }
            : { page_size: 100 },
        ),
      },
      "Notion",
    );
    for (const page of body.results ?? []) {
      const props = page.properties ?? {};
      if (!used) {
        used =
          Object.entries(props).find(
            ([, p]) => p?.type === "date" && p.date?.start,
          )?.[0] ?? "（创建时间）";
      }
      if (dateProperty && !(dateProperty in props)) {
        throw new Error(`数据库里没有叫「${dateProperty}」的列`);
      }
      const start =
        used === "（创建时间）" ? page.created_time : props[used]?.date?.start;
      const day =
        start && /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : dayOfIso(start);
      if (day) {
        addTo(values, day, 1);
        rows++;
      }
    }
    if (!body.has_more || !body.next_cursor) break;
    cursor = body.next_cursor;
  }
  return { values, used, rows };
}
