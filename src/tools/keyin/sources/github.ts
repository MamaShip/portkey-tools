// SPDX-License-Identifier: MIT
// Copyright (c) 2021 yihong (GitHubPoster, https://github.com/yihong0618/GitHubPoster)
// Copyright (c) 2026 Li Song (keyin)
//
// GitHub 贡献，来自公开的贡献日历（不需要 token）。github.com 不允许浏览器跨域读取，
// 所以由本站的 Pages Function（functions/api/keyin/github.ts）代为请求并解析。

import type { DailyValues } from "./daily";
import { cached, fetchProxy, json, maxAgeFor, type CacheLike } from "./edge";

export const GITHUB_USER =
  /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
export const FIRST_GITHUB_YEAR = 2008;

const attr = (tag: string, name: string) =>
  new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? null;

/**
 * 每天是一个 <td id=... data-date=...>；数量写在另一个
 * <tool-tip for=...>"N contributions on ..."</tool-tip> 里，按 id 对应。
 */
export function parseContributions(html: string): DailyValues {
  const dates = new Map<string, string>();
  for (const [tag] of html.matchAll(/<td\b[^>]*>/g)) {
    const id = attr(tag, "id");
    const date = attr(tag, "data-date");
    if (id && date) dates.set(id, date);
  }
  const values: DailyValues = {};
  for (const m of html.matchAll(/<tool-tip\b([^>]*)>([^<]*)<\/tool-tip>/g)) {
    const id = attr(m[1], "for");
    const n = /^\s*([\d,]+)\s+contribution/.exec(m[2]);
    const date = id ? dates.get(id) : undefined;
    if (date && n) {
      const count = Number(n[1].replace(/,/g, ""));
      if (count) values[date] = count;
    }
  }
  return values;
}

export function contributionsUrl(user: string, year: number) {
  return `https://github.com/users/${user}/contributions?from=${year}-01-01&to=${year}-12-31`;
}

/** 浏览器端：经本站转发读取 */
export function fetchGithub(user: string, year: number): Promise<DailyValues> {
  const q = new URLSearchParams({ user, year: String(year) });
  return fetchProxy(`/api/keyin/github?${q}`, "GitHub");
}

/**
 * Pages Function 的实现（放在这里是为了能单测）：GET ?user=&year= →
 * {user, year, days}。结果在边缘缓存一小时（往年缓存一天）。
 */
export async function handleGithubRequest(
  request: Request,
  fetchImpl: typeof fetch = fetch,
  cache?: CacheLike,
  now = new Date(),
): Promise<Response> {
  const url = new URL(request.url);
  const user = url.searchParams.get("user") ?? "";
  const year = Number(url.searchParams.get("year"));
  if (!GITHUB_USER.test(user))
    return json({ error: "GitHub 用户名格式不对" }, 400);
  if (
    !Number.isInteger(year) ||
    year < FIRST_GITHUB_YEAR ||
    year > now.getUTCFullYear()
  ) {
    return json({ error: "年份不对" }, 400);
  }
  return cached(cache, `github/${user.toLowerCase()}/${year}`, async () => {
    let upstream: Response;
    try {
      upstream = await fetchImpl(contributionsUrl(user, year), {
        headers: { "user-agent": "portkey-tools-keyin", accept: "text/html" },
      });
    } catch {
      return json({ error: "暂时连不上 GitHub，请稍后再试" }, 502);
    }
    if (upstream.status === 404)
      return json({ error: `找不到 GitHub 用户「${user}」` }, 404);
    if (!upstream.ok)
      return json({ error: `GitHub 返回 HTTP ${upstream.status}` }, 502);
    const days = parseContributions(await upstream.text());
    return json({ user, year, days }, 200, maxAgeFor(year, now));
  });
}
