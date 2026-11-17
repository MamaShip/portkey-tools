// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// Cloudflare Pages Function：GET /api/keyin/leetcode?user=<name>&year=<YYYY>&site=com|cn
// 代为读取 LeetCode / 力扣公开个人主页上的提交日历（不允许浏览器跨域），并在边缘缓存。
// 不碰任何密钥。实现在 keyin 工具目录里，便于单测。
import { handleLeetCodeRequest } from "../../../src/tools/keyin/sources/leetcode";

export const onRequestGet = ({ request }: { request: Request }) => {
  const edge = (globalThis.caches as unknown as { default?: Cache } | undefined)
    ?.default;
  return handleLeetCodeRequest(request, fetch, edge);
};
