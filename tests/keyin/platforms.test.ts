// SPDX-License-Identifier: MIT
// Copyright (c) 2026 MamaShip
//
// 新增平台的解析与请求：文件格式、接口分页、LeetCode 转发。
import { afterEach, describe, expect, it, vi } from "vitest";
import { PLATFORMS } from "../../src/tools/keyin/platforms";
import { GROUPS } from "../../src/tools/keyin/platforms/types";
import {
  dotaAccountId,
  fetchIssueComments,
  fetchNeoDb,
  fetchNotion,
  fetchTodoist,
  firstLineNumber,
  notionDatabaseId,
  parseRepo,
} from "../../src/tools/keyin/sources/apis";
import { localDay } from "../../src/tools/keyin/sources/daily";
import {
  HealthParser,
  parseWakaTime,
} from "../../src/tools/keyin/sources/health";
import {
  handleLeetCodeRequest,
  parseSubmissionCalendar,
} from "../../src/tools/keyin/sources/leetcode";
import {
  loadGpx,
  parseAutoSleep,
  parseGpx,
  parseStravaCsv,
  parseStravaDate,
  stravaValues,
} from "../../src/tools/keyin/sources/sport";
import {
  loadKeep,
  parseYouTubeHistory,
} from "../../src/tools/keyin/sources/takeout";

const day = (iso: string) => localDay(new Date(iso));

describe("平台登记表", () => {
  it("id 不重复，每个平台都有分组、步骤和统计说明", () => {
    const ids = PLATFORMS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const groups = new Set(GROUPS.map((g) => g.id));
    for (const p of PLATFORMS) {
      expect(groups.has(p.group), p.id).toBe(true);
      expect(p.guide.steps.length, p.id).toBeGreaterThan(0);
      expect(p.guide.measures, p.id).not.toBe("");
    }
  });

  it("说明里的链接都是 https", () => {
    for (const p of PLATFORMS) {
      const text = [...p.guide.steps, ...(p.guide.tips ?? [])].join("\n");
      for (const m of text.matchAll(/\]\(([^)]+)\)/g))
        expect(m[1], p.id).toMatch(/^https:\/\//);
    }
  });
});

describe("Google Takeout", () => {
  it("YouTube：按天计数，不算广告；HTML 格式给出提示", () => {
    const history = [
      {
        header: "YouTube",
        title: "Watched a",
        time: "2025-01-02T03:00:00.000Z",
      },
      {
        header: "YouTube Music",
        title: "Watched b",
        time: "2025-01-02T04:00:00Z",
      },
      {
        header: "YouTube",
        title: "Watched ad",
        time: "2025-01-02T05:00:00Z",
        details: [{ name: "From Google Ads" }],
      },
    ];
    expect(parseYouTubeHistory(JSON.stringify(history))).toEqual({
      [day("2025-01-02T03:00:00Z")]: 2,
    });
    expect(() => parseYouTubeHistory("<html><body></body></html>")).toThrow(
      /改成 JSON/,
    );
  });

  it("Keep：每条笔记一个 JSON，跳过回收站和其他文件", async () => {
    const note = (usec: number, trashed = false) =>
      new File(
        [
          JSON.stringify({
            createdTimestampUsec: usec,
            isTrashed: trashed,
            title: "x",
          }),
        ],
        "n.json",
      );
    const t = Date.UTC(2025, 5, 1, 12) * 1000;
    const r = await loadKeep([
      note(t),
      note(t),
      note(t, true),
      new File(["x"], "Labels.txt"),
    ]);
    expect(r.notes).toBe(2);
    expect(r.values).toEqual({ [localDay(new Date(t / 1000))]: 2 });
  });
});

