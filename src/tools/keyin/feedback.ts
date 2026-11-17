// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 跳到 GitHub 新建 issue 的链接。模板在 .github/ISSUE_TEMPLATE/keyin-*.yml；
// GitHub 的 issue 表单支持用 ?<字段 id>=<值> 预先填好字段。
export const REPO_URL = "https://github.com/MamaShip/portkey-tools";

/** 「刻印：问题反馈」，可预先填好平台和报错原文 */
export function keyinBugUrl(
  opts: { platform?: string; problem?: string } = {},
) {
  const q = new URLSearchParams({ template: "keyin-bug.yml" });
  if (opts.platform) q.set("platform", opts.platform);
  // 网址太长 GitHub 会拒绝，报错原文截短一些
  if (opts.problem) q.set("what-happened", opts.problem.slice(0, 600));
  return `${REPO_URL}/issues/new?${q}`;
}

/** 「刻印：想支持新的平台」 */
export const keyinPlatformUrl = `${REPO_URL}/issues/new?template=keyin-platform.yml`;
