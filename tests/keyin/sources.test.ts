// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Li Song (keyin)
//
// 各数据源的解析，以及 GitHub 代理（Pages Function）的行为。
import { describe, expect, it } from "vitest";
import { parseChatGpt } from "../../src/tools/keyin/sources/chatgpt";
import {
  loadClaudeCode,
  usageEntries,
} from "../../src/tools/keyin/sources/claudeCode";
import {
  localDay,
  summarize,
  yearsOf,
} from "../../src/tools/keyin/sources/daily";
import {
  csvValues,
  dayOf,
  guessDateColumn,
  parseCsv,
  parseJsonValues,
} from "../../src/tools/keyin/sources/files";
import {
  handleGithubRequest,
  parseContributions,
} from "../../src/tools/keyin/sources/github";

const ts = (iso: string) => new Date(iso);

describe("Claude Code", () => {
  const usage = {
    input_tokens: 10,
    cache_creation_input_tokens: 5,
    cache_read_input_tokens: 100,
    output_tokens: 7,
  };
  const line = (id: string, req: string, at: string) =>
    JSON.stringify({
      type: "assistant",
      timestamp: at,
      requestId: req,
      message: { id, usage },
    });
  const log = [
    line("m1", "r1", "2025-03-01T10:00:00Z"),
    line("m1", "r1", "2025-03-01T10:00:01Z"), // 同一次回复拆成多块：只算一次
    line("m2", "r2", "2025-03-01T11:00:00Z"),
    JSON.stringify({
      type: "user",
      timestamp: "2025-03-01T10:00:00Z",
      message: { usage },
    }),
    "not json {",
  ].join("\n");

  it("按 message id + request id 去重，只看助手回复", () => {
    expect([...usageEntries(log, new Set())].length).toBe(2);
  });

  it("各种统计口径", async () => {
    const file = new File([log], "a.jsonl");
    const other = new File(["x"], "notes.txt");
    const day = localDay(ts("2025-03-01T10:00:00Z"));
    const total = await loadClaudeCode([file, other], "total");
    expect(total.files).toBe(1);
    expect(total.responses).toBe(2);
    expect(total.values[day]).toBe(2 * 122);
    expect((await loadClaudeCode([file], "fresh")).values[day]).toBe(2 * 22);
    expect((await loadClaudeCode([file], "output")).values[day]).toBe(14);
    expect((await loadClaudeCode([file], "messages")).values[day]).toBe(2);
  });
});

describe("ChatGPT", () => {
  it("只数用户发出的消息", () => {
    const t = Date.UTC(2025, 4, 2, 12) / 1000;
    const data = [
      {
        mapping: {
          a: { message: { author: { role: "user" }, create_time: t } },
          b: { message: { author: { role: "assistant" }, create_time: t } },
          c: { message: null },
          d: null,
        },
      },
    ];
    const values = parseChatGpt(JSON.stringify(data));
    expect(values).toEqual({ [localDay(new Date(t * 1000))]: 1 });
  });

  it("格式不对时给出能看懂的错误", () => {
    expect(() => parseChatGpt("{}")).toThrow(/对话列表/);
    expect(() => parseChatGpt("oops")).toThrow(/JSON/);
  });
});

describe("JSON / CSV", () => {
  it("日期格式", () => {
    expect(dayOf("2025-03-01")).toBe("2025-03-01");
    expect(dayOf(" 2025-03-01T08:00:00 ")).toBe("2025-03-01");
    expect(dayOf("2025-02-30")).toBeNull();
    expect(dayOf("03/01/2025")).toBeNull();
  });

  it("JSON：同一天的值累加，非日期报错", () => {
    expect(
      parseJsonValues(
        '{"2025-01-01": 3, "2025-01-01T09:00": 2, "2025-01-02": 0}',
      ),
    ).toEqual({
      "2025-01-01": 5,
    });
    expect(() => parseJsonValues('{"hello": 1}')).toThrow(/不是日期/);
    expect(() => parseJsonValues("[1,2]")).toThrow(/对象/);
  });

  it("CSV：引号、逗号、BOM、跳过坏行", () => {
    const text =
      String.fromCharCode(0xfeff) +
      'note,date,km\n"a, b",2025-01-01,"1,200"\nc,2025-01-01,3\nd,bad,1\n';
    const rows = parseCsv(text);
    expect(rows[0]).toEqual(["note", "date", "km"]);
    expect(rows[1]).toEqual(["a, b", "2025-01-01", "1,200"]);
    expect(guessDateColumn(rows)).toBe(1);
    expect(csvValues(rows, 1, 2)).toEqual({
      values: { "2025-01-01": 1203 },
      skipped: 1,
    });
    expect(csvValues(rows, 1, null).values).toEqual({ "2025-01-01": 2 });
  });

  it("年份与汇总", () => {
    const v = { "2024-12-31": 1, "2025-01-01": 2, "2025-06-01": 8 };
    expect(yearsOf(v)).toEqual([2025, 2024]);
    expect(summarize(v, 2025)).toEqual({
      activeDays: 2,
      total: 10,
      busiestDay: "2025-06-01",
      busiest: 8,
    });
  });
});

