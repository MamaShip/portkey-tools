// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 驱动模型 worker：输入一变就（防抖后）重新生成，只保留最新一次的结果。
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
  const [state, setState] = useState<BuildState>({ kind: "idle" });
  const worker = useRef<Worker | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    const w = new Worker(new URL("../worker.ts", import.meta.url), {
      type: "module",
    });
    w.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const msg = e.data;
      if (msg.id !== latest.current) return; // 旧请求的结果，丢掉
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
    w.onerror = () =>
      setState({
        kind: "error",
        message: "模型生成器加载失败，请刷新页面重试",
      });
    worker.current = w;
    return () => w.terminate();
  }, []);

  useEffect(() => {
    if (!input) return;
    const id = ++latest.current;
    const timer = setTimeout(() => {
      setState((s) => (s.kind === "building" ? s : { kind: "building" }));
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

  return input ? state : { kind: "idle" };
}
