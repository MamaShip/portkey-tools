// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 在 Web Worker 里生成模型，页面不卡。消息协议见 protocol.ts。
import { binaryStl } from "./model/mesh";
import { buildSkyline } from "./model/skyline";
import type { BuildRequest, WorkerMessage } from "./protocol";
import notoUrl from "./text/fonts/NotoSans-Medium.ttf?url";
import { setBundledFontUrl } from "./text/fonts";

setBundledFontUrl(notoUrl);

// 文字模块（含 HarfBuzz 的 wasm）按需加载：加载失败时能作为普通错误报给页面，
// 而不是让整个 worker 起不来、页面一直停在「正在生成」
let shape: Promise<typeof import("./text/shape")> | undefined;
const loadShape = () => {
  shape ??= import("./text/shape");
  shape.catch(() => (shape = undefined));
  return shape;
};

const post = (msg: WorkerMessage, transfer: Transferable[] = []) =>
  (self as unknown as Worker).postMessage(msg, transfer);

self.onmessage = async (event: MessageEvent<BuildRequest>) => {
  const { id, input, lang, uiLang } = event.data;
  const warnings: string[] = [];
  try {
    const { renderTextMask } = await loadShape().catch(() => {
      throw new Error("文字排版组件加载失败，请检查网络后刷新页面");
    });
    const positions = await buildSkyline(
      input,
      async (text, lineHeight, ppm) => {
        const r = await renderTextMask(text, lineHeight, ppm, {
          lang,
          uiLang,
          onProgress: (p) => post({ type: "font", id, ...p }),
        });
        warnings.push(...r.warnings);
        return r.mask ? { mask: r.mask, mmPerPx: r.mmPerPx } : null;
      },
    );
    const stl = binaryStl(positions);
    post(
      {
        type: "done",
        id,
        positions,
        stl,
        triangles: positions.length / 9,
        warnings: [...new Set(warnings)],
      },
      [positions.buffer, stl],
    );
  } catch (e) {
    post({
      type: "error",
      id,
      message: e instanceof Error ? e.message : String(e),
    });
  }
};
