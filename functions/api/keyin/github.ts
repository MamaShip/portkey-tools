// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// Cloudflare Pages Function：GET /api/keyin/github?user=<name>&year=<YYYY>
// 代为请求 GitHub 公开的贡献日历（github.com 不允许浏览器跨域读取），解析成
// {user, year, days} 返回，并在边缘缓存。不碰任何密钥。实现在 keyin 工具目录里，便于单测。
import { handleGithubRequest } from "../../../src/tools/keyin/sources/github";

export const onRequestGet = ({ request }: { request: Request }) => {
  // Workers 运行时里的默认缓存；类型定义里没有 caches.default，这里收窄一下
  const edge = (globalThis.caches as unknown as { default?: Cache } | undefined)
    ?.default;
  return handleGithubRequest(request, fetch, edge);
};