describe("运动与睡眠", () => {
  const gpxText = `<?xml version="1.0"?><gpx><trk><trkseg>
    <trkpt lat="30.0" lon="104.0"><ele>500</ele><time>2025-04-01T00:30:00Z</time></trkpt>
    <trkpt lat="30.0" lon="104.01"><time>2025-04-01T00:35:00Z</time></trkpt>
    </trkseg><trkseg><trkpt lon="105.0" lat="31.0"/><trkpt lat="31.009" lon="105.0"/></trkseg></trk></gpx>`;

  it("GPX：各段分别算距离，开始时间取第一个点", () => {
    const r = parseGpx(gpxText)!;
    expect(r.start.toISOString()).toBe("2025-04-01T00:30:00.000Z");
    // 经度差 0.01°（北纬 30°）约 963 米 + 纬度差 0.009° 约 1001 米
    expect(r.meters).toBeGreaterThan(1950);
    expect(r.meters).toBeLessThan(1980);
    expect(parseGpx("<gpx></gpx>")).toBeNull();
  });

  it("GPX 文件夹：同一天相加，跳过坏文件", async () => {
    const r = await loadGpx([
      new File([gpxText], "a.gpx"),
      new File([gpxText], "b.GPX"),
      new File(["<gpx/>"], "c.gpx"),
      new File(["x"], "notes.txt"),
    ]);
    expect(r.tracks).toBe(2);
    expect(r.skipped).toBe(1);
    expect(r.values[day("2025-04-01T00:30:00Z")]).toBeCloseTo(3.93, 1);
  });

  it("Strava：英文日期、两列 Distance 取米那一列、按类型过滤", () => {
    expect(parseStravaDate("Mar 3, 2025, 6:00:00 PM")?.toISOString()).toBe(
      "2025-03-03T18:00:00.000Z",
    );
    expect(parseStravaDate("Mar 3, 2025, 12:05:00 AM")?.toISOString()).toBe(
      "2025-03-03T00:05:00.000Z",
    );
    expect(parseStravaDate("Dec 31, 2024, 12:00:00 PM")?.toISOString()).toBe(
      "2024-12-31T12:00:00.000Z",
    );
    const csv =
      "Activity ID,Activity Date,Activity Name,Activity Type,Elapsed Time,Distance,Moving Time,Distance\n" +
      '1,"Mar 3, 2025, 7:05:09 AM",Run,Run,1800,5.01,1700,5012.3\n' +
      '2,"Mar 3, 2025, 8:00:00 AM",Ride,Ride,3600,"1,020.5",3500,20480\n';
    const rows = parseStravaCsv(csv);
    expect(rows.map((r) => r.km)).toEqual([5.0123, 20.48]);
    const d = day("2025-03-03T07:05:09Z");
    expect(stravaValues(rows, "distance", "")).toEqual({ [d]: 25.49 });
    expect(stravaValues(rows, "count", "Run")).toEqual({ [d]: 1 });
    expect(stravaValues(rows, "time", "")).toEqual({ [d]: 1.5 });
    expect(() => parseStravaCsv("a,b\n1,2")).toThrow(/Activity Date/);
  });

  it("AutoSleep：中英文列名", () => {
    expect(
      parseAutoSleep(
        "ISO8601,asleep,efficiency\n2025-01-01T20:59:59+08:00,7:30:00,91\n",
      ),
    ).toEqual({
      "2025-01-01": 7.5,
    });
    expect(
      parseAutoSleep("ISO8601,睡眠时间\n2025-01-02T21:00:00+08:00,6:31:00\n"),
    ).toEqual({
      "2025-01-02": 6.5,
    });
    expect(() => parseAutoSleep("date,hours\n2025-01-01,7")).toThrow(/ISO8601/);
  });
});

describe("Apple 健康", () => {
  const xml = [
    '<Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" startDate="2025-02-01 08:00:00 +0800" value="1200"/>',
    '<Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" startDate="2025-02-01 18:00:00 +0800" value="800"/>',
    '<Record type="HKQuantityTypeIdentifierStepCount" sourceName="Apple Watch" unit="count" startDate="2025-02-01 08:00:00 +0800" value="2500">',
    '  <MetadataEntry key="x" value="y"/>',
    "</Record>",
    '<Record type="HKQuantityTypeIdentifierDistanceWalkingRunning" sourceName="iPhone" unit="mi" startDate="2025-02-01 09:00:00 +0800" value="1"/>',
    '<ActivitySummary dateComponents="2025-02-01" activeEnergyBurned="431.5" appleExerciseTime="31" appleStandHours="12"/>',
    '<ActivitySummary dateComponents="2025-02-02" activeEnergyBurned="0" appleExerciseTime="0" appleStandHours="0"/>',
  ].join("\n");

  // 把文本切成很小的块喂进去，确保标签被切开时也能正确拼接
  const feed = (metric: ConstructorParameters<typeof HealthParser>[0]) => {
    const p = new HealthParser(metric);
    for (let i = 0; i < xml.length; i += 37) p.push(xml.slice(i, i + 37));
    return p.result();
  };

  it("圆环三项读 ActivitySummary", () => {
    expect(feed("move")).toEqual({ "2025-02-01": 431.5 });
    expect(feed("exercise")).toEqual({ "2025-02-01": 31 });
    expect(feed("stand")).toEqual({ "2025-02-01": 12 });
  });

  it("步数按来源去重，距离换算成公里", () => {
    expect(feed("steps")).toEqual({ "2025-02-01": 2500 });
    expect(feed("distance")).toEqual({ "2025-02-01": 1.61 });
  });
});

