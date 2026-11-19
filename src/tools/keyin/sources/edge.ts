// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// Pages Function 共用的小工具：JSON 响应、边缘缓存，以及浏览器端调用本站接口。
import type { DailyValues } from "./daily";

export type CacheLike = Pick<Cache, "match" | "put">;

export function json(body: unknown, status: number, maxAge = 0) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": maxAge ? `public, max-age=${maxAge}` : "no-store",
    },
  });
}

/** 今年的数据缓存 1 小时，往年的缓存 1 天 */
export const maxAgeFor = (year: number, now: Date) =>
  year < now.getUTCFullYear() ? 86_400 : 3_600;

/** 有缓存就用缓存；没有就算出来，成功的结果放进缓存 */
export async function cached(
  cache: CacheLike | undefined,
  key: string,
  compute: () => Promise<Response>,
): Promise<Response> {
  const req = new Request(`https://keyin.cache/${key}`);
  const hit = await cache?.match(req);
  if (hit) return hit;
  const res = await compute();
  if (res.ok) await cache?.put(req, res.clone());
  return res;
}

/** 浏览器端：调用本站的 /api/keyin/... 接口 */
export async function fetchProxy(
  path: string,
  service: string,
): Promise<DailyValues> {
  let res: Response;
  try {
    res = await fetch(path);
  } catch {
    throw new Error(`连不上本站的 ${service} 转发服务，请检查网络`);
  }
  let body: { days?: DailyValues; error?: string } = {};
  try {
    body = await res.json();
  } catch {
    // 本地 `pnpm dev` 没有 Pages Function，会拿到 HTML 404
  }
  if (!res.ok || !body.days) {
    throw new Error(
      body.error ?? `${service} 数据获取失败（HTTP ${res.status}）`,
    );
  }
  return body.days;
}
