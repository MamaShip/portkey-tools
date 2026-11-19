// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 说明文字里的极简标记：[文字](https://链接)、`代码`、**加粗**。只认 http(s) 链接。
import type { ReactNode } from "react";

const TOKEN = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*/g;

export function rich(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (i > last) out.push(text.slice(last, i));
    if (m[1]) {
      out.push(
        <a key={i} href={m[2]} target="_blank" rel="noopener noreferrer">
          {m[1]}
        </a>,
      );
    } else if (m[3]) {
      out.push(<code key={i}>{m[3]}</code>);
    } else {
      out.push(<strong key={i}>{m[4]}</strong>);
    }
    last = i + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
