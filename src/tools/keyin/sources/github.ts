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

const GRAPHQL_QUERY = `query ($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar { weeks { contributionDays { date contributionCount } } }
    }
  }
}`;

interface GraphQlCalendar {
  data?: {
    user?: {
      contributionsCollection?: {
        contributionCalendar?: {
          weeks?: {
            contributionDays?: { date: string; contributionCount: number }[];
          }[];
        };
      };
    } | null;
  } | null;
  errors?: { type?: string; message?: string }[];
}

/** GraphQL 的贡献日历 → 每日数值（只留当年、有贡献的日子） */
export function parseGraphQlCalendar(
  body: GraphQlCalendar,
  year: number,
): DailyValues {
  const values: DailyValues = {};
  const weeks =
    body.data?.user?.contributionsCollection?.contributionCalendar?.weeks ?? [];
  for (const w of weeks) {
    for (const d of w.contributionDays ?? []) {
      if (d.contributionCount > 0 && d.date.startsWith(`${year}-`)) {
        values[d.date] = d.contributionCount;
      }
    }
  }
  return values;
}

type Upstream = { days: DailyValues } | { error: string; status: number };

/** 有 token：走官方 GraphQL 接口（每小时 5000 次，不受共享 IP 限流影响） */
async function viaGraphQl(
  user: string,
  year: number,
  token: string,
  fetchImpl: typeof fetch,
): Promise<Upstream> {
  const res = await fetchImpl("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      authorization: `bearer ${token}`,
      "content-type": "application/json",
      "user-agent": "portkey-tools-keyin",
    },
    body: JSON.stringify({
      query: GRAPHQL_QUERY,
      variables: {
        login: user,
        from: `${year}-01-01T00:00:00Z`,
        to: `${year}-12-31T23:59:59Z`,
      },
    }),
  });
  if (res.status === 401) {
    return { error: "本站的 GitHub token 失效了，请联系站长", status: 502 };
  }
  if (!res.ok) return { error: `GitHub 返回 HTTP ${res.status}`, status: 502 };
  const body = (await res.json()) as GraphQlCalendar;
  if (!body.data?.user) {
    if (
      body.errors?.some((e) => e.type === "NOT_FOUND") ||
      body.data?.user === null
    ) {
      return { error: `找不到 GitHub 用户「${user}」`, status: 404 };
    }
    return {
      error: body.errors?.[0]?.message ?? "GitHub 没有返回数据",
      status: 502,
    };
  }
  return { days: parseGraphQlCalendar(body, year) };
}

/** 没有 token：抓公开个人主页的日历 HTML（Cloudflare 的共享出口 IP 容易被 GitHub 限流） */
async function viaHtml(
  user: string,
  year: number,
  fetchImpl: typeof fetch,
): Promise<Upstream> {
  const res = await fetchImpl(contributionsUrl(user, year), {
    headers: { "user-agent": "portkey-tools-keyin", accept: "text/html" },
  });
  if (res.status === 404)
    return { error: `找不到 GitHub 用户「${user}」`, status: 404 };
  if (res.status === 429) {
    return {
      error: "GitHub 暂时限制了本站的访问，请过几分钟再试",
      status: 503,
    };
  }
  if (!res.ok) return { error: `GitHub 返回 HTTP ${res.status}`, status: 502 };
  return { days: parseContributions(await res.text()) };
}

/**
 * Pages Function 的实现（放在这里是为了能单测）：GET ?user=&year= →
 * {user, year, days}。配置了 token（Pages 环境变量 GITHUB_TOKEN）时用 GraphQL，
 * 否则抓个人主页。结果在边缘缓存一小时（往年缓存一天）。
 */
export async function handleGithubRequest(
  request: Request,
  fetchImpl: typeof fetch = fetch,
  cache?: CacheLike,
  now = new Date(),
  token = "",
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
    let r: Upstream;
    try {
      r = token
        ? await viaGraphQl(user, year, token, fetchImpl)
        : await viaHtml(user, year, fetchImpl);
    } catch {
      return json({ error: "暂时连不上 GitHub，请稍后再试" }, 502);
    }
    if ("error" in r) return json({ error: r.error }, r.status);
    return json({ user, year, days: r.days }, 200, maxAgeFor(year, now));
  });
}