describe("WakaTime", () => {
  it("导出格式与 summaries 格式", () => {
    expect(
      parseWakaTime(
        JSON.stringify({
          days: [
            { date: "2025-01-01", grand_total: { total_seconds: 5400 } },
            { date: "2025-01-02", grand_total: { total_seconds: 0 } },
          ],
        }),
      ),
    ).toEqual({ "2025-01-01": 1.5 });
    expect(
      parseWakaTime(
        JSON.stringify({
          data: [
            {
              range: { date: "2025-01-03" },
              grand_total: { total_seconds: 3600 },
            },
          ],
        }),
      ),
    ).toEqual({
      "2025-01-03": 1,
    });
    expect(() => parseWakaTime("{}")).toThrow(/days/);
  });
});

describe("输入格式", () => {
  it("仓库、Dota ID、Notion ID", () => {
    expect(parseRepo("yihong0618/2021")).toBe("yihong0618/2021");
    expect(parseRepo("https://github.com/yihong0618/2021/")).toBe(
      "yihong0618/2021",
    );
    expect(parseRepo("https://github.com/a/b.git")).toBe("a/b");
    expect(parseRepo("not a repo")).toBeNull();
    expect(firstLineNumber("12.5\n今天跑步")).toBe(12.5);
    expect(firstLineNumber("今天休息")).toBe(0);
    expect(dotaAccountId("70388657")).toBe("70388657");
    expect(dotaAccountId("76561198030654385")).toBe("70388657");
    expect(dotaAccountId("abc")).toBeNull();
    expect(
      notionDatabaseId(
        "https://www.notion.so/ws/My-DB-0123456789abcdef0123456789ABCDEF?v=1",
      ),
    ).toBe("0123456789abcdef0123456789abcdef");
    expect(notionDatabaseId("01234567-89ab-cdef-0123-456789abcdef")).toBe(
      "0123456789abcdef0123456789abcdef",
    );
    expect(notionDatabaseId("nope")).toBeNull();
  });
});

describe("浏览器直连的接口", () => {
  afterEach(() => vi.unstubAllGlobals());

  const respond = (
    handler: (url: string, init?: RequestInit) => unknown,
    status = 200,
  ) =>
    vi.fn(
      async (url: string, init?: RequestInit) =>
        new Response(JSON.stringify(handler(url, init)), { status }),
    );

  it("GitHub Issue：翻页、带 token、按第一行数字求和", async () => {
    const page1 = Array.from({ length: 100 }, () => ({
      created_at: "2025-01-01T01:00:00Z",
      body: "2\nok",
    }));
    const page2 = [{ created_at: "2025-01-02T01:00:00Z", body: "x" }];
    const f = respond((url) => (/[?&]page=1$/.test(url) ? page1 : page2));
    vi.stubGlobal("fetch", f);
    const v = await fetchIssueComments("a/b", 5, "number", "tok");
    expect(v).toEqual({ [day("2025-01-01T01:00:00Z")]: 200 });
    expect(f).toHaveBeenCalledTimes(2);
    expect((f.mock.calls[0][1] as RequestInit).headers).toMatchObject({
      authorization: "Bearer tok",
    });
  });

  it("NeoDB：按 pages 翻页，全部标记时依次读四个书架", async () => {
    const f = respond((url) => ({
      data: [{ created_time: "2025-02-01T10:00:00Z" }],
      pages: url.includes("complete") ? 2 : 1,
    }));
    vi.stubGlobal("fetch", f);
    const v = await fetchNeoDb("tok", "all", "https://neodb.social/");
    expect(f).toHaveBeenCalledTimes(5);
    expect(f.mock.calls[0][0]).toBe(
      "https://neodb.social/api/me/shelf/complete?page=1",
    );
    expect(v).toEqual({ [day("2025-02-01T10:00:00Z")]: 5 });
  });

  it("Todoist：按季度查询并跟着 cursor 翻页", async () => {
    const f = respond((url) =>
      url.includes("cursor=")
        ? {
            items: [{ completed_at: "2025-01-05T10:00:00Z" }],
            next_cursor: null,
          }
        : {
            items: [{ completed_at: "2025-01-05T09:00:00Z" }],
            next_cursor:
              url.includes("since=2025-01") || url.includes("since=2024-12")
                ? "a.b"
                : null,
          },
    );
    vi.stubGlobal("fetch", f);
    const v = await fetchTodoist("tok", 2025);
    expect(f).toHaveBeenCalledTimes(5);
    expect(v[day("2025-01-05T10:00:00Z")]).toBe(5);
  });

  it("Notion：自动找日期列，没有就用创建时间；指定了不存在的列会报错", async () => {
    const f = respond((_url, init) => {
      const body = JSON.parse(String(init?.body));
      return body.start_cursor
        ? {
            results: [
              {
                created_time: "2025-03-02T00:00:00Z",
                properties: {
                  日期: { type: "date", date: { start: "2025-03-03" } },
                },
              },
            ],
            has_more: false,
          }
        : {
            results: [
              {
                created_time: "2025-03-01T00:00:00Z",
                properties: {
                  名称: { type: "title" },
                  日期: {
                    type: "date",
                    date: { start: "2025-03-03T09:00:00+08:00" },
                  },
                },
              },
            ],
            has_more: true,
            next_cursor: "c",
          };
    });
    vi.stubGlobal("fetch", f);
    const r = await fetchNotion("tok", "0".repeat(32));
    expect(r.used).toBe("日期");
    expect(r.rows).toBe(2);
    expect(Object.values(r.values).reduce((a, b) => a + b, 0)).toBe(2);
    expect((f.mock.calls[0][1] as RequestInit).headers).toMatchObject({
      "notion-version": "2022-06-28",
    });
    await expect(fetchNotion("tok", "0".repeat(32), "不存在")).rejects.toThrow(
      /没有叫「不存在」的列/,
    );
  });

  it("401 时给出能看懂的提示", async () => {
    vi.stubGlobal(
      "fetch",
      respond(() => ({}), 401),
    );
    await expect(fetchNeoDb("bad", "complete")).rejects.toThrow(/token/);
  });
});

