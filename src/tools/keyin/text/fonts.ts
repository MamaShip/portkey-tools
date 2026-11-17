// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Li Song (keyin)
//
// 按需下载字体：先试 Wasabi 镜像，再试 GitHub 与 jsDelivr；下载后校验 sha256，
// 存进浏览器的 Cache Storage，下次直接用。Noto Sans 随站点一起发布，不走下载。

import type { CatalogFont } from "./catalog";

export class FontDownloadError extends Error {}

export interface FontProgress {
  font: string;
  loaded: number;
  total: number;
}
export type ProgressFn = (p: FontProgress) => void;
export type FontLoader = (
  font: CatalogFont,
  onProgress?: ProgressFn,
) => Promise<ArrayBuffer>;

const CACHE_NAME = "keyin-fonts-v1";

let bundledUrl: string | undefined;
let loader: FontLoader = download;
const pending = new Map<string, Promise<ArrayBuffer>>();

/** 内置字体（Noto Sans）的地址，由 worker 用 Vite 的 `?url` 导入后传进来 */
export function setBundledFontUrl(url: string) {
  bundledUrl = url;
}

/** 替换下载方式（单测里从本地文件读） */
export function setFontLoader(fn: FontLoader) {
  loader = fn;
  pending.clear();
}

/** 字体文件内容；同一个字体并发请求只下载一次 */
export function loadFontData(font: CatalogFont, onProgress?: ProgressFn) {
  let p = pending.get(font.id);
  if (!p) {
    p = loader(font, onProgress);
    pending.set(font.id, p);
    // 失败的不缓存，下次可以重试
    p.catch(() => pending.delete(font.id));
  }
  return p;
}

async function sha256(buf: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function openCache(): Promise<Cache | undefined> {
  try {
    return typeof caches === "undefined"
      ? undefined
      : await caches.open(CACHE_NAME);
  } catch {
    return undefined; // 隐私模式等情况下 Cache Storage 不可用：每次重新下载
  }
}

async function fetchWithProgress(
  url: string,
  font: CatalogFont,
  onProgress?: ProgressFn,
) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!res.body) return res.arrayBuffer();
  const total = Number(res.headers.get("content-length")) || font.size;
  const out = new Uint8Array(Math.max(total, font.size));
  const reader = res.body.getReader();
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (loaded + value.length > out.length) throw new Error("文件比预期大");
    out.set(value, loaded);
    loaded += value.length;
    onProgress?.({ font: font.name, loaded, total });
  }
  return out.buffer.slice(0, loaded);
}

async function download(
  font: CatalogFont,
  onProgress?: ProgressFn,
): Promise<ArrayBuffer> {
  if (font.bundled) {
    if (!bundledUrl) throw new FontDownloadError("内置字体地址未设置");
    const res = await fetch(bundledUrl);
    if (!res.ok)
      throw new FontDownloadError(`内置字体加载失败：HTTP ${res.status}`);
    return res.arrayBuffer();
  }
  const cache = await openCache();
  const key = font.urls[0];
  const hit = await cache?.match(key);
  if (hit) return hit.arrayBuffer();
  const errors: string[] = [];
  for (const url of font.urls) {
    try {
      const buf = await fetchWithProgress(url, font, onProgress);
      if ((await sha256(buf)) !== font.sha256)
        throw new Error("文件校验不通过");
      await cache?.put(key, new Response(buf)).catch(() => undefined);
      return buf;
    } catch (e) {
      errors.push(
        `${new URL(url).host}：${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  throw new FontDownloadError(
    `字体「${font.name}」下载失败（${errors.join("；")}）`,
  );
}
