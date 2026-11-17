// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// Cloudflare Pages Function：GET /api/keyin/github?user=<name>&year=<YYYY>
// 代为读取 GitHub 公开的贡献日历（github.com 不允许浏览器跨域读取），解析成
// {user, year, days} 返回，并在边缘缓存。实现在 keyin 工具目录里，便于单测。
//
// 环境变量 GITHUB_TOKEN（在 Cloudflare Pages 的设置里配置为加密变量）：一个不带任何
// 权限的 GitHub token，只用来走官方 GraphQL 接口读公开数据。没有配置时退回抓个人主页，
// 但 Cloudflare 的共享出口 IP 经常被 GitHub 限流（HTTP 429）。见 docs/keyin.md。
import { handleGithubRequest } from "../../../src/tools/keyin/sources/github";

interface Env {
  GITHUB_TOKEN?: string;
}

export const onRequestGet = ({
  request,
  env,
}: {
  request: Request;
  env: Env;
}) => {
  // Workers 运行时里的默认缓存；类型定义里没有 caches.default，这里收窄一下
  const edge = (globalThis.caches as unknown as { default?: Cache } | undefined)
    ?.default;
  return handleGithubRequest(
    request,
    fetch,
    edge,
    new Date(),
    env.GITHUB_TOKEN ?? "",
  );
};