describe("LeetCode", () => {
  const now = new Date("2026-11-17T00:00:00Z");
  const req = (q: string) =>
    new Request(`https://tools.example/api/keyin/leetcode?${q}`);

  it("日历的键是 UTC 零点的秒数", () => {
    expect(
      parseSubmissionCalendar('{"1719100800": 3, "1726963200": 17}'),
    ).toEqual({
      "2024-06-23": 3,
      "2024-09-22": 17,
    });
  });

  it("国际站与力扣用不同的接口和参数", async () => {
    const calls: {
      url: string;
      body: { variables: Record<string, unknown> };
    }[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      calls.push({ url, body });
      const calendar = { submissionCalendar: '{"1735689600": 4}' };
      return new Response(
        JSON.stringify(
          url.includes("leetcode.cn")
            ? { data: { userCalendar: calendar } }
            : { data: { matchedUser: { userCalendar: calendar } } },
        ),
      );
    }) as unknown as typeof fetch;
    const com = await handleLeetCodeRequest(
      req("user=lee215&year=2025"),
      fetchImpl,
      undefined,
      now,
    );
    expect(await com.json()).toMatchObject({ days: { "2025-01-01": 4 } });
    const cn = await handleLeetCodeRequest(
      req("user=lee215&year=2025&site=cn"),
      fetchImpl,
      undefined,
      now,
    );
    expect(cn.status).toBe(200);
    expect(calls[0].url).toBe("https://leetcode.com/graphql");
    expect(calls[0].body.variables).toEqual({ username: "lee215", year: 2025 });
    expect(calls[1].url).toBe("https://leetcode.cn/graphql/noj-go/");
    expect(calls[1].body.variables).toEqual({ userSlug: "lee215", year: 2025 });
  });

  it("找不到用户、参数不对", async () => {
    const missing = (async () =>
      new Response(
        JSON.stringify({ data: { matchedUser: null } }),
      )) as unknown as typeof fetch;
    const r = await handleLeetCodeRequest(
      req("user=ghost&year=2025"),
      missing,
      undefined,
      now,
    );
    expect(r.status).toBe(404);
    expect((await r.json()).error).toMatch(/ghost/);
    expect(
      (
        await handleLeetCodeRequest(
          req("user=a b&year=2025"),
          missing,
          undefined,
          now,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await handleLeetCodeRequest(
          req("user=ok&year=2013"),
          missing,
          undefined,
          now,
        )
      ).status,
    ).toBe(400);
  });
});
