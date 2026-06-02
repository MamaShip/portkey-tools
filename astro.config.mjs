// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
import { defineConfig } from "astro/config";
import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  site: "https://tools.portkey.click",
  integrations: [react()],
  vite: {
    build: {
      rollupOptions: {
        output: {
          // 把地图工具的重依赖从单一 1.6MB 串行块里拆出来，按厂商分块：
          // ① HTTP/2 下并行下载（配合 Astro 注入的 modulepreload），缩短首屏 JS 墙钟时间；
          // ② 各块独立 hash，maplibre/react 跨部署与未来工具页可命中缓存，仅业务代码变更时重下。
          // 用函数形式（而非对象形式）：Astro 的 SSR 构建里这些依赖是 external，
          // 对象形式会因「external 模块不能进 manualChunks」报错；函数形式只按 id 字符串判定，安全。
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (id.includes("maplibre-gl")) return "maplibre";
            if (id.includes("@allmaps")) return "allmaps";
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id))
              return "react";
          },
        },
      },
    },
  },
});
