// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 驱动模型 worker：输入一变就（防抖后）重新生成，只保留最新一次的结果。
// 每个结果都记着它对应哪一份输入；输入一变，旧结果立刻不再返回（不会把示例模型当成新数据的模型下载）。
import { useEffect, useRef, useState } from "react";
import type { SkylineInput } from "../model/skyline";
import type { BuildRequest, WorkerMessage } from "../protocol";

export type BuildState =
  | { kind: "idle" }
  | { kind: "building"; font?: { name: string; loaded: number; total: number } }
  | {
      kind: "done";
      positions: Float32Array;
      stl: ArrayBuffer;
      triangles: number;
      warnings: string[];
    }
  | { kind: "error"; message: string };

export function useBuilder(
  input: SkylineInput | null,
  lang: string | null,
): BuildState {
  const [result, setResult] = useState<{
    for: SkylineInput | null;
    lang: string | null;
    state: BuildState;
  }>({ for: null, lang: null, state: { kind: "idle" } });
  const [broken, setBroken] = useState(false);
  const worker = useRef<Worker | null>(null);
  const latest = useRef(0);
  // 请求 id → 对应的输入
  const pending = useRef(new Map<number, [SkylineInput, string | null]>());

  useEffect(() => {
    const w = new Worker(new URL("../worker.ts", import.meta.url), {
      type: "module",
    });
    w.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const msg = e.data;
      const req = pending.current.get(msg.id);
      if (msg.id !== latest.current || !req) return; // 旧请求的结果，丢掉
      if (msg.type !== "font") pending.current.delete(msg.id);
      const setState = (state: BuildState) =>
        setResult({ for: req[0], lang: req[1], state });
      if (msg.type === "font") {
        setState({
          kind: "building",
          font: { name: msg.font, loaded: msg.loaded, total: msg.total },
        });
      } else if (msg.type === "done") {
        setState({
          kind: "done",
          positions: msg.positions,
          stl: msg.stl,
          triangles: msg.triangles,
          warnings: msg.warnings,
        });
      } else {
        setState({ kind: "error", message: msg.message });
      }
    };
    w.onerror = () => setBroken(true);
    worker.current = w;
    return () => w.terminate();
  }, []);

  useEffect(() => {
    if (!input) return;
    const id = ++latest.current;
    const timer = setTimeout(() => {
      pending.current.clear();
      pending.current.set(id, [input, lang]);
      const req: BuildRequest = {
        id,
        input,
        lang,
        uiLang: typeof navigator === "undefined" ? null : navigator.language,
      };
      worker.current?.postMessage(req);
    }, 300);
    return () => clearTimeout(timer);
  }, [input, lang]);

  if (!input) return { kind: "idle" };
  if (broken)
    return { kind: "error", message: "模型生成器加载失败，请刷新页面重试" };
  return result.for === input && result.lang === lang
    ? result.state
    : { kind: "building" };
}
