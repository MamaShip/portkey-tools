// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
import { useState } from "react";
import { fetchNeoDb, NEODB_SHELVES, type NeoDbShelf } from "../sources/apis";
import { FormRow, SelectField, SubmitButton, TextField } from "./fields";
import type { Platform } from "./types";

const SHELVES = Object.entries(NEODB_SHELVES) as [NeoDbShelf, string][];

export const neodb: Platform = {
  id: "neodb",
  name: "NeoDB",
  blurb: "书影音游戏的标记",
  group: "media",
  guide: {
    steps: [
      "登录 NeoDB，打开 [开发者页面](https://neodb.social/developer)，点生成 token（Access Token），复制下来。",
      "把 token 粘贴到下面，选要统计的标记（默认是「看过 / 读过 / 听过」）。",
      "如果你用的不是 neodb.social，而是其他 NeoDB 实例，把站点改成你的实例域名（token 也要在那个实例上生成）。",
    ],
    measures: "每天标记的条目数（按标记时间）。",
    privacy: { kind: "direct", host: "neodb.social" },
    tips: [
      "token 只在你的浏览器里使用，不会保存，也不经过本站。用完可以在开发者页面撤销。",
    ],
  },
  Form({ run }) {
    const [token, setToken] = useState("");
    const [shelf, setShelf] = useState<NeoDbShelf>("complete");
    const [host, setHost] = useState("neodb.social");
    const valid = token.trim().length > 10 && host.trim().length > 3;
    return (
      <FormRow
        onSubmit={() =>
          valid &&
          run("正在读取 NeoDB 标记…", async () => ({
            values: await fetchNeoDb(token.trim(), shelf, host.trim()),
            label: "NeoDB",
            unit: "条",
            scale: "linear",
          }))
        }
      >
        <TextField label="token" value={token} onChange={setToken} secret />
        <SelectField
          label="标记"
          value={shelf}
          options={SHELVES}
          onChange={setShelf}
        />
        <TextField label="站点" value={host} onChange={setHost} grow={false} />
        <SubmitButton disabled={!valid} />
      </FormRow>
    );
  },
};