describe("GitHub", () => {
  const html = `
<table><tbody><tr>
<td data-date="2025-01-05" id="contribution-day-component-0-1" data-level="2"></td>
<td data-date="2025-01-06" id="contribution-day-component-1-1" data-level="0"></td>
<td tabindex="0" data-date="2025-01-07" id="contribution-day-component-2-1" data-level="4"></td>
</tr></tbody></table>
<tool-tip for="contribution-day-component-2-1" class="sr-only">1,204 contributions on January 7th.</tool-tip>
<tool-tip for="contribution-day-component-0-1">6 contributions on January 5th.</tool-tip>
<tool-tip for="contribution-day-component-1-1">No contributions on January 6th.</tool-tip>`;

  it("提示框按 id 对应，而不是按顺序", () => {
    expect(parseContributions(html)).toEqual({
      "2025-01-05": 6,
      "2025-01-07": 1204,
    });
  });

  const now = new Date("2026-11-17T00:00:00Z");
  const req = (q: string) =>
    new Request(`https://tools.example/api/keyin/github?${q}`);
  const upstream =
    (status: number, body = html) =>
    async () =>
      new Response(body, { status });

  it("代理：解析、缓存头、边缘缓存", async () => {
    const store = new Map<string, Response>();
    const cache = {
      match: async (k: RequestInfo | URL) =>
        store.get(String((k as Request).url))?.clone(),
      put: async (k: RequestInfo | URL, r: Response) =>
        void store.set(String((k as Request).url), r),
    };
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      return new Response(html);
    }) as unknown as typeof fetch;
    const res = await handleGithubRequest(
      req("user=Octo-Cat&year=2025"),
      fetchImpl,
      cache as unknown as Cache,
      now,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=86400");
    expect(await res.json()).toEqual({
      user: "Octo-Cat",
      year: 2025,
      days: { "2025-01-05": 6, "2025-01-07": 1204 },
    });
    await handleGithubRequest(
      req("user=octo-cat&year=2025"),
      fetchImpl,
      cache as unknown as Cache,
      now,
    );
    expect(calls).toBe(1); // 用户名大小写不同也命中缓存
  });

  it("代理：参数校验与上游错误", async () => {
    const f = upstream(200) as unknown as typeof fetch;
    expect(
      (await handleGithubRequest(req("user=-bad&year=2025"), f, undefined, now))
        .status,
    ).toBe(400);
    expect(
      (await handleGithubRequest(req("user=ok&year=2007"), f, undefined, now))
        .status,
    ).toBe(400);
    expect(
      (await handleGithubRequest(req("user=ok&year=2027"), f, undefined, now))
        .status,
    ).toBe(400);
    const missing = await handleGithubRequest(
      req("user=ghost&year=2025"),
      upstream(404) as unknown as typeof fetch,
      undefined,
      now,
    );
    expect(missing.status).toBe(404);
    expect((await missing.json()).error).toMatch(/ghost/);
    const down = await handleGithubRequest(
      req("user=ok&year=2026"),
      upstream(503) as unknown as typeof fetch,
      undefined,
      now,
    );
    expect(down.status).toBe(502);
  });
  it("没有 token 时被限流：给出能看懂的提示", async () => {
    const limited = await handleGithubRequest(
      req("user=ok&year=2026"),
      upstream(429) as unknown as typeof fetch,
      undefined,
      now,
    );
    expect(limited.status).toBe(503);
    expect((await limited.json()).error).toMatch(/限制/);
  });

  it("有 token 时走 GraphQL", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const calendar = {
      data: {
        user: {
          contributionsCollection: {
            contributionCalendar: {
              weeks: [
                {
                  contributionDays: [
                    { date: "2024-12-29", contributionCount: 9 },
                    { date: "2025-01-01", contributionCount: 0 },
                    { date: "2025-01-02", contributionCount: 4 },
                  ],
                },
              ],
            },
          },
        },
      },
    };
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(calendar));
    }) as unknown as typeof fetch;
    const res = await handleGithubRequest(
      req("user=octocat&year=2025"),
      fetchImpl,
      undefined,
      now,
      "tok",
    );
    expect(await res.json()).toEqual({
      user: "octocat",
      year: 2025,
      days: { "2025-01-02": 4 },
    });
    expect(calls[0].url).toBe("https://api.github.com/graphql");
    expect(calls[0].init.headers).toMatchObject({
      authorization: "bearer tok",
    });
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.variables).toEqual({
      login: "octocat",
      from: "2025-01-01T00:00:00Z",
      to: "2025-12-31T23:59:59Z",
    });
  });

  it("GraphQL：找不到用户、token 失效", async () => {
    const reply = (body: unknown, status = 200) =>
      (async () =>
        new Response(JSON.stringify(body), {
          status,
        })) as unknown as typeof fetch;
    const missing = await handleGithubRequest(
      req("user=ghost&year=2025"),
      reply({
        data: { user: null },
        errors: [{ type: "NOT_FOUND", message: "x" }],
      }),
      undefined,
      now,
      "tok",
    );
    expect(missing.status).toBe(404);
    const bad = await handleGithubRequest(
      req("user=ok&year=2025"),
      reply({ message: "Bad credentials" }, 401),
      undefined,
      now,
      "tok",
    );
    expect(bad.status).toBe(502);
    expect((await bad.json()).error).toMatch(/token/);
  });
});
