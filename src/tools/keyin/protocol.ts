// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 页面 ↔ 模型 worker 的消息格式。
import type { SkylineInput } from "./model/skyline";

export interface BuildRequest {
  id: number;
  input: SkylineInput;
  /** 用户指定的文字语言（决定汉字写法）；null = 自动 */
  lang: string | null;
  /** 浏览器界面语言 */
  uiLang: string | null;
}

export type WorkerMessage =
  | { type: "font"; id: number; font: string; loaded: number; total: number }
  | {
      type: "done";
      id: number;
      positions: Float32Array;
      stl: ArrayBuffer;
      triangles: number;
      warnings: string[];
    }
  | { type: "error"; id: number; message: string };
