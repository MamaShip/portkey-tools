// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 第一步：选平台 → 看说明 → 填表单读数据。
import { useRef, useState } from "react";
import { PLATFORMS } from "../platforms";
import {
  GROUPS,
  type LoadedData,
  type Platform,
  type Privacy,
  type Run,
} from "../platforms/types";
import { rich } from "./Rich";

function privacyText(p: Privacy) {
  if (p.kind === "local") return "文件只在你的浏览器里读取和计算，不会上传。";
  if (p.kind === "direct") {
    return `请求从你的浏览器直接发往 ${p.host}，token 只在本页面里使用，不经过本站、不保存。`;
  }
  return `只读取公开数据：请求经本站服务器转发给 ${p.host}，不需要登录。`;
}

export function PlatformPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="keyin-picker" role="radiogroup" aria-label="数据来源">
      {GROUPS.map((g) => {
        const items = PLATFORMS.filter((p) => p.group === g.id);
        if (!items.length) return null;
        return (
          <div key={g.id} className="keyin-group">
            <span className="keyin-group-name">{g.name}</span>
            <div className="keyin-chips">
              {items.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={p.id === value}
                  className="keyin-chip"
                  title={p.blurb}
                  onClick={() => onChange(p.id)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GuideBox({ platform }: { platform: Platform }) {
  const { guide } = platform;
  return (
    <div className="keyin-guide">
      <h3>
        {platform.name}
        <small>{platform.blurb}</small>
      </h3>
      <ol>
        {guide.steps.map((s, i) => (
          <li key={i}>{rich(s)}</li>
        ))}
      </ol>
      <p>
        <strong>统计：</strong>
        {rich(guide.measures)}
      </p>
      <p className="keyin-privacy">
        <strong>隐私：</strong>
        {privacyText(guide.privacy)}
      </p>
      {guide.tips && (
        <ul className="keyin-tips">
          {guide.tips.map((t, i) => (
            <li key={i}>{rich(t)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 说明 + 表单 + 读取状态。换平台时由外层用 key 重建，表单状态随之清空 */
export function PlatformPanel({
  platform,
  onLoaded,
}: {
  platform: Platform;
  onLoaded: (data: LoadedData | null) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  // 只认最后一次读取的结果（例如连续切换统计方式时）
  const run: Run = (what, task) => {
    const id = ++latest.current;
    setBusy(what);
    setError(null);
    task().then(
      (data) => {
        if (id !== latest.current) return;
        setBusy(null);
        onLoaded(data);
      },
      (e: unknown) => {
        if (id !== latest.current) return;
        setBusy(null);
        setError(e instanceof Error ? e.message : String(e));
        onLoaded(null);
      },
    );
  };

  const { Form } = platform;
  return (
    <div className="keyin-data">
      <GuideBox platform={platform} />
      <Form run={run} />
      {busy && (
        <p className="keyin-status" role="status">
          {busy}
        </p>
      )}
      {error && (
        <p className="keyin-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
