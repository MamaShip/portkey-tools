// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Li Song (keyin)
//
// LeetCode 公开个人主页上的提交日历（不需要登录）。GitHubPoster 原来用登录 Cookie
// 翻提交记录；这里改用公开的 GraphQL 日历接口，只要用户名。LeetCode 不允许浏览器
// 跨域访问，所以由 functions/api/keyin/leetcode.ts 转发。

import type { DailyValues } from "./daily";
import { cached, fetchProxy, json, maxAgeFor, type CacheLike } from "./edge";

export type LeetCodeSite = "com" | "cn";
export const LEETCODE_USER = /^[A-Za-z0-9_-]{1,40}$/;
export const FIRST_LEETCODE_YEAR = 2014;

const ENDPOINT: Record<LeetCodeSite, string> = {
  com: "https://leetcode.com/graphql",
  cn: "https://leetcode.cn/graphql/noj-go/",
};

const QUERY: Record<LeetCodeSite, string> = {
  com: "query userProfileCalendar($username: String!, $year: Int) { matchedUser(username: $username) { userCalendar(year: $year) { submissionCalendar } } }",
  cn: "query userProfileCalendar($userSlug: String!, $year: Int) { userCalendar(userSlug: $userSlug, year: $year) { submissionCalendar } }",
};

/** submissionCalendar 是一段 JSON 字符串：{"<UTC 零点的秒数>": 提交次数} */
export function parseSubmissionCalendar(text: string): DailyValues {
  const raw = JSON.parse(text || "{}") as Record<string, number>;
  const values: DailyValues = {};
  for (const [ts, n] of Object.entries(raw)) {
    const day = new Date(Number(ts) * 1000).toISOString().slice(0, 10);
    if (n > 0) values[day] = (values[day] ?? 0) + Number(n);
  }
  return values;
}

export function fetchLeetCode(user: string, year: number, site: LeetCodeSite) {
  const q = new URLSearchParams({ user, year: String(year), site });
  return fetchProxy(`/api/keyin/leetcode?${q}`, "LeetCode");
}

interface CalendarResponse {
  data?: {
    matchedUser?: {
      userCalendar?: { submissionCalendar?: string } | null;
    } | null;
    userCalendar?: { submissionCalendar?: string } | null;
  };
}

/** Pages Function 的实现：GET ?user=&year=&site=com|cn → {user, year, days} */
export async function handleLeetCodeRequest(
  request: Request,
  fetchImpl: typeof fetch = fetch,
  cache?: CacheLike,
  now = new Date(),
): Promise<Response> {
  const url = new URL(request.url);
  const user = url.searchParams.get("user") ?? "";
  const year = Number(url.searchParams.get("year"));
  const site = url.searchParams.get("site") === "cn" ? "cn" : "com";
  if (!LEETCODE_USER.test(user))
    return json({ error: "LeetCode 用户名格式不对" }, 400);
  if (
    !Number.isInteger(year) ||
    year < FIRST_LEETCODE_YEAR ||
    year > now.getUTCFullYear()
  ) {
    return json({ error: "年份不对" }, 400);
  }
  return cached(
    cache,
    `leetcode/${site}/${user.toLowerCase()}/${year}`,
    async () => {
      const variables =
        site === "com" ? { username: user, year } : { userSlug: user, year };
      let body: CalendarResponse;
      try {
        const res = await fetchImpl(ENDPOINT[site], {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "user-agent": "portkey-tools-keyin",
            referer:
              site === "com" ? "https://leetcode.com/" : "https://leetcode.cn/",
          },
          body: JSON.stringify({ query: QUERY[site], variables }),
        });
        if (!res.ok)
          return json({ error: `LeetCode 返回 HTTP ${res.status}` }, 502);
        body = await res.json();
      } catch {
        return json({ error: "暂时连不上 LeetCode，请稍后再试" }, 502);
      }
      const calendar =
        site === "com"
          ? body.data?.matchedUser?.userCalendar
          : body.data?.userCalendar;
      if (!calendar || (site === "com" && !body.data?.matchedUser)) {
        const where =
          site === "cn" ? "力扣（leetcode.cn）" : "LeetCode（leetcode.com）";
        return json({ error: `在${where}上找不到用户「${user}」` }, 404);
      }
      const days = parseSubmissionCalendar(calendar.submissionCalendar ?? "{}");
      return json({ user, year, site, days }, 200, maxAgeFor(year, now));
    },
  );
}
