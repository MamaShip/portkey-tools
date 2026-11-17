// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 一个平台 = 一个 platforms/<id>.tsx：说明（怎么拿数据、统计什么、隐私）+ 输入表单。
// 解析与请求逻辑放在 sources/ 里的纯函数里，便于单测。新增平台：写一个文件，
// 在 platforms/index.ts 登记。
import type { ComponentType } from "react";
import type { Scale } from "../model/skyline";
import type { DailyValues } from "../sources/daily";

export type GroupId =
  | "code"
  | "ai"
  | "sport"
  | "media"
  | "notes"
  | "game"
  | "other";

export const GROUPS: { id: GroupId; name: string }[] = [
  { id: "code", name: "编程" },
  { id: "ai", name: "AI" },
  { id: "sport", name: "运动与健康" },
  { id: "media", name: "影音与阅读" },
  { id: "notes", name: "笔记与任务" },
  { id: "game", name: "游戏" },
  { id: "other", name: "通用" },
];

/** 数据去了哪里 */
export type Privacy =
  | { kind: "local" } // 文件只在浏览器里读
  | { kind: "direct"; host: string } // 浏览器直接请求平台，token 不经过本站
  | { kind: "proxy"; host: string }; // 公开数据，经本站服务器转发

export interface Guide {
  /** 拿到数据的步骤；支持 [文字](链接)、`代码`、**加粗** */
  steps: string[];
  /** 每根柱子代表什么 */
  measures: string;
  privacy: Privacy;
  /** 照着就能做的例子，原样显示（保留换行） */
  examples?: { title: string; text: string }[];
  tips?: string[];
}

/** 一次读取的结果 */
export interface LoadedData {
  values: DailyValues;
  /** 印在底座左边的默认平台名 */
  label: string;
  /** 汇总里用的单位，如「次贡献」 */
  unit: string;
  scale: Scale;
  /** 按年请求的平台（GitHub 等）把年份带出来，年份就不再让用户另选 */
  year?: number;
  note?: string;
}

/** 表单调用它来读取数据：what 是读取期间显示的提示 */
export type Run = (what: string, task: () => Promise<LoadedData>) => void;

export interface PlatformFormProps {
  run: Run;
}

export interface Platform {
  id: string;
  name: string;
  /** 选择器里的一行小字 */
  blurb: string;
  group: GroupId;
  guide: Guide;
  Form: ComponentType<PlatformFormProps>;
}
