// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// 平台登记表：选择器按这里的顺序、按分组显示。新增平台：写 platforms/<id>.tsx，在这里加一行。
import { appleHealth } from "./appleHealth";
import { autosleep } from "./autosleep";
import { chatgpt } from "./chatgpt";
import { claudeCode } from "./claudeCode";
import { custom } from "./custom";
import { dota2 } from "./dota2";
import { github } from "./github";
import { githubIssue } from "./githubIssue";
import { googleKeep } from "./googleKeep";
import { gpx } from "./gpx";
import { leetcode } from "./leetcode";
import { neodb } from "./neodb";
import { notion } from "./notion";
import { strava } from "./strava";
import { todoist } from "./todoist";
import type { Platform } from "./types";
import { wakatime } from "./wakatime";
import { youtube } from "./youtube";

export const PLATFORMS: readonly Platform[] = [
  github,
  leetcode,
  githubIssue,
  wakatime,
  claudeCode,
  chatgpt,
  appleHealth,
  strava,
  gpx,
  autosleep,
  youtube,
  neodb,
  notion,
  todoist,
  googleKeep,
  dota2,
  custom,
];

export const platformById = (id: string) => PLATFORMS.find((p) => p.id === id);
